import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-login',
  imports: [FormsModule],
  template: `
    <main class="auth-card">
      <h1>Open-locale</h1>
      <p class="muted">Open-source localization management</p>
        @if (notice()) { <p class="muted" role="status" name="loginNotice">{{ notice() }}</p> }
      @if (oidcConfigured()) {
        <button type="button" name="oidcLogin" (click)="startSso()" [disabled]="busy()">Sign in with SSO</button>
        <p class="muted">Continue through your identity provider.</p>
      }
      <div class="tabs">
        <button [class.active]="mode() === 'login'" (click)="mode.set('login')">Log in</button>
        <button [class.active]="mode() === 'signup'" (click)="mode.set('signup')">Sign up</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'signup') {
          <label>Name <input [(ngModel)]="displayName" name="displayName" required autocomplete="name" /></label>
        }
        <label>Email <input type="email" [(ngModel)]="email" name="email" required autocomplete="email" /></label>
        <label>Password <input type="password" [(ngModel)]="password" name="password" required
          [attr.minlength]="mode() === 'signup' ? 8 : null"
          [attr.autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'" /></label>
        @if (mode() === 'login') {
          <label>2FA code <input [(ngModel)]="totpCode" name="totpCode" inputmode="numeric" autocomplete="one-time-code"
            placeholder="Only if two-factor is enabled" /></label>
        }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Working…' : mode() === 'login' ? 'Log in' : 'Create account' }}
        </button>
      </form>
    </main>
  `,
})
export class LoginComponent implements OnInit {
  oidcConfigured = signal(false);
  mode = signal<'login' | 'signup'>('login');
  email = ''; password = ''; displayName = ''; totpCode = '';
  busy = signal(false); error = signal('');
  notice = signal('');
  constructor(private api: ApiService, private router: Router, route: ActivatedRoute) {
    this.notice.set(route.snapshot.queryParamMap.get('reason') ?? '');
  }
  async ngOnInit() {
    try { this.oidcConfigured.set((await this.api.getOidcInfo()).configured); } catch { /* Password login remains available. */ }
  }
  async startSso() {
    this.busy.set(true); this.error.set('');
    try {
      const result = await this.api.startOidc();
      const url = new URL(result.url);
      const state = url.searchParams.get('state');
      if (!state || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid SSO authorization URL');
      // Same-tab browser binding supplements the server's PKCE/state checks.
      // No code, JWT, pending token, or provider secret is persisted here.
      sessionStorage.setItem('ol.oidc.state', state);
      window.location.assign(url.toString());
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'SSO could not start'); this.busy.set(false); }
  }
  async submit() {
    this.busy.set(true); this.error.set('');
    try {
      const res = this.mode() === 'login'
        ? await this.api.login(this.email, this.password, this.totpCode.trim() || undefined)
        : await this.api.signup(this.email, this.password, this.displayName);
      this.api.token = res.accessToken;
      await this.router.navigate(['/projects']);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
}
