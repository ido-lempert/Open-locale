import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-identities',
  imports: [RouterLink, DatePipe, FormsModule],
  styles: [`
    main { max-width: 760px; margin: auto; padding: 24px; }
    ul { list-style: none; padding: 0; }
    li { background: white; border: 1px solid #dce1e8; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-wrap: anywhere; }
    dt { font-weight: 600; margin-top: 8px; }
    dd { margin: 4px 0 0; }
    input { display: block; margin: 8px 0; width: 100%; }
    button { margin: 8px 8px 0 0; }
    nav { display: flex; gap: 16px; flex-wrap: wrap; }
  `],
  template: `
    <header class="bar"><a routerLink="/projects">&larr; Projects</a><h1>Linked identities</h1></header>
    <main>
      <p>These single sign-on identities are linked to your account. Provider email is metadata, not proof that an email address was verified.</p>
      <p class="muted">Unlinking requires your current local password. Accounts without one cannot unlink here. Password setup is not available. This page does not show local password or API-token details.</p>
      @if (loading()) { <p role="status">Loading linked identities...</p> }
      @else if (error()) { <p role="alert" class="error">{{ error() }}</p><button (click)="load()">Try again</button> }
      @else if (!identities().length) { <p role="status">No single sign-on identities are linked to this account.</p> }
      @else {
        <ul>@for (identity of identities(); track identity.id) {
          <li><dl>
            <dt>Provider issuer</dt><dd class="issuer">{{ identity.issuer }}</dd>
            <dt>Provider email (unverified metadata)</dt><dd class="provider-email">{{ identity.email }}</dd>
            <dt>Linked</dt><dd>{{ identity.createdAt | date:'medium' }}</dd>
          </dl>
          @if (selected() === identity.id) {
            <section class="unlink-confirm" aria-label="Confirm identity unlink">
              <p>Remove this identity from your account? All current sessions and pending second-factor sign-ins will be revoked. Sign in again with your local password and second factor. API tokens are not revoked. This does not delete your provider account or projects.</p>
              <form (ngSubmit)="unlink(identity.id)">
                <label>Current password<input type="password" name="unlinkPassword" [(ngModel)]="password" required autocomplete="current-password" [disabled]="busy()" /></label>
                <button type="submit" name="confirmUnlink" [disabled]="busy()">{{ busy() ? 'Unlinking...' : 'Unlink and sign out' }}</button>
                <button type="button" name="cancelUnlink" (click)="cancel()" [disabled]="busy()">Cancel</button>
              </form>
              @if (unlinkError()) { <p role="alert" class="error">{{ unlinkError() }}</p> }
            </section>
          } @else { <button type="button" name="chooseUnlink" (click)="choose(identity.id)" [disabled]="busy()">Unlink identity</button> }
          </li>
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
  selected = signal('');
  busy = signal(false);
  unlinkError = signal('');
  password = '';
  private generation = 0;
  choose(id: string) { if (!this.busy()) { this.selected.set(id); this.password = ''; this.unlinkError.set(''); } }
  cancel() { if (!this.busy()) { this.selected.set(''); this.password = ''; this.unlinkError.set(''); } }
  async unlink(id: string) {
    if (this.busy() || this.selected() !== id || !this.password) return;
    const generation = this.generation;
    const password = this.password; this.password = '';
    this.busy.set(true); this.unlinkError.set('');
    try {
      const result = await this.api.unlinkIdentity(id, password);
      if (generation !== this.generation) return;
      if (!result.unlinked || !result.signInRequired) throw new Error('Unexpected unlink response. Sign in again before retrying.');
      this.api.token = null; this.identities.set([]); this.selected.set('');
      await this.router.navigate(['/login'], {replaceUrl:true, queryParams:{reason:'Identity unlinked. Sign in again with your local password and second factor.'}});
    } catch (e) { if (generation === this.generation) this.unlinkError.set(e instanceof Error ? e.message : 'Could not unlink identity'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  constructor(private api: ApiService, private router: Router) {}
  ngOnInit() { void this.load(); }
  ngOnDestroy() { this.generation++; this.password = ''; this.selected.set(''); this.identities.set([]); }
  async load() {
    if (this.busy()) return;
    this.cancel();
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
