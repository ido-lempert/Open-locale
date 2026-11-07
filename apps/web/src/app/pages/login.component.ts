import { Component, OnDestroy, OnInit, signal } from '@angular/core';
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
      @if (notice()) {
        <p class="muted" role="status" name="loginNotice">{{ notice() }}</p>
      }
      @for (provider of providers; track provider) {
        @if (providerLoading()[provider]) {
          <p
            class="muted"
            role="status"
            [attr.name]="provider + 'ConfigurationLoading'"
          >
            Checking {{ provider.toUpperCase() }} sign-in...
          </p>
        }
        @if (providerError()[provider]) {
          <p
            class="error"
            role="alert"
            [attr.name]="provider + 'ConfigurationError'"
          >
            {{ provider.toUpperCase() }} sign-in configuration unavailable.
            Password sign-in remains available.
          </p>
          <button
            type="button"
            [attr.name]="provider + 'ConfigurationRetry'"
            (click)="loadProvider(provider)"
            [disabled]="busy() || providerLoading()[provider]"
          >
            Retry {{ provider.toUpperCase() }} configuration
          </button>
        }
      }
      @if (oidcConfigured()) {
        <button
          type="button"
          name="oidcLogin"
          (click)="startSso()"
          [disabled]="busy()"
        >
          Sign in with SSO
        </button>
        <p class="muted">Continue through your identity provider.</p>
      }
      @if (samlConfigured()) {
        <button
          name="samlLogin"
          type="button"
          (click)="startSaml()"
          [disabled]="busy()"
        >
          Sign in with SAML
        </button>
      }
      <div class="tabs">
        <button [class.active]="mode() === 'login'" (click)="mode.set('login')">
          Log in
        </button>
        <button
          [class.active]="mode() === 'signup'"
          (click)="mode.set('signup')"
        >
          Sign up
        </button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'signup') {
          <label
            >Name
            <input
              [(ngModel)]="displayName"
              name="displayName"
              required
              autocomplete="name"
          /></label>
        }
        <label
          >Email
          <input
            type="email"
            [(ngModel)]="email"
            name="email"
            required
            autocomplete="email"
        /></label>
        <label
          >Password
          <input
            type="password"
            [(ngModel)]="password"
            name="password"
            required
            [attr.minlength]="mode() === 'signup' ? 8 : null"
            [attr.autocomplete]="
              mode() === 'signup' ? 'new-password' : 'current-password'
            "
        /></label>
        @if (mode() === 'login') {
          <label
            >2FA code
            <input
              [(ngModel)]="totpCode"
              name="totpCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="Only if two-factor is enabled"
          /></label>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="primary" type="submit" [disabled]="busy()">
          {{
            busy()
              ? 'Working…'
              : mode() === 'login'
                ? 'Log in'
                : 'Create account'
          }}
        </button>
      </form>
    </main>
  `,
})
export class LoginComponent implements OnInit, OnDestroy {
  private alive = true;
  oidcConfigured = signal(false);
  samlConfigured = signal(false);
  mode = signal<'login' | 'signup'>('login');
  email = '';
  password = '';
  displayName = '';
  totpCode = '';
  busy = signal(false);
  error = signal('');
  notice = signal('');
  constructor(
    private api: ApiService,
    private router: Router,
    route: ActivatedRoute,
  ) {
    this.notice.set(route.snapshot.queryParamMap.get('reason') ?? '');
  }
  readonly providers = ['oidc', 'saml'] as const;
  providerLoading = signal({ oidc: false, saml: false });
  providerError = signal({ oidc: false, saml: false });
  async ngOnInit() {
    await Promise.all(
      this.providers.map((provider) => this.loadProvider(provider)),
    );
  }
  async loadProvider(provider: 'oidc' | 'saml') {
    if (!this.alive || this.busy() || this.providerLoading()[provider]) return;
    this.providerLoading.update((state) => ({ ...state, [provider]: true }));
    this.providerError.update((state) => ({ ...state, [provider]: false }));
    const configured =
      provider === 'oidc' ? this.oidcConfigured : this.samlConfigured;
    configured.set(false);
    try {
      const enabled =
        provider === 'oidc'
          ? (await this.api.getOidcInfo()).configured
          : !!(await this.api.getSamlSpInfo()).browserEnabled;
      if (this.alive) configured.set(enabled);
    } catch {
      if (this.alive)
        this.providerError.update((state) => ({ ...state, [provider]: true }));
    } finally {
      if (this.alive)
        this.providerLoading.update((state) => ({
          ...state,
          [provider]: false,
        }));
    }
  }
  ngOnDestroy() {
    this.alive = false;
    this.password = '';
    this.totpCode = '';
  }
  async startSaml() {
    if (!this.alive || this.busy() || !this.samlConfigured()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const verifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      );
      const challenge = btoa(String.fromCharCode(...digest))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      if (!this.alive) return;
      const result = await this.api.startSamlBrowser(challenge);
      if (!this.alive) return;
      const url = new URL(result.url);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('Invalid SAML URL');
      sessionStorage.setItem('ol.saml.verifier', verifier);
      window.location.assign(url.toString());
    } catch (e) {
      if (this.alive) {
        this.error.set(e instanceof Error ? e.message : 'SAML could not start');
        this.busy.set(false);
      }
    }
  }
  async startSso() {
    if (!this.alive || this.busy() || !this.oidcConfigured()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.api.startOidc();
      if (!this.alive) return;
      const url = new URL(result.url);
      const state = url.searchParams.get('state');
      if (!state || !['http:', 'https:'].includes(url.protocol))
        throw new Error('Invalid SSO authorization URL');
      // Same-tab browser binding supplements the server's PKCE/state checks.
      // No code, JWT, pending token, or provider secret is persisted here.
      sessionStorage.setItem('ol.oidc.state', state);
      window.location.assign(url.toString());
    } catch (e) {
      if (this.alive) {
        this.error.set(e instanceof Error ? e.message : 'SSO could not start');
        this.busy.set(false);
      }
    }
  }
  async submit() {
    if (!this.alive || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const res =
        this.mode() === 'login'
          ? await this.api.login(
              this.email,
              this.password,
              this.totpCode.trim() || undefined,
            )
          : await this.api.signup(this.email, this.password, this.displayName);
      if (!this.alive) return;
      this.api.token = res.accessToken;
      await this.router.navigate(['/projects']);
    } catch (e) {
      if (this.alive) this.error.set(e instanceof Error ? e.message : 'Failed');
    } finally {
      if (this.alive) this.busy.set(false);
    }
  }
}
