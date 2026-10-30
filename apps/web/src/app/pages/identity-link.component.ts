import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
        Link the identity you choose at the configured OIDC provider to your
        current account. This does not merge accounts or change project access.
        An identity linked to another account is rejected. You must confirm your
        current password first.
      </p>
      @if (loading()) {
        <p role="status">Checking single sign-on configuration...</p>
      } @else if (configured()) {
        <p>
          Continue in this tab. Confirm the provider account you intend to link.
          The sign-in callback completes the link and may ask for your account's
          second factor.
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
            name="startOidcLink"
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
          OIDC single sign-on is not configured on this instance.
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
  constructor(private api: ApiService) {}
  async ngOnInit() {
    try {
      const info = await this.api.getOidcInfo();
      if (this.alive) this.configured.set(info.configured);
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
    sessionStorage.removeItem('ol.oidc.state');
    try {
      const result = await this.api.startOidcLink(password);
      if (!this.alive) return;
      const url = new URL(result.url),
        states = url.searchParams.getAll('state');
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        states.length !== 1 ||
        !states[0]
      )
        throw new Error('Invalid single sign-on authorization URL');
      sessionStorage.setItem('ol.oidc.state', states[0]);
      window.location.assign(url.toString());
    } catch (e) {
      if (this.alive) {
        sessionStorage.removeItem('ol.oidc.state');
        this.error.set(
          e instanceof Error ? e.message : 'Could not start identity linking',
        );
        this.busy.set(false);
      }
    }
  }
}
