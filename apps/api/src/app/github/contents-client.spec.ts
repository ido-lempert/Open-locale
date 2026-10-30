import { createHash } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { GitHubContentsClient } from './contents-client';

describe('GitHub contents adapter over real HTTP fixture',()=>{
  let server:Server,client:GitHubContentsClient, origin:string;
  let status:number, response:unknown, calls:number, url:string, headers:Record<string,unknown>,body:Record<string,unknown>;
  const sha=createHash('sha1').update('blob 2\0{}').digest('hex');
  beforeEach(async()=>{
    status=200;response={type:'file',path:'locales/en.json',sha,encoding:'base64',size:2,content:'e30='};calls=0;
    server=createServer(async(req,res)=>{calls++;url=req.url!;headers=req.headers;let raw='';for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{};res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(response));});
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;client=new GitHubContentsClient('fixture-only-token',origin);
  });
  afterEach(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
  it('reads a bounded file with explicit branch and auth headers',async()=>{
    expect(await client.read('owner','repo','locales/en.json','feature/test')).toEqual({sha,path:'locales/en.json',text:'{}'});
    expect(url).toBe('/repos/owner/repo/contents/locales/en.json?ref=feature%2Ftest');expect(headers.authorization).toBe('Bearer fixture-only-token');expect(headers['x-github-api-version']).toBe('2026-03-10');
  });
  it('updates only with expected SHA and returns verified result fields',async()=>{
    const updatedText='{"hi":"hello"}';
    const updatedSha=createHash('sha1').update(`blob ${Buffer.byteLength(updatedText)}\0`).update(updatedText).digest('hex');
    response={content:{path:'locales/en.json',sha:updatedSha},commit:{sha:'c'.repeat(40)}};
    expect(await client.write('owner','repo','locales/en.json','main','{"hi":"hello"}',sha,'Update translations')).toEqual({fileSha:updatedSha,commitSha:'c'.repeat(40)});
    expect(body.sha).toBe(sha);expect(body.branch).toBe('main');expect(Buffer.from(body.content as string,'base64').toString()).toBe('{"hi":"hello"}');
  });
  it('surfaces SHA conflict without retry or overwrite',async()=>{status=409;response={message:'remote fixture diagnostic'};await expect(client.write('owner','repo','locales/en.json','main','{}',sha,'Update')).rejects.toMatchObject({status:409});expect(calls).toBe(1);});
  it('never follows redirects with credentials',async()=>{status=302;response={};await expect(client.read('owner','repo','locales/en.json','main')).rejects.toThrow('Redirect refused');expect(calls).toBe(1);});
  it.each(['../secret','/absolute','a//b','a/./b','a\\b','a\u0000b'])('rejects unsafe path %p before network',async(path)=>{await expect(client.read('owner','repo',path,'main')).rejects.toThrow();expect(calls).toBe(0);});
  it('rejects symlink/submodule/directory payloads',async()=>{for(const extra of [{type:'symlink'},{target:'secret'},{submodule_git_url:'url'},{type:'dir'}]){response={type:'file',path:'locales/en.json',sha,encoding:'base64',size:2,content:'e30=',...extra};await expect(client.read('owner','repo','locales/en.json','main')).rejects.toThrow('Unsupported');}});
  it('rejects invalid base64, size mismatch and invalid UTF8',async()=>{for(const fixture of [{content:'!!!!'},{size:3},{size:1,content:'/w=='}]){response={type:'file',path:'locales/en.json',sha,encoding:'base64',size:2,content:'e30=',...fixture};await expect(client.read('owner','repo','locales/en.json','main')).rejects.toThrow();}});
  it('rejects absent expected SHA before writing',async()=>{await expect(client.write('owner','repo','locales/en.json','main','{}','','Update')).rejects.toThrow();expect(calls).toBe(0);});
  it('sanitizes provider errors rather than returning response body',async()=>{status=403;response={message:'secret diagnostic'};await expect(client.read('owner','repo','locales/en.json','main')).rejects.toThrow('GitHub contents request failed');});
  it('rejects mismatched blob SHA',async()=>{response={type:'file',path:'locales/en.json',sha:'a'.repeat(40),encoding:'base64',size:2,content:'e30='};await expect(client.read('owner','repo','locales/en.json','main')).rejects.toThrow('blob SHA mismatch');});
  it('rejects arbitrary API origins',()=>{expect(()=>new GitHubContentsClient('fixture','https://evil.example')).toThrow();});
});

describe('update response consistency and reconciliation',()=>{
  let server:Server,client:GitHubContentsClient,calls:number;
  beforeEach(async()=>{
    calls=0;server=createServer((req,res)=>{calls++;req.resume();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({content:{path:'en.json',sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}}));});
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    client=new GitHubContentsClient('fixture-token',`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  });
  afterEach(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
  it('does not report update success when provider returns a different blob and never retries',async()=>{
    await expect(client.write('owner','repo','en.json','main','{"a":"requested"}','a'.repeat(40),'Update')).rejects.toThrow('remote outcome requires reconciliation');
    expect(calls).toBe(1);
  });
});
