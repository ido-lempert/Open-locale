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

  @Get('host.js')
  hostJs(@Res() res: Response) {
    res
      .type('application/javascript')
      .setHeader('Cache-Control', 'no-cache')
      .send(HOST_JS);
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
.ok{color:#15803d}
.bar{display:flex;gap:.5rem;align-items:baseline;border-bottom:1px solid #e5e7eb;padding-bottom:.35rem;margin-bottom:.5rem}
ul{list-style:none;padding:0;margin:0}
li{display:flex;gap:.5rem;padding:.35rem .4rem;border-radius:6px;align-items:center;flex-wrap:wrap}
li.hl{background:#fef3c7;outline:2px solid #f59e0b}
li code{background:#f3f4f6;border-radius:4px;padding:.1rem .3rem;min-width:9rem}
li input{flex:1;min-width:10rem;padding:.3rem .45rem;font:inherit;border:1px solid #d1d5db;border-radius:6px}
li button{padding:.3rem .6rem;font:inherit}
.conflict{background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:.4rem .5rem;width:100%;font-size:.85rem}
.conflict .cur{font-style:italic}
form{display:flex;flex-direction:column;gap:.4rem;max-width:260px;margin-top:.5rem}
input,button{font:inherit}
`;

// Host-side companion snippet. A customer's page includes this and calls
// OpenLocaleEmbed.init({ iframe }); it runs the ping handshake, forwards
// clicks on elements annotated with data-ol-key as ol:highlight messages,
// and re-emits frame replies as CustomEvent('ol:embed'). Symmetric with the
// frame's rules: postMessage targetOrigin is ALWAYS the iframe's own origin
// (derived from iframe.src, never '*'), inbound replies are accepted only
// from that iframe's contentWindow AND that exact origin, and no credential
// ever appears in a message (the frame protocol sends none).
const HOST_JS = `(() => {
  const init = ({ iframe }) => {
    if (!iframe || !iframe.contentWindow) throw new Error('OpenLocaleEmbed.init: an iframe element is required');
    const target = new URL(iframe.src, location.href).origin;
    let ready = false;
    const send = (msg) => iframe.contentWindow.postMessage(Object.assign({ source: 'open-locale-host' }, msg), target);
    window.addEventListener('message', (event) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== target) return;
      const d = event.data;
      if (typeof d !== 'object' || d === null || d.source !== 'open-locale-embed' || typeof d.type !== 'string') return;
      if (d.type === 'ol:pong') ready = true;
      window.dispatchEvent(new CustomEvent('ol:embed', { detail: d }));
    });
    // Bounded handshake: 10 pings at 500ms, restarted on every iframe load.
    const startPings = () => {
      let n = 0;
      const t = setInterval(() => { if (ready || ++n > 10) clearInterval(t); else send({ type: 'ol:ping' }); }, 500);
    };
    iframe.addEventListener('load', () => { ready = false; startPings(); });
    startPings(); // init may run after the iframe already loaded
    document.addEventListener('click', (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest('[data-ol-key]') : null;
      const key = el && el.getAttribute('data-ol-key');
      if (key && key.length <= 500) send({ type: 'ol:highlight', key });
    }, true);
    return { send, isReady: () => ready };
  };
  window.OpenLocaleEmbed = { init };
})();
`;

// Protocol (mirrors docs/reviews/0030 and 0031): the frame answers only the
// direct parent window (event.source === window.parent), only when its origin
// is in the project's CURRENT allowlist - revalidated against the server on
// every inbound message, so origin removal silences an already-open frame -
// and only a strict message shape. Replies go to the verified event.origin,
// never '*'. Writes are NEVER triggered by host messages: saves happen only
// from the frame's own Save buttons, with the row's expected version, and the
// server re-checks membership and locale permission on every write. The token
// stays in this frame's localStorage and never appears in a payload.
const FRAME_JS = `(() => {
  const root = document.getElementById('root');
  const projectId = document.currentScript.getAttribute('data-project-id');
  const TOKEN_KEY = 'ol_embed_token';
  const qs = new URLSearchParams(location.search);
  const isEmbedded = window.parent !== window;
  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    origins: [], keys: [], identities: {}, drafts: {}, project: null, withdrawn: null,
    // Established ONLY by a verified source+origin handshake (a protocol
    // message from window.parent on an allowlisted origin). document.referrer
    // is never used: it can be suppressed, and embedding trust must fail
    // closed until the handshake happens.
    parentOrigin: null,
    branch: qs.get('branch') || 'main',
    editLocale: qs.get('locale') || null,
  };
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const api = async (path, opts = {}) => {
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(String(res.status)); e.status = res.status; e.body = body; throw e; }
    return body;
  };
  // Drafts survive trust changes: any text the user typed is kept in memory
  // and restored whenever the editing UI re-renders.
  const captureDrafts = () => {
    for (const li of root.querySelectorAll('li[data-key-id] input')) {
      const keyId = li.closest('li').getAttribute('data-key-id');
      if (li.value) state.drafts[keyId] = li.value;
    }
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
        state.withdrawn = null;
        await load();
      } catch { renderLogin('Sign-in failed.'); }
    });
  };
  const withdrawEditing = (reason) => {
    captureDrafts();
    state.withdrawn = reason;
    render();
  };
  // Revalidate trust from the server right now: fresh allowlist + membership.
  // Returns true when editing/host-answering is currently legitimate.
  const revalidate = async () => {
    let fresh;
    try {
      fresh = await api('/projects/' + projectId);
    } catch {
      withdrawEditing('Your access changed. Editing is paused; your drafts are kept. Sign in again to check your access.');
      return false;
    }
    state.origins = fresh.embedOrigins || [];
    if (state.parentOrigin && !state.origins.includes(state.parentOrigin)) {
      withdrawEditing('This host page is no longer allowlisted. Editing is paused; your drafts are kept.');
      return false;
    }
    return true;
  };
  const tFor = (k) => (k.translations || []).find((t) => t.localeCode === state.editLocale);
  const render = () => {
    const locked = isEmbedded && !state.parentOrigin && !state.withdrawn;
    const disabled = state.withdrawn || locked;
    root.innerHTML = '<header class="bar"><strong>Open-locale</strong><span class="muted">in-context - ' + esc(state.project.name) +
      ' (' + esc(state.branch) + ', editing <code>' + esc(state.editLocale) + '</code>)</span></header>' +
      (state.withdrawn ? '<p class="error" id="withdrawn">' + esc(state.withdrawn) + '</p>' : '') +
      (locked ? '<p class="error" id="locked">Editing is locked until the host page connects over the allowlisted-origin handshake.</p>' : '') +
      '<p class="muted" id="conn">Waiting for the host page. This frame answers only allowlisted origins; saves happen only here, never from host messages.</p>' +
      '<ul>' + state.keys.map((k) => {
        const t = tFor(k);
        const draft = state.drafts[k.id];
        const shown = draft !== undefined ? draft : (t ? t.value : '');
        return '<li data-key-id="' + esc(k.id) + '"><code>' + esc(k.name) + '</code>' +
          '<input aria-label="Translation" value="' + esc(shown) + '"' + (disabled ? ' disabled' : '') + '>' +
          '<button type="button" class="save"' + (disabled ? ' disabled' : '') + '>Save</button><span class="muted st"></span></li>';
      }).join('') + '</ul>' +
      (state.keys.length ? '' : '<p class="muted">No keys on this branch.</p>');
    for (const li of root.querySelectorAll('li[data-key-id]')) {
      const keyId = li.getAttribute('data-key-id');
      li.querySelector('input').addEventListener('input', (ev) => { state.drafts[keyId] = ev.target.value; });
      li.querySelector('.save').addEventListener('click', () => saveRow(li));
    }
  };
  const saveRow = async (li, forceIdentity) => {
    if (state.withdrawn) return;
    if (isEmbedded && !state.parentOrigin) return; // locked: no handshake yet
    const keyId = li.getAttribute('data-key-id');
    const key = state.keys.find((k) => k.id === keyId);
    const value = li.querySelector('input').value;
    const st = li.querySelector('.st');
    const old = li.querySelector('.conflict');
    if (old) old.remove();
    // Writes revalidate trust at save time too, not only on host messages:
    // a withdrawn origin or lost membership must not accept ongoing writes.
    if (!(await revalidate())) return;
    const identity = forceIdentity || state.identities[keyId] || { version: 0, rowId: null };
    st.textContent = 'Saving...'; st.className = 'muted st';
    try {
      const saved = await api('/projects/' + projectId + '/keys/' + keyId + '/translations', {
        method: 'PUT',
        body: { locale: state.editLocale, value, expectedVersion: identity.version, ...(identity.rowId ? { expectedRowId: identity.rowId } : {}) },
      });
      state.identities[keyId] = { version: saved.version, rowId: saved.rowId };
      delete state.drafts[keyId];
      const t = tFor(key);
      if (t) { t.value = saved.value; t.version = saved.version; } else { key.translations = (key.translations || []).concat([{ localeCode: state.editLocale, value: saved.value, version: saved.version }]); }
      st.textContent = 'Saved'; st.className = 'ok st';
    } catch (e) {
      if (e.status === 409) {
        // Re-read the current server value so the conflict UI shows truth,
        // not the value from the error body alone.
        let current = e.body && e.body.currentValue, currentVersion = e.body && e.body.currentVersion, currentRowId = e.body && e.body.currentRowId;
        try {
          const fresh = await api('/projects/' + projectId + '/keys?branch=' + encodeURIComponent(state.branch));
          const fk = fresh.find((x) => x.id === keyId);
          const ft = fk && (fk.translations || []).find((t) => t.localeCode === state.editLocale);
          if (ft) { current = ft.value; currentVersion = ft.version; currentRowId = ft.rowId; }
        } catch { /* keep error-body values */ }
        st.textContent = '';
        const box = document.createElement('div');
        box.className = 'conflict';
        box.innerHTML = '<strong>Conflict:</strong> this translation changed on the server. Current value: <span class="cur"></span>' +
          '<div><button type="button" class="use-latest">Use latest</button> <button type="button" class="overwrite">Overwrite with my text</button></div>';
        box.querySelector('.cur').textContent = current == null ? '(empty)' : current;
        box.querySelector('.use-latest').addEventListener('click', () => {
          li.querySelector('input').value = current || '';
          state.identities[keyId] = { version: currentVersion || 0, rowId: currentRowId || null };
          delete state.drafts[keyId];
          box.remove();
          st.textContent = 'Loaded latest'; st.className = 'muted st';
        });
        // Overwrite re-runs saveRow, which revalidates trust and permissions
        // again before any write is attempted.
        box.querySelector('.overwrite').addEventListener('click', () => { saveRow(li, { version: currentVersion || 0, rowId: currentRowId || null }); });
        li.appendChild(box);
      } else if (e.status === 403) {
        st.textContent = 'No write access for ' + state.editLocale; st.className = 'error st';
      } else {
        st.textContent = 'Save failed (' + e.message + ')'; st.className = 'error st';
      }
    }
  };
  const load = async () => {
    try {
      state.project = await api('/projects/' + projectId);
      state.origins = state.project.embedOrigins || [];
      if (!state.editLocale) state.editLocale = state.project.baseLocale;
      state.keys = await api('/projects/' + projectId + '/keys?branch=' + encodeURIComponent(state.branch));
      state.identities = {};
      for (const k of state.keys) { const t = tFor(k); state.identities[k.id] = t ? { version: t.version || 0, rowId: t.rowId || null } : { version: 0, rowId: null }; }
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
  window.addEventListener('message', async (event) => {
    if (!state.project) return; // unauthenticated frames expose nothing
    if (event.source !== window.parent) return; // the direct embedder only
    if (!isHostMessage(event.data)) return;
    // Live revalidation on every inbound message: a removed origin silences
    // the open frame AND pauses its editing UI; lost membership pauses too.
    let fresh;
    try {
      fresh = await api('/projects/' + projectId);
      state.origins = fresh.embedOrigins || [];
    } catch {
      withdrawEditing('Your access changed. Editing is paused; your drafts are kept. Sign in again to check your access.');
      return;
    }
    if (!state.origins.includes(event.origin)) {
      if (!state.withdrawn) withdrawEditing('This host page is no longer allowlisted. Editing is paused; your drafts are kept.');
      return;
    }
    // Verified source+origin handshake: THIS is what establishes the parent
    // origin and unlocks editing (fail-closed until now).
    if (!state.parentOrigin) { state.parentOrigin = event.origin; render(); }
    if (state.withdrawn) { state.withdrawn = null; render(); } // trust restored: re-enable with drafts intact
    const reply = (msg) => event.source.postMessage(Object.assign({ source: 'open-locale-embed' }, msg), event.origin);
    const conn = document.getElementById('conn');
    if (conn) conn.textContent = 'Connected to host ' + event.origin;
    if (event.data.type === 'ol:ping') {
      reply({ type: 'ol:pong', keys: state.keys.length, branch: state.branch, locale: state.editLocale });
    } else if (event.data.type === 'ol:highlight') {
      const key = state.keys.find((k) => k.name === event.data.key);
      const li = key && document.querySelector('li[data-key-id="' + CSS.escape(key.id) + '"]');
      if (li) { li.classList.add('hl'); li.scrollIntoView({ block: 'nearest' }); }
      reply({ type: 'ol:highlighted', key: event.data.key, found: !!key });
    }
  });
  if (state.token) load(); else renderLogin();
})();
`;


