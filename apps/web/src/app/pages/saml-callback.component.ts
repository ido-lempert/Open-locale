import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-saml-callback',
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
export class SamlCallbackComponent implements OnInit {
  busy = signal(true); error = signal(''); code = ''; pendingToken = '';
  constructor(private api: ApiService, private router: Router) {}
  async ngOnInit() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(window.history.state, '', window.location.pathname);
    const verifier = sessionStorage.getItem('ol.saml.verifier');
    sessionStorage.removeItem('ol.saml.verifier');
    try {
      const codes = params.getAll('code');
      if (!verifier || codes.length !== 1 || !codes[0]) throw new Error('This SAML sign-in is incomplete or was not started in this tab. Return to sign-in and try again.');
      const result = await this.api.redeemSamlBrowser(codes[0], verifier);
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
      const result = await this.api.completeSaml(pending, this.code.trim());
      if (!result.accessToken) throw new Error('The sign-in response was incomplete.');
      this.api.token = result.accessToken;
      await this.router.navigate(['/projects'], { replaceUrl: true });
    } catch { this.error.set('Second-factor verification failed. Return to sign-in to start again.'); }
    finally { this.code = ''; this.busy.set(false); }
  }
  restart() { this.pendingToken = ''; this.code = ''; void this.router.navigate(['/login'], { replaceUrl: true }); }
}
