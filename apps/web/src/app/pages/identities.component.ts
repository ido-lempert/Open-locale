import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-identities',
  imports: [RouterLink, DatePipe],
  styles: [`
    main { max-width: 760px; margin: auto; padding: 24px; }
    ul { list-style: none; padding: 0; }
    li { background: white; border: 1px solid #dce1e8; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-wrap: anywhere; }
    dt { font-weight: 600; margin-top: 8px; }
    dd { margin: 4px 0 0; }
    nav { display: flex; gap: 16px; flex-wrap: wrap; }
  `],
  template: `
    <header class="bar"><a routerLink="/projects">&larr; Projects</a><h1>Linked identities</h1></header>
    <main>
      <p>These single sign-on identities are linked to your account. Provider email is metadata, not proof that an email address was verified.</p>
      <p class="muted">Read-only list. Identity unlinking and password setup are not available here. This page does not show local password or API-token details.</p>
      @if (loading()) { <p role="status">Loading linked identities...</p> }
      @else if (error()) { <p role="alert" class="error">{{ error() }}</p><button (click)="load()">Try again</button> }
      @else if (!identities().length) { <p role="status">No single sign-on identities are linked to this account.</p> }
      @else {
        <ul>@for (identity of identities(); track identity.id) {
          <li><dl>
            <dt>Provider issuer</dt><dd class="issuer">{{ identity.issuer }}</dd>
            <dt>Provider email (unverified metadata)</dt><dd class="provider-email">{{ identity.email }}</dd>
            <dt>Linked</dt><dd>{{ identity.createdAt | date:'medium' }}</dd>
          </dl></li>
        }</ul>
      }
      <nav><a routerLink="/account/link-oidc">Link OIDC identity</a><a routerLink="/account/link-saml">Link SAML identity</a></nav>
    </main>
  `,
})
export class IdentitiesComponent implements OnInit, OnDestroy {
  identities = signal<{id:string;issuer:string;email:string;createdAt:string}[]>([]);
  loading = signal(true);
  error = signal('');
  private generation = 0;
  constructor(private api: ApiService) {}
  ngOnInit() { void this.load(); }
  ngOnDestroy() { this.generation++; this.identities.set([]); }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(''); this.identities.set([]);
    try {
      const identities = await this.api.listIdentities();
      if (generation === this.generation) this.identities.set(identities);
    } catch {
      if (generation === this.generation) this.error.set('Could not load identities. Sign in again if your session or second-factor check expired.');
    } finally { if (generation === this.generation) this.loading.set(false); }
  }
}
