# Final Review Fixes Report (Admin)

Date: 2026-06-26
Branch: feature/custom-admin

---

## C1 — block.type XSS (admin/blocks-editor.js)

**Before:**
```js
ctrls.innerHTML = `<strong>${block.type}</strong>`;
```

**After:**
```js
const typeLabel = document.createElement('strong'); typeLabel.textContent = block.type;
ctrls.appendChild(typeLabel);
```

Safe DOM construction; no innerHTML from untrusted file data.

---

## I1 — block sub-forms: select + image field types (admin/blocks-editor.js, admin/forms.js)

**blocks-editor.js signature change:**
```js
// Before:
export function renderBlocks(container, blocks, scope, registry)
// After:
export function renderBlocks(container, blocks, scope, registry, ctx)
```

New `select` branch in `blockItem`:
```js
} else if (f.type === 'select' && Array.isArray(f.options)) {
  const sel = document.createElement('select');
  sel.innerHTML = f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  sel.value = block[f.name] || '';
  sel.addEventListener('change', () => { block[f.name] = sel.value; });
  field.appendChild(sel);
}
```

New `image` branch with ctx guard:
```js
} else if (f.type === 'image') {
  // text input + conditional upload button/thumb via ctx.attachImageField
}
```

**forms.js:**
```js
// Before:
ctx.renderBlocks(host, model[field.name], field.scope, ctx.registry);
// After:
ctx.renderBlocks(host, model[field.name], field.scope, ctx.registry, ctx);
```

---

## I2 — auth.js signIn() hang + provider check (admin/auth.js)

**Before:** No closed-popup detection; no `d.provider` check; promise hangs if user closes popup.

**After:** Added `setInterval` poll at 500ms; rejects with `'Sign-in cancelled'` if `popup.closed`; clears poll on success; added `d.provider === 'github'` guard to `onMessage`.

---

## M5 — dirty flag on structural mutations (admin/blocks-editor.js, admin/forms.js)

**blocks-editor.js:** `mk(...)` buttons dispatch `new Event('input', { bubbles: true })` on `ctrls` after rerender; add-block `<select>` dispatches on `container`.

**forms.js (listEl):** `mk(...)` buttons dispatch `new Event('input', { bubbles: true })` on `host` after rerender; `+ Add` button dispatches on `host`.

---

## M6 — callback.js postMessage target origin (api/callback.js)

**Before:**
```js
if (window.opener) window.opener.postMessage(data, "*");
```

**After:**
```js
if (window.opener) window.opener.postMessage(data, "https://7mxd.github.io");
```

---

## I3 — populate signed-in user (admin/app.js)

Added immediately after `showApp()`:
```js
(async () => {
  try {
    const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json' } });
    if (r.ok) { const u = await r.json(); document.getElementById('who').textContent = u.login ? '@' + u.login : ''; }
  } catch(_) {}
})();
```

Non-blocking IIFE; silently swallows all failures.

---

## Verification

### node --check
```
node --check admin/auth.js admin/blocks-editor.js admin/forms.js admin/app.js api/callback.js
(no output — all 5 files pass)
```

### npm test
```
# tests 53
# pass 53
# fail 0
```

### curl /admin/
```
HTTP 200
```
