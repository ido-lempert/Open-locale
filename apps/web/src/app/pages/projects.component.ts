import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Project } from '../api.service';

@Component({
  selector: 'ol-projects',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar"><h1>Projects</h1>
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
  constructor(private api: ApiService) {}
  async ngOnInit() { await this.reload(); }
  async reload() {
    try { this.projects.set(await this.api.listProjects()); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
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
  logout() { this.api.token = null; location.href = '/login'; }
}
