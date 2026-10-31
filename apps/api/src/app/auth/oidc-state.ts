import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
export interface OidcState {
  nonce: string;
  verifier: string;
  linkUserId: string | null;
  linkEpoch: number | null;
}
// Local to one API process. A cap check and insert/consume have no await.
export class OidcStateStore {
  private entries = new Map<string, OidcState & {expiresAt:number}>();
  constructor(private readonly capacity:number,private readonly ttlMs:number,private readonly now=()=>Date.now()) {
    if (!Number.isSafeInteger(capacity)||capacity<1||!Number.isFinite(ttlMs)||ttlMs<=0) throw new Error('Invalid OIDC state bounds');
  }
  create(value:OidcState) {
    const now=this.now();
    for(const [key,entry] of this.entries)if(entry.expiresAt<=now)this.entries.delete(key);
    if(this.entries.size>=this.capacity)throw new ServiceUnavailableException('Too many pending OIDC authorizations');
    const state=randomBytes(24).toString('base64url');
    this.entries.set(state,{...value,expiresAt:now+this.ttlMs});return state;
  }
  consume(state:string):OidcState {
    const entry=this.entries.get(state);this.entries.delete(state);
    if(!entry||entry.expiresAt<=this.now())throw new UnauthorizedException('Invalid or expired state');
    const {nonce,verifier,linkUserId,linkEpoch}=entry;return {nonce,verifier,linkUserId,linkEpoch};
  }
}
