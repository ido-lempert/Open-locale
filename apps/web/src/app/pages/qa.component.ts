import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Project, QaIssue } from '../api.service';

@Component({
  selector: 'ol-qa',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>QA checks</h1>
    </header>
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      <div class="toolbar">
        <select aria-label="Filter by locale" name="qaLocale" [ngModel]="locale()" (ngModelChange)="locale.set($event); void fetch()">
          <option value="">all target locales</option>
          @for (l of targetLocales(); track l) { <option [value]="l">{{ l }}</option> }
        </select>
        <span class="muted">{{ issues().length }} issue{{ issues().length === 1 ? '' : 's' }}</span>
      </div>
      <table class="qa-table">
        <thead><tr><th>Key</th><th>Locale</th><th>Issue</th><th>Detail</th></tr></thead>
        <tbody>
          @for (i of issues(); track i.keyId + '-' + i.locale + '-' + i.type) {
            <tr>
              <td><a class="qa-key" [routerLink]="['/projects', projectId]">{{ i.key }}</a></td>
              <td><code>{{ i.locale }}</code></td>
              <td><span [class]="'qa-badge qa-' + i.type">{{ label(i.type) }}</span></td>
              <td class="muted">{{ i.detail }}</td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="muted">{{ loading() ? 'Loading…' : 'No QA issues found' }}</td></tr>
          }
        </tbody>
      </table>
    </main>
  `,
})
export class QaComponent implements OnInit {
  projectId = '';
  issues = signal<QaIssue[]>([]);
  targetLocales = signal<string[]>([]);
  locale = signal('');
  loading = signal(true);
  error = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.fetch();
    void this.api.getProject(this.projectId)
      .then((p: Project) => this.targetLocales.set(p.locales.map((l) => l.code).filter((c) => c !== p.baseLocale)))
      .catch(() => this.targetLocales.set([]));
  }

  async fetch() {
    this.loading.set(true);
    try {
      const res = await this.api.runQa(this.projectId, this.locale() || undefined);
      this.issues.set(res.issues);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to run QA checks'); }
    finally { this.loading.set(false); }
  }

  label(type: QaIssue['type']): string {
    switch (type) {
      case 'untranslated': return 'Untranslated';
      case 'placeholder_mismatch': return 'Placeholder mismatch';
      case 'max_length': return 'Too long';
      case 'whitespace': return 'Whitespace';
      case 'number_mismatch': return 'Number mismatch';
      case 'html_mismatch': return 'HTML mismatch';
    }
  }
}
