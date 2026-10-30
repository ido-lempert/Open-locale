import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-oidc-callback',
  styles: ['button[name=restartSso] { margin-top: 12px; }'],
  imports: [FormsModule],
  template: `
    <main class="auth-card">
      <h1>Single sign-on</h1>
      @if (busy()) { <p role="status">Checking your sign-in...</p> }
      @if (pendingToken) {
        <p>Confirm your account's second factor to finish signing in.</p>
        <form (ngSubmit)="complete()">
          <label>2FA or recovery code <input name="ssoCode" [(ngModel)]="code" autocomplete="one-time-code" required /></label>
          <button class="primary" type="submit" [disabled]="busy()">Finish sign-in</button>
        </form>
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <button type="button" name="restartSso" (click)="restart()" [disabled]="busy()">Back to sign-in</button>
    </main>
  `,
})
export class OidcCallbackComponent implements OnInit, OnDestroy {
  private querySubscription?: { unsubscribe(): void };
  busy = signal(true); error = signal(''); code = ''; pendingToken = '';
  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit() { this.querySubscription = this.route.queryParamMap.subscribe(() => { void this.consumeCallback(); }); }
  ngOnDestroy() { this.querySubscription?.unsubscribe(); }
  private async consumeCallback() {
    this.pendingToken = ''; this.error.set(''); this.busy.set(true);
    const params = new URL(window.location.href).searchParams;
    // Remove authorization codes and state from history before network I/O.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    const expected = sessionStorage.getItem('ol.oidc.state');
    sessionStorage.removeItem('ol.oidc.state');
    const states = params.getAll('state'), codes = params.getAll('code');
    try {
      if (!expected || states.length !== 1 || states[0] !== expected) throw new Error('This sign-in was not started in this tab. Return to sign-in and try again.');
      if (params.has('error')) throw new Error('The identity provider did not complete sign-in. Please try again.');
      if (codes.length !== 1 || !codes[0]) throw new Error('The sign-in response is missing its authorization code.');
      const result = await this.api.callbackOidc(codes[0], states[0]);
      if (result.requiresTwoFactor && result.pendingToken) this.pendingToken = result.pendingToken;
      else if (result.accessToken) { this.api.token = result.accessToken; await this.router.navigate(['/projects'], { replaceUrl: true }); }
      else throw new Error('The sign-in response was incomplete.');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { this.busy.set(false); }
  }
  async complete() {
    if (!this.pendingToken || this.busy()) return;
    this.busy.set(true); this.error.set('');
    const pending = this.pendingToken;
    // The server consumes the pending token even on a wrong code. A failure
    // must restart SSO, not invite retrying an already-consumed token.
    this.pendingToken = '';
    try {
      const result = await this.api.completeOidc(pending, this.code.trim());
      if (!result.accessToken) throw new Error('The sign-in response was incomplete.');
      this.api.token = result.accessToken;
      await this.router.navigate(['/projects'], { replaceUrl: true });
    } catch { this.error.set('Second-factor verification failed. Return to sign-in to start again.'); }
    finally { this.code = ''; this.busy.set(false); }
  }
  restart() { this.pendingToken = ''; this.code = ''; void this.router.navigate(['/login'], { replaceUrl: true }); }
}
