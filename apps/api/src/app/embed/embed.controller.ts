import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// In-context embed shell. Served by the API (not the static SPA host) so the
// frame-ancestors policy can be built per project from its embedOrigins
// allowlist. The shell carries NO project data: keys load over the
// authenticated API from frame.js with the frame's own session token.
// A project with an empty allowlist gets frame-ancestors 'self' - effectively
// not embeddable anywhere external.
@Controller('embed')
export class EmbedController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('frame.js')
  frameJs(@Res() res: Response) {
    res
      .type('application/javascript')
      .setHeader('Cache-Control', 'no-cache')
      .send(FRAME_JS);
  }

  @Get('frame.css')
  frameCss(@Res() res: Response) {
    res.type('text/css').setHeader('Cache-Control', 'no-cache').send(FRAME_CSS);
  }

  @Get('projects/:projectId')
  async shell(@Param('projectId') projectId: string, @Res() res: Response) {
    const project = await this.prisma.project
      .findUnique({ where: { id: projectId }, select: { id: true, embedOrigins: true } })
      .catch(() => null); // malformed ids are not valid uuids
    if (!project) throw new NotFoundException('Not found');
    const ancestors = ["'self'", ...project.embedOrigins].join(' ');
    res
      .type('text/html')
      .setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors ${ancestors}`,
      )
      .setHeader('Cache-Control', 'no-store')
      .send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open-locale in-context</title>
<link rel="stylesheet" href="/embed/frame.css">
<script src="/embed/frame.js" defer data-project-id="${project.id}"></script>
</head><body><main id="root"><p class="muted">Loading...</p></main></body></html>`);
  }
}

const FRAME_CSS = `body{font-family:system-ui,sans-serif;margin:0;padding:.5rem;color:#111827}
.muted{color:#6b7280;font-size:.85rem}
.error{color:#b91c1c}
.bar{display:flex;gap:.5rem;align-items:baseline;border-bottom:1px solid #e5e7eb;padding-bottom:.35rem;margin-bottom:.5rem}
ul{list-style:none;padding:0;margin:0}
li{display:flex;gap:.6rem;padding:.3rem .4rem;border-radius:6px;align-items:baseline}
li.hl{background:#fef3c7;outline:2px solid #f59e0b}
li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
code{background:#f3f4f6;border-radius:4px;padding:0 .3rem}
form{display:flex;flex-direction:column;gap:.4rem;max-width:260px;margin-top:.5rem}
input,button{padding:.4rem .5rem;font:inherit}
`;

// Protocol (mirrors docs/reviews/0030): the frame answers only the direct
// parent window (event.source === window.parent), only when its origin is in
// the project's allowlist, and only a strict message shape. Replies go to the
// verified event.origin, never '*'. The token stays in this frame's
// localStorage and never appears in a payload.
const FRAME_JS = `(() => {
  const root = document.getElementById('root');
  const projectId = document.currentScript.getAttribute('data-project-id');
  const TOKEN_KEY = 'ol_embed_token';
  const state = { token: localStorage.getItem(TOKEN_KEY) || null, origins: [], keys: [], branch: 'main', project: null };
  const branch = new URLSearchParams(location.search).get('branch') || 'main';
  state.branch = branch;
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const api = async (path, opts = {}) => {
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const renderLogin = (msg) => {
    root.innerHTML = '<header class="bar"><strong>Open-locale</strong><span class="muted">in-context</span></header>' +
      (msg ? '<p class="error">' + esc(msg) + '</p>' : '') +
      '<p class="muted">Sign in as a project member to use the in-context editor.</p>' +
      '<form id="f"><input id="e" type="email" placeholder="Email" required autocomplete="username">' +
      '<input id="p" type="password" placeholder="Password" required autocomplete="current-password">' +
      '<button type="submit">Sign in</button></form>';
    document.getElementById('f').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email: document.getElementById('e').value, password: document.getElementById('p').value } });
        state.token = r.accessToken;
        localStorage.setItem(TOKEN_KEY, state.token);
        await load();
      } catch { renderLogin('Sign-in failed.'); }
    });
  };
  const valueOf = (k) => { const t = (k.translations || []).find((t) => t.localeCode === (state.project && state.project.baseLocale)); return t ? t.value : ''; };
  const render = () => {
    root.innerHTML = '<header class="bar"><strong>Open-locale</strong><span class="muted">in-context - ' + esc(state.project.name) + ' (' + esc(state.branch) + ')</span></header>' +
      '<p class="muted" id="conn">Waiting for the host page. This frame answers only allowlisted origins.</p>' +
      '<ul>' + state.keys.map((k) => '<li data-key="' + esc(k.name) + '"><code>' + esc(k.name) + '</code><span>' + esc(valueOf(k)) + '</span></li>').join('') + '</ul>' +
      (state.keys.length ? '' : '<p class="muted">No keys on this branch.</p>');
  };
  const load = async () => {
    try {
      state.project = await api('/projects/' + projectId);
      state.origins = state.project.embedOrigins || [];
      state.keys = await api('/projects/' + projectId + '/keys?branch=' + encodeURIComponent(state.branch));
      render();
    } catch (e) {
      state.token = null; localStorage.removeItem(TOKEN_KEY);
      renderLogin('Could not load the project. Sign in as a project member.');
    }
  };
  const isHostMessage = (d) => {
    if (typeof d !== 'object' || d === null) return false;
    const keys = Object.keys(d);
    if (d.source !== 'open-locale-host') return false;
    if (d.type === 'ol:ping') return keys.length === 2;
    if (d.type === 'ol:highlight') return typeof d.key === 'string' && d.key.length > 0 && d.key.length <= 500 && keys.length === 3;
    return false;
  };
  window.addEventListener('message', (event) => {
    if (!state.project) return; // unauthenticated frames expose nothing
    if (event.source !== window.parent) return; // the direct embedder only
    if (!state.origins.includes(event.origin)) return; // allowlist before payload
    if (!isHostMessage(event.data)) return;
    const reply = (msg) => event.source.postMessage(Object.assign({ source: 'open-locale-embed' }, msg), event.origin);
    const conn = document.getElementById('conn');
    if (conn) conn.textContent = 'Connected to host ' + event.origin;
    if (event.data.type === 'ol:ping') {
      reply({ type: 'ol:pong', keys: state.keys.length, branch: state.branch });
    } else if (event.data.type === 'ol:highlight') {
      const found = state.keys.some((k) => k.name === event.data.key);
      const li = document.querySelector('li[data-key="' + CSS.escape(event.data.key) + '"]');
      if (li) li.classList.add('hl');
      reply({ type: 'ol:highlighted', key: event.data.key, found });
    }
  });
  if (state.token) load(); else renderLogin();
})();
`;
