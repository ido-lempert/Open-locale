import { createHash } from 'node:crypto';
import { pinnedRequest } from '../egress/pinned';

export interface RepositoryFile { sha: string; path: string; text: string; }
export class GitHubContentsError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const LIMIT = 512 * 1024;
const SHA = /^[a-f0-9]{40}$/;
// Transport groundwork only. No endpoint, stored credentials, installation
// enrollment or sync worker yet. The caller must supply separately authorized
// credentials; the development push credential is never read here.
export class GitHubContentsClient {
  constructor(private readonly token: string, private readonly origin = 'https://api.github.com') {
    if (!token || /[\x00-\x20\x7f]/.test(token)) throw new Error('Invalid GitHub credential');
    const u = new URL(origin);
    const fixture = process.env.NODE_ENV === 'test' && u.protocol === 'http:' && u.hostname === '127.0.0.1';
    if (!fixture && origin !== 'https://api.github.com') throw new Error('GitHub API origin is fixed');
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Invalid GitHub API origin');
  }
  private path(owner: string, repo: string, path: string, branch: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || ['.','..'].includes(repo)) throw new Error('Invalid repository');
    if (!path || Buffer.byteLength(path)>1024 || path.startsWith('/') || path.includes('\\') || /[\x00-\x1f\x7f]/.test(path) || path.split('/').some(p=>!p || p==='.' || p==='..')) throw new Error('Invalid repository path');
    if (!branch || branch.length>255 || /[\x00-\x20\x7f]/.test(branch)) throw new Error('Invalid branch');
    return `${this.origin}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  private async request(url: string, method: string, body?: unknown) {
    const res = await pinnedRequest(url, {method, body:body===undefined?undefined:JSON.stringify(body),headers:{Authorization:`Bearer ${this.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Open-locale','X-GitHub-Api-Version':'2026-03-10'},maxBytes:LIMIT*2,allowPrivate:process.env.NODE_ENV==='test'});
    if (res.status<200 || res.status>=300) throw new GitHubContentsError(res.status, res.status===409?'Repository file changed; fetch a new preview':'GitHub contents request failed');
    try { const data=res.json(); if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error(); return data as Record<string,unknown>; } catch { throw new Error('Malformed GitHub response'); }
  }
  async read(owner: string, repo: string, path: string, branch: string): Promise<RepositoryFile> {
    const url=this.path(owner,repo,path,branch);
    const data=await this.request(`${url}?${new URLSearchParams({ref:branch})}`,'GET');
    if(data.type!=='file' || data.encoding!=='base64' || data.path!==path || typeof data.sha!=='string' || !SHA.test(data.sha) || typeof data.content!=='string' || !Number.isSafeInteger(data.size) || (data.size as number)>LIMIT || (data.size as number)<0 || 'target' in data || 'submodule_git_url' in data) throw new Error('Unsupported GitHub file response');
    const encoded=data.content.replace(/\s/g,'');
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid GitHub base64');
    const bytes=Buffer.from(encoded,'base64');
    if(bytes.length!==data.size || bytes.length>LIMIT) throw new Error('GitHub file size mismatch');
    const blobSha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (blobSha!==data.sha) throw new Error('GitHub blob SHA mismatch');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return {sha:data.sha,path,text};
  }
  async write(owner: string, repo: string, path: string, branch: string, text: string, expectedSha: string, message: string) {
    const url=this.path(owner,repo,path,branch);
    // Updates only: never silently create/delete files or omit concurrency SHA.
    if(!SHA.test(expectedSha) || Buffer.byteLength(text)>LIMIT || !message.trim() || message.length>500) throw new Error('Invalid GitHub file update');
    const data=await this.request(url,'PUT',{branch,sha:expectedSha,message,content:Buffer.from(text).toString('base64')});
    const content=data.content as Record<string,unknown>|null;
    const commit=data.commit as Record<string,unknown>|null;
    if(!content || content.path!==path || typeof content.sha!=='string' || !SHA.test(content.sha) || !commit || typeof commit.sha!=='string' || !SHA.test(commit.sha)) throw new Error('Malformed GitHub update result; remote outcome requires reconciliation');
    return {fileSha:content.sha,commitSha:commit.sha};
  }
}
