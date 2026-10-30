// Zero-dependency rendered API reference: inline HTML/CSS/JS served at
// GET /api/docs, reading the same openapi.json the consistency tests guard.
// No external assets (works offline, no CDN). Spec data is injected via
// textContent only - never innerHTML - so spec strings cannot inject markup.
export const DOCS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open-locale API reference</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 900px; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin-top: 1.6rem; border-bottom: 1px solid #ddd; padding-bottom: .2rem; }
  .op { display: flex; gap: .6rem; align-items: baseline; padding: .3rem 0; font-size: .92rem; }
  .m { font-weight: 700; font-family: ui-monospace, monospace; min-width: 3.4rem; }
  .get { color: #067a3f; } .post { color: #1756b8; } .put { color: #8a5a00; } .delete { color: #b02a2a; } .patch { color: #6a3fb0; }
  code { font-family: ui-monospace, monospace; } .sum { color: #444; } .sec { color: #888; font-size: .8rem; }
</style>
</head>
<body>
<h1 id="title">Open-locale API reference</h1>
<p class="sum" id="meta">Loading&hellip;</p>
<div id="groups"></div>
<script>
fetch('openapi.json').then(function (r) { return r.json(); }).then(function (spec) {
  document.getElementById('meta').textContent =
    spec.info.title + ' ' + spec.info.version + ' - ' + Object.keys(spec.paths).length + ' paths. JSON spec: openapi.json. Auth: Bearer session JWT or X-Api-Key token unless marked public.';
  var byTag = {};
  Object.keys(spec.paths).sort().forEach(function (path) {
    Object.keys(spec.paths[path]).forEach(function (method) {
      var op = spec.paths[path][method];
      var tag = (op.tags && op.tags[0]) || 'other';
      (byTag[tag] = byTag[tag] || []).push({ method: method.toUpperCase(), path: path, op: op });
    });
  });
  var host = document.getElementById('groups');
  Object.keys(byTag).sort().forEach(function (tag) {
    var h = document.createElement('h2');
    h.textContent = tag + ' (' + byTag[tag].length + ')';
    host.appendChild(h);
    byTag[tag].forEach(function (row) {
      var div = document.createElement('div');
      div.className = 'op';
      var m = document.createElement('span');
      m.className = 'm ' + row.method.toLowerCase();
      m.textContent = row.method;
      var c = document.createElement('code');
      c.textContent = row.path;
      var s = document.createElement('span');
      s.className = 'sum';
      s.textContent = row.op.summary || '';
      var pub = document.createElement('span');
      pub.className = 'sec';
      pub.textContent = row.op.security ? '' : 'public';
      div.appendChild(m); div.appendChild(c); div.appendChild(s); div.appendChild(pub);
      host.appendChild(div);
    });
  });
  document.title = 'Open-locale API reference - ' + Object.keys(spec.paths).length + ' paths';
}).catch(function (e) {
  document.getElementById('meta').textContent = 'Failed to load openapi.json: ' + e;
});
</script>
</body>
</html>
`;
