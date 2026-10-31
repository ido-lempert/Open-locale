import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { GitHubContentsClient } from './contents-client';
import { gitBlobSha, RepositoryPreview } from './repository-preview';

describe('repository preview through real contents HTTP fixture', () => {
  let server: Server,
    coordinator: RepositoryPreview,
    calls: number,
    methods: string[],
    remoteText: string,
    responseStatus: number,
    override: unknown;
  const target = {
    owner: 'owner',
    repo: 'repo',
    path: 'locales/en.json',
    branch: 'main',
  };
  const baseline = {
    text: '{"a":"old","b":"old"}',
    sha: gitBlobSha('{"a":"old","b":"old"}'),
  };
  beforeEach(async () => {
    calls = 0;
    methods = [];
    remoteText = '{"a":"old","b":"remote"}';
    responseStatus = 200;
    override = undefined;
    server = createServer((req, res) => {
      calls++;
      methods.push(req.method!);
      const bytes = Buffer.from(remoteText);
      res.writeHead(responseStatus, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          override ?? {
            type: 'file',
            path: target.path,
            sha: gitBlobSha(remoteText),
            encoding: 'base64',
            size: bytes.length,
            content: bytes.toString('base64'),
          },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    coordinator = new RepositoryPreview(
      new GitHubContentsClient(
        'fixture-token',
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      ),
    );
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('compares fetched remote bytes with explicit baseline/local without any writes', async () => {
    const p = await coordinator.preview(
      target,
      baseline,
      '{"a":"local","b":"old"}',
    );
    expect(p.decisions.map((d) => d.suggested)).toEqual(['push', 'pull']);
    expect(p).toMatchObject({
      source: 'contents-adapter-read',
      baselineProvenanceVerified: false,
      canApply: false,
      remoteSha: gitBlobSha(remoteText),
    });
    expect(methods).toEqual(['GET']);
  });
  it('rejects baseline SHA mismatch before network', async () => {
    await expect(
      coordinator.preview(target, { ...baseline, sha: 'a'.repeat(40) }, '{}'),
    ).rejects.toThrow('Baseline blob SHA mismatch');
    expect(calls).toBe(0);
  });
  it('requires baseline instead of silently inventing one', async () => {
    await expect(
      coordinator.preview(target, undefined as never, '{}'),
    ).rejects.toThrow('Baseline SHA');
    expect(calls).toBe(0);
  });
  it('rejects duplicate baseline/local keys before network', async () => {
    await expect(
      coordinator.preview(
        target,
        { text: '{"a":"1","a":"2"}', sha: 'a'.repeat(40) },
        '{}',
      ),
    ).rejects.toThrow('Duplicate');
    await expect(
      coordinator.preview(target, baseline, '{"a":"1","a":"2"}'),
    ).rejects.toThrow('Duplicate');
    expect(calls).toBe(0);
  });
  it('rejects unsupported remote JSON after a single read, never writes', async () => {
    remoteText = '{"a":{"nested":"value"}}';
    await expect(coordinator.preview(target, baseline, '{}')).rejects.toThrow();
    expect(methods).toEqual(['GET']);
  });
  it('does not retry or return partial preview on provider failure', async () => {
    responseStatus = 403;
    override = { message: 'fixture private diagnostic' };
    await expect(coordinator.preview(target, baseline, '{}')).rejects.toThrow(
      'GitHub contents request failed',
    );
    expect(calls).toBe(1);
  });
  it('binds repository target and exact baseline blob to fingerprint', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    expect(
      (
        await coordinator.preview(
          { ...target, branch: 'other' },
          baseline,
          '{}',
        )
      ).fingerprint,
    ).not.toBe(p.fingerprint);
    const text = '{"b":"old","a":"old"}';
    expect(
      (await coordinator.preview(target, { text, sha: gitBlobSha(text) }, '{}'))
        .fingerprint,
    ).not.toBe(p.fingerprint);
  });
  it('snapshots mutable scope and baseline across the asynchronous read', async () => {
    const scope = { ...target },
      base = { ...baseline };
    const pending = coordinator.preview(scope, base, '{}');
    scope.branch = 'changed';
    base.sha = 'a'.repeat(40);
    const p = await pending;
    expect(p.target.branch).toBe('main');
    expect(p.baselineSha).toBe(baseline.sha);
    expect(p.fingerprint).toBe(
      (await coordinator.preview(target, baseline, '{}')).fingerprint,
    );
  });
  it('requires manual conflict and remote deletion rather than applying', async () => {
    remoteText = '{"a":"theirs"}';
    const p = await coordinator.preview(
      target,
      baseline,
      '{"a":"ours","b":"old"}',
    );
    expect(p.decisions.map((d) => d.suggested)).toEqual(['manual', 'manual']);
    expect(p.canApply).toBe(false);
    expect(methods).toEqual(['GET']);
  });
  it('resolves explicit choices against a freshly fetched repository preview without PUT', async () => {
    const local = '{"a":"local","b":"old"}';
    const p = await coordinator.preview(target, baseline, local);
    const d = await coordinator.resolve(
      target,
      baseline,
      local,
      p.fingerprint,
      { a: 'local', b: 'remote' },
    );
    expect(JSON.parse(d.json)).toEqual({ a: 'local', b: 'remote' });
    expect(d).toMatchObject({
      canApply: false,
      baselineProvenanceVerified: false,
      source: 'repository-preview-resolution',
      remoteSource: 'contents-adapter-read',
      target,
      baselineSha: baseline.sha,
      remoteSha: gitBlobSha(remoteText),
    });
    expect(methods).toEqual(['GET', 'GET']);
  });
  it('rejects remote changes after review rather than drafting against stale bytes', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    remoteText = '{"a":"changed"}';
    await expect(
      coordinator.resolve(target, baseline, '{}', p.fingerprint, {
        a: 'remote',
        b: 'base',
      }),
    ).rejects.toThrow('Preview changed');
    expect(methods).toEqual(['GET', 'GET']);
  });
  it('binds resolution to repository owner/repo/path/branch', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    for (const change of [
      { owner: 'another' },
      { repo: 'another' },
      { branch: 'another' },
    ])
      await expect(
        coordinator.resolve(
          { ...target, ...change },
          baseline,
          '{}',
          p.fingerprint,
          { a: 'local', b: 'remote' },
        ),
      ).rejects.toThrow('Preview changed');
    // File metadata path remains checked independently by the transport.
    await expect(
      coordinator.resolve(
        { ...target, path: 'other.json' },
        baseline,
        '{}',
        p.fingerprint,
        {},
      ),
    ).rejects.toThrow('Unsupported GitHub file');
    expect(methods.every((m) => m === 'GET')).toBe(true);
  });
  it('rejects local edits and exact baseline-byte changes after review', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    await expect(
      coordinator.resolve(
        target,
        baseline,
        '{"a":"new local"}',
        p.fingerprint,
        { a: 'local', b: 'remote' },
      ),
    ).rejects.toThrow('Preview changed');
    const text = '{"b":"old","a":"old"}';
    await expect(
      coordinator.resolve(
        target,
        { text, sha: gitBlobSha(text) },
        '{}',
        p.fingerprint,
        { a: 'local', b: 'remote' },
      ),
    ).rejects.toThrow('Preview changed');
  });
  it('snapshots resolution choices and scope during remote read', async () => {
    const local = '{"a":"local","b":"old"}';
    const p = await coordinator.preview(target, baseline, local);
    const choices = { a: 'local', b: 'remote' } as const;
    const scope = { ...target },
      base = { ...baseline };
    const pending = coordinator.resolve(
      scope,
      base,
      local,
      p.fingerprint,
      choices,
    );
    Object.assign(choices, { a: 'remote' });
    scope.branch = 'changed';
    base.sha = 'a'.repeat(40);
    const d = await pending;
    expect(JSON.parse(d.json)).toEqual({ a: 'local', b: 'remote' });
    expect(d.target).toEqual(target);
    expect(d.baselineSha).toBe(baseline.sha);
  });
  it('never returns a partial draft or retries when fresh read fails', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    responseStatus = 403;
    override = { message: 'secret fixture' };
    await expect(
      coordinator.resolve(target, baseline, '{}', p.fingerprint, {
        a: 'local',
        b: 'remote',
      }),
    ).rejects.toThrow('GitHub contents request failed');
    expect(calls).toBe(2);
  });
  it('rejects inherited/array/null choices and malformed fingerprint before I/O', async () => {
    for (const choices of [null, [], Object.create({ a: 'remote' })])
      await expect(
        coordinator.resolve(
          target,
          baseline,
          '{}',
          'f'.repeat(64),
          choices as never,
        ),
      ).rejects.toThrow('Expected explicit');
    await expect(
      coordinator.resolve(target, baseline, '{}', 'bad', {}),
    ).rejects.toThrow('fingerprint');
    expect(calls).toBe(0);
  });
  it('requires exact choices even for one-sided changes and can explicitly omit a key', async () => {
    const p = await coordinator.preview(target, baseline, '{}');
    await expect(
      coordinator.resolve(target, baseline, '{}', p.fingerprint, {
        b: 'remote',
      }),
    ).rejects.toThrow('every differing');
    const d = await coordinator.resolve(target, baseline, '{}', p.fingerprint, {
      a: 'local',
      b: 'remote',
    });
    expect(JSON.parse(d.json)).toEqual({ b: 'remote' });
    expect(d.absentKeys).toBe(1);
    expect(methods.every((m) => m === 'GET')).toBe(true);
  });
});
