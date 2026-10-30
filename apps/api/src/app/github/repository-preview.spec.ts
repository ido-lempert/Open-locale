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
});
