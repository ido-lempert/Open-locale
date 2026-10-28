import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Project } from '../api.service';

@Component({
  selector: 'ol-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Project settings</h1>
    </header>
    <main>
      @if (project(); as p) {
        <section class="panel">
          <h2>General</h2>
          <form (ngSubmit)="rename()">
            <label>Name <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" required /></label>
            <label>Description <input [ngModel]="description()" (ngModelChange)="description.set($event)" name="description" /></label>
            <button class="primary" type="submit" [disabled]="busy()">Save</button>
          </form>
          <p class="muted">Slug: <code>{{ p.slug }}</code> · Base locale: <code>{{ p.baseLocale }}</code></p>
        </section>
        <section class="panel">
          <h2>Locales</h2>
          <ul class="locale-list">
            @for (l of p.locales; track l.code) {
              <li>
                <code>{{ l.code }}</code>
                @if (l.code === p.baseLocale) { <span class="muted">base</span> }
                @else { <button class="danger" (click)="removeLocale(l.code)">Remove</button> }
              </li>
            }
          </ul>
          <form class="inline" (ngSubmit)="addLocale()">
            <input aria-label="Add locale" placeholder="Add locale (e.g. fr)" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
        </section>
        <section class="panel danger-zone">
          <h2>Danger zone</h2>
          @if (!confirming()) {
            <button class="danger-outline" (click)="confirming.set(true)">Delete project…</button>
          } @else {
            <p>Delete <strong>{{ p.name }}</strong> and all its keys and translations? This cannot be undone.</p>
            <button class="danger-solid" (click)="remove()" [disabled]="busy()">Yes, delete permanently</button>
            <button (click)="confirming.set(false)">Cancel</button>
          }
        </section>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      } @else {
        <p class="muted">Loading…</p>
      }
    </main>
  `,
})
export class SettingsComponent implements OnInit {
  project = signal<Project | null>(null);
  name = signal(''); description = signal(''); newLocale = signal('');
  busy = signal(false); error = signal(''); confirming = signal(false);
  projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute, private router: Router) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() { await this.reload(); }
  async reload() {
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p);
      this.name.set(p.name); this.description.set(p.description);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
  }
  async rename() {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.updateProject(this.projectId, { name: this.name(), description: this.description() });
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async addLocale() {
    this.busy.set(true); this.error.set('');
    try { await this.api.addLocale(this.projectId, this.newLocale().trim()); this.newLocale.set(''); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async removeLocale(code: string) {
    this.busy.set(true); this.error.set('');
    try { await this.api.removeLocale(this.projectId, code); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async remove() {
    this.busy.set(true);
    try { await this.api.deleteProject(this.projectId); await this.router.navigate(['/projects']); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); this.busy.set(false); }
  }
}
