import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, BranchInfo, ProgressReport } from '../api.service';

@Component({
  selector: 'ol-reports',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Progress</h1>
      <select aria-label="Branch" name="reportBranch" [ngModel]="branch()" (ngModelChange)="branch.set($event); void fetch()">
        @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
      </select>
    </header>
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      @if (report(); as r) {
        <p class="muted">{{ r.totalKeys }} keys on {{ r.branch }}. A key counts as translated when its value is not empty; status counts cover non-empty values only.</p>
        <table class="qa-table progress-table">
          <thead>
            <tr><th>Locale</th><th class="progress-bar-col">Progress</th><th>Translated</th><th>Untranslated</th>
              @for (s of statusColumns(); track s) { <th>{{ s.toLowerCase() }}</th> }
            </tr>
          </thead>
          <tbody>
            @for (l of r.locales; track l.locale) {
              <tr>
                <td><code>{{ l.locale }}</code>@if (l.base) { <span class="muted"> base</span> }</td>
                <td class="progress-bar-col">
                  <div class="progress-bar" role="img" [attr.aria-label]="l.locale + ' ' + l.percent + '% translated'">
                    <div class="progress-fill" [style.width.%]="l.percent"></div>
                  </div>
                  <span class="muted">{{ l.percent }}%</span>
                </td>
                <td>{{ l.translated }} / {{ l.total }}</td>
                <td>{{ l.untranslated }}</td>
                @for (s of statusColumns(); track s) { <td>{{ l.byStatus[s] ?? 0 }}</td> }
              </tr>
            }
          </tbody>
        </table>
      } @else if (!error()) {
        <p class="muted">Loading…</p>
      }
    </main>
  `,
})
export class ReportsComponent implements OnInit {
  projectId = '';
  report = signal<ProgressReport | null>(null);
  branches = signal<BranchInfo[]>([]);
  branch = signal('main');
  statusColumns = signal<string[]>([]);
  error = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.branches.set(await this.api.listBranches(this.projectId).catch(() => []));
    await this.fetch();
  }

  async fetch() {
    this.error.set('');
    try {
      const r = await this.api.getProgress(this.projectId, this.branch());
      this.report.set(r);
      const cols: string[] = [];
      for (const l of r.locales) for (const s of Object.keys(l.byStatus)) if (!cols.includes(s)) cols.push(s);
      this.statusColumns.set(cols);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
  }
}
