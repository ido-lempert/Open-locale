import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-identity-link',
  imports: [FormsModule, RouterLink],
  styles: [
    `
      main {
        max-width: 650px;
        margin: 0 auto;
        padding: 24px;
      }
      label {
        display: block;
        margin: 16px 0;
      }
      input {
        margin-top: 6px;
      }
      p {
        line-height: 1.5;
      }
      .notice {
        color: #654b12;
        background: #fff8e7;
        border: 1px solid #e7cb85;
        border-radius: 8px;
        padding: 16px;
      }
    `,
  ],
  template: `
    <header class="bar">
      <a routerLink="/projects" class="back">&larr; Projects</a>
      <h1>Link single sign-on</h1>
    </header>
    <main>
      <p class="notice">
        Link the identity you choose at the configured {{ provider }} provider to your
        current account. This does not merge accounts or change project access.
        An identity linked to another account is rejected. You must confirm your
        current password first.
      </p>
      @if (loading()) {
        <p role="status">Checking single sign-on configuration...</p>
      } @else if (configured()) {
        <p>
          Continue in this tab. Confirm the provider account you intend to link.
          The provider response links the identity before the browser handoff
          finishes. You may then need your account's second factor. Closing the
          callback or failing that check does not undo a validated link.
        </p>
        <form (ngSubmit)="start()">
          <label
            >Current account password<input
              name="linkPassword"
              type="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
          /></label>
          <button
            [attr.name]="isSaml ? 'startSamlLink' : 'startOidcLink'"
            class="primary"
            type="submit"
            [disabled]="busy()"
          >
            {{ busy() ? 'Starting...' : 'Continue to identity provider' }}
          </button>
        </form>
        <p class="muted">
          Accounts without a local password cannot start this flow. No password
          setup or identity unlinking is available on this page.
        </p>
      } @else if (!error()) {
        <p role="status">
          {{ provider }} browser single sign-on is not configured on this instance.
        </p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
})
export class IdentityLinkComponent implements OnInit, OnDestroy {
  password = '';
  loading = signal(true);
  configured = signal(false);
  busy = signal(false);
  error = signal('');
  private alive = true;
  readonly isSaml: boolean;
  readonly provider: string;
  constructor(private api: ApiService, route: ActivatedRoute) {
    this.isSaml = route.snapshot.data['provider'] === 'saml';
    this.provider = this.isSaml ? 'SAML' : 'OIDC';
  }
  async ngOnInit() {
    try {
      const configured = this.isSaml ? !!(await this.api.getSamlSpInfo()).browserEnabled : (await this.api.getOidcInfo()).configured;
      if (this.alive) this.configured.set(configured);
    } catch {
      if (this.alive)
        this.error.set(
          'Could not check single sign-on configuration. Reload to try again.',
        );
    } finally {
      if (this.alive) this.loading.set(false);
    }
  }
  ngOnDestroy() {
    this.alive = false;
    this.password = '';
  }
  async start() {
    if (this.busy() || !this.password || !this.configured()) return;
    this.busy.set(true);
    this.error.set('');
    const password = this.password;
    this.password = '';
    // Remove previous same-tab attempt even when password verification fails.
    const stateKey = this.isSaml ? 'ol.saml.verifier' : 'ol.oidc.state';
    sessionStorage.removeItem(stateKey);
    try {
      let verifier = '';
      let challenge = '';
      if (this.isSaml) {
        verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
        challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      const result = this.isSaml ? await this.api.startSamlLink(password, challenge) : await this.api.startOidcLink(password);
      if (!this.alive) return;
      const url = new URL(result.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid single sign-on authorization URL');
      if (this.isSaml) {
        sessionStorage.setItem(stateKey, verifier);
      } else {
        const states = url.searchParams.getAll('state');
        if (states.length !== 1 || !states[0]) throw new Error('Invalid single sign-on authorization URL');
        sessionStorage.setItem(stateKey, states[0]);
      }
      window.location.assign(url.toString());
    } catch (e) {
      if (this.alive) {
        sessionStorage.removeItem(stateKey);
        this.error.set(
          e instanceof Error ? e.message : 'Could not start identity linking',
        );
        this.busy.set(false);
      }
    }
  }
}
