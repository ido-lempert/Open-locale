import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Key, Project } from '../api.service';

// In-context embed endpoint. This page is loaded inside an iframe on a host
// website. Security boundaries, enforced here and tested in
// scripts/incontext-test.mjs:
//  - The session token stays in this frame's localStorage; it is never put in
//    a postMessage payload, the URL, or the DOM in a readable form.
//  - Inbound messages are processed only when event.origin is in the project's
//    embedOrigins allowlist (managed in project settings, session-only) AND the
//    payload matches the strict protocol shape below.
//  - Replies go to event.origin explicitly, never '*', and only to the source
//    window of a verified message.
type HostMessage = { source: 'open-locale-host'; type: 'ol:ping' } | { source: 'open-locale-host'; type: 'ol:highlight'; key: string };
const isHostMessage = (d: unknown): d is HostMessage => {
  if (typeof d !== 'object' || d === null) return false;
  const m = d as Record<string, unknown>;
  if (m['source'] !== 'open-locale-host') return false;
  if (m['type'] === 'ol:ping') return Object.keys(m).length === 2;
  if (m['type'] === 'ol:highlight') return typeof m['key'] === 'string' && m['key'].length > 0 && m['key'].length <= 500 && Object.keys(m).length === 3;
  return false;
};

@Component({
  selector: 'ol-embed',
  imports: [RouterLink],
  template: `
    <main class="embed-main">
      <header class="bar">
        <strong>Open-locale</strong>
        <span class="muted">in-context - {{ project()?.name ?? '' }} ({{ branch }})</span>
      </header>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      @if (!connected()) {
        <p class="muted">Waiting for the host page to connect. This frame only answers pages whose origin is allowlisted in project settings.</p>
      }
      <ul class="embed-keys">
        @for (k of keys(); track k.id) {
          <li [class.highlighted]="k.name === highlighted()">
            <code>{{ k.name }}</code>
            <span>{{ valueOf(k) }}</span>
          </li>
        }
      </ul>
      @if (!keys().length && !error()) { <p class="muted">No keys on this branch.</p> }
    </main>
  `,
})
export class EmbedComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly project = signal<Project | null>(null);
  readonly keys = signal<Key[]>([]);
  readonly highlighted = signal<string | null>(null);
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);
  branch = 'main';
  private allowedOrigins: string[] = [];

  async ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id')!;
    this.branch = this.route.snapshot.queryParamMap.get('branch') ?? 'main';
    try {
      const p = await this.api.getProject(projectId);
      this.project.set(p);
      this.allowedOrigins = p.embedOrigins ?? [];
      this.keys.set(await this.api.listKeys(projectId, { branch: this.branch }));
    } catch {
      this.error.set('Could not load the project. Sign in as a project member in this frame.');
    }
  }

  valueOf(k: Key): string {
    const base = this.project()?.baseLocale ?? 'en';
    return k.translations.find((t) => t.localeCode === base)?.value ?? '';
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    // Origin first: never even inspect payloads from non-allowlisted origins.
    if (!this.allowedOrigins.includes(event.origin)) return;
    if (!isHostMessage(event.data)) return;
    const reply = (msg: Record<string, unknown>) => {
      (event.source as Window | null)?.postMessage({ source: 'open-locale-embed', ...msg }, event.origin);
    };
    this.connected.set(true);
    if (event.data.type === 'ol:ping') {
      reply({ type: 'ol:pong', keys: this.keys().length, branch: this.branch });
    } else if (event.data.type === 'ol:highlight') {
      const found = this.keys().some((k) => k.name === (event.data as { key: string }).key);
      this.highlighted.set(found ? (event.data as { key: string }).key : null);
      reply({ type: 'ol:highlighted', key: (event.data as { key: string }).key, found });
    }
  }
}
