import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Project } from '../api.service';

@Component({
  selector: 'ol-projects',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar"><h1>Projects</h1>
      <a routerLink="/account/link-oidc" class="identity-link">Link SSO identity</a>
      <button (click)="logout()">Log out</button></header>
    <main>
      <form class="create" (ngSubmit)="create()">
        <input placeholder="Project name" aria-label="Project name" [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" required />
        <input placeholder="slug" aria-label="Project slug" [ngModel]="slug()" (ngModelChange)="slug.set($event)" name="slug" required pattern="[a-z0-9-]+" />
        <input placeholder="Locales (e.g. en, he, ar)" aria-label="Locales" [ngModel]="locales()" (ngModelChange)="locales.set($event)" name="locales" required />
        <button class="primary" type="submit" [disabled]="busy()">New project</button>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (projects().length === 0 && !error()) {
        <p class="muted empty">No projects yet. Create your first one above.</p>
      }
      <section class="panel tfa">
        <h2>Two-factor authentication</h2>
        @if (tfa(); as t) {
          @if (t.enabled) {
            <p class="muted">Enabled. {{ t.recoveryCodesRemaining }} recovery codes remain. Changing two-factor settings signs out all sessions, including this one.</p>
            <form class="inline" (ngSubmit)="disableTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaPassword" required autocomplete="current-password" />
              <input aria-label="Current 2FA code" placeholder="TOTP or recovery code" [ngModel]="tfaCode()" (ngModelChange)="tfaCode.set($event)" name="tfaCode" required />
              <button class="danger" type="submit" [disabled]="busy()">Disable</button>
            </form>
          } @else if (tfaSetup(); as su) {
            <p class="muted">Add this secret to your authenticator app, then enter its 6-digit code. Shown once.</p>
            <p><code class="tfa-secret">{{ su.secret }}</code></p>
            <p class="muted wrap"><code>{{ su.otpauthUrl }}</code></p>
            <form class="inline" (ngSubmit)="enableTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaPassword" required autocomplete="current-password" />
              <input aria-label="6-digit setup code" placeholder="6-digit code" [ngModel]="tfaCode()" (ngModelChange)="tfaCode.set($event)" name="tfaCode" required />
              <button class="primary" type="submit" [disabled]="busy()">Enable</button>
            </form>
          } @else {
            <p class="muted">Not enabled. A TOTP code is required at login after enabling. Setup requires your current password.</p>
            <form class="inline" (ngSubmit)="startTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaSetupPassword" required autocomplete="current-password" />
              <button type="submit" [disabled]="busy()">Set up two-factor</button>
            </form>
          }
        }
        @if (tfaCodes().length) {
          <p class="muted"><strong>Recovery codes - store them now; they are shown once and each works once.</strong></p>
          <ul class="locale-list tfa-codes">
            @for (c of tfaCodes(); track c) { <li><code>{{ c }}</code></li> }
          </ul>
          <p class="muted">Your current session was signed out when you enabled two-factor.</p>
          <button class="primary" (click)="dismissTfaCodes()">I've stored these - sign in again</button>
        }
      </section>
      <ul class="cards">
        @for (p of projects(); track p.id) {
          <li>
            <a [routerLink]="['/projects', p.id]">
              <strong>{{ p.name }}</strong>
              <span class="muted">{{ p.slug }} · base {{ p.baseLocale }} ·
                {{ p.locales.length }} locales · {{ p._count?.keys ?? 0 }} keys</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class ProjectsComponent implements OnInit {
  projects = signal<Project[]>([]);
  name = signal(''); slug = signal(''); locales = signal('');
  busy = signal(false); error = signal('');
  tfa = signal<{ enabled: boolean; recoveryCodesRemaining: number } | null>(null);
  tfaSetup = signal<{ secret: string; otpauthUrl: string } | null>(null);
  tfaCode = signal(''); tfaPassword = signal(''); tfaCodes = signal<string[]>([]);
  constructor(private api: ApiService) {}
  async ngOnInit() { await this.reload(); }
  async reload() {
    try {
      this.projects.set(await this.api.listProjects());
      this.tfa.set(await this.api.get2faStatus());
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
  }
  async startTfa() {
    this.busy.set(true); this.error.set('');
    try { this.tfaSetup.set(await this.api.setup2fa(this.tfaPassword())); this.tfaPassword.set(''); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  dismissTfaCodes() {
    this.tfaCodes.set([]);
    this.logout('Two-factor authentication is on - sign in again with your code.');
  }
  async enableTfa() {
    this.busy.set(true); this.error.set('');
    try {
      const res = await this.api.enable2fa(this.tfaPassword(), this.tfaCode().trim());
      this.tfaCodes.set(res.recoveryCodes);
      this.tfaSetup.set(null); this.tfaCode.set(''); this.tfaPassword.set('');
      // The pre-2FA session is immediately locked out of status reads
      // (step-up) - take the state from the enable response instead.
      this.tfa.set({ enabled: true, recoveryCodesRemaining: res.recoveryCodes.length });
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async disableTfa() {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.disable2fa(this.tfaPassword(), this.tfaCode().trim());
      this.tfaCode.set(''); this.tfaPassword.set(''); this.tfaCodes.set([]);
      // Disabling bumps the session epoch too - this token is already
      // revoked, so re-authenticate instead of refetching with it.
      this.logout('Two-factor authentication disabled - sign in again.');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async create() {
    this.busy.set(true); this.error.set('');
    try {
      const submitted = { name: this.name(), slug: this.slug(), locales: this.locales() };
      const codes = submitted.locales.split(',').map((s) => s.trim()).filter(Boolean);
      await this.api.createProject({ name: submitted.name, slug: submitted.slug, locales: codes });
      if (this.name() === submitted.name) this.name.set('');
      if (this.slug() === submitted.slug) this.slug.set('');
      if (this.locales() === submitted.locales) this.locales.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  logout(reason?: string) {
    this.api.token = null;
    location.href = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
  }
}
