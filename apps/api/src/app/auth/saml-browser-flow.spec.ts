import { createHash } from 'node:crypto';
import { SamlBrowserFlow } from './saml-browser-flow';
const verifier='a'.repeat(64), challenge=createHash('sha256').update(verifier).digest('base64url');
describe('browser SAML one-use verifier handoff',()=>{
  it('binds state to exact request and retains stripped-state protection',()=>{
    const flow=new SamlBrowserFlow();flow.start('request',challenge,'browser.state');
    expect(()=>flow.take('browser.state','other')).toThrow();
    expect(()=>flow.take('browser.state','request')).toThrow();
    expect(()=>flow.assertNotStripped('request')).toThrow();
  });
  it('binds linking purpose to the consumed state rather than caller input',()=>{
    const flow=new SamlBrowserFlow();
    flow.start('ordinary',challenge,'browser.ordinary');
    flow.start('link',challenge,'browser.link',true);
    expect(flow.take('browser.ordinary','ordinary')).toEqual({challenge,link:false});
    expect(flow.take('browser.link','link')).toEqual({challenge,link:true});
    expect(()=>flow.take('browser.link','link')).toThrow();
  });
  it('requires verifier and burns ticket on a wrong verifier',()=>{
    const flow=new SamlBrowserFlow();const code=flow.ticket(challenge,{accessToken:'fixture'});
    expect(()=>flow.redeem(code,'b'.repeat(64))).toThrow();
    expect(()=>flow.redeem(code,verifier)).toThrow();
  });
  it('redeems once with the right verifier',()=>{
    const flow=new SamlBrowserFlow();const code=flow.ticket(challenge,{requiresTwoFactor:true});
    expect(flow.redeem(code,verifier)).toEqual({requiresTwoFactor:true});
    expect(()=>flow.redeem(code,verifier)).toThrow();
  });
  it('expires states and tickets at their boundary',()=>{
    let now=0;const flow=new SamlBrowserFlow(2,()=>now);flow.start('r',challenge,'browser.s');const code=flow.ticket(challenge,{});
    now=60_000;expect(()=>flow.redeem(code,verifier)).toThrow();now=600_000;expect(()=>flow.take('browser.s','r')).toThrow();
  });
  it('bounds stores and recovers after expiry',()=>{
    let now=0;const flow=new SamlBrowserFlow(1,()=>now);flow.start('r',challenge,'browser.s');
    expect(()=>flow.start('r2',challenge,'browser.s2')).toThrow();now=600_000;expect(()=>flow.start('r2',challenge,'browser.s2')).not.toThrow();
    flow.ticket(challenge,{});expect(()=>flow.ticket(challenge,{})).toThrow();now+=60_000;expect(()=>flow.ticket(challenge,{})).not.toThrow();
  });
});
