import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

// Single-instance, bounded, one-use handoff. No session token is put in a
// redirect URL. The ticket can only be redeemed with the browser's verifier.
export class SamlBrowserFlow {
  private states = new Map<string, { requestId: string; challenge: string; link: boolean; expires: number }>();
  private purposes = new Map<string, number>();
  private tickets = new Map<string, { challenge: string; result: unknown; expires: number }>();
  constructor(private readonly capacity = 1000, private readonly now = () => Date.now()) {}
  private sweep() {
    const now = this.now();
    for (const [k,v] of this.states) if (v.expires <= now) this.states.delete(k);
    for (const [k,v] of this.purposes) if (v <= now) this.purposes.delete(k);
    for (const [k,v] of this.tickets) if (v.expires <= now) this.tickets.delete(k);
  }
  start(requestId: string, challenge: string, state: string, link = false) {
    this.sweep();
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new BadRequestException('Invalid browser challenge');
    if (this.purposes.size >= this.capacity) throw new ServiceUnavailableException('Too many browser sign-ins');
    this.states.set(state, {requestId,challenge,link,expires:this.now()+600_000});
    this.purposes.set(requestId,this.now()+600_000);
  }
  isBrowser(state?: string) { return !!state && state.startsWith('browser.'); }
  take(state: string, requestId: string) {
    const flow=this.states.get(state); this.states.delete(state);
    if (!flow || flow.expires<=this.now() || flow.requestId!==requestId) throw new UnauthorizedException('Invalid browser SAML state or request');
    return { challenge: flow.challenge, link: flow.link };
  }
  assertNotStripped(requestId: string) {
    this.sweep();
    if(this.purposes.has(requestId)) throw new UnauthorizedException('Browser SAML RelayState is required');
  }
  ticket(challenge: string, result: unknown) {
    this.sweep();
    if(this.tickets.size>=this.capacity) throw new ServiceUnavailableException('Too many browser sign-in results');
    const code=randomBytes(32).toString('base64url');
    this.tickets.set(code,{challenge,result,expires:this.now()+60_000});
    return code;
  }
  redeem(code: string, verifier: string): unknown {
    const ticket=this.tickets.get(code);this.tickets.delete(code);
    if(!ticket || ticket.expires<=this.now() || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier) || createHash('sha256').update(verifier).digest('base64url')!==ticket.challenge) throw new UnauthorizedException('Invalid or expired browser handoff');
    return ticket.result;
  }
}
