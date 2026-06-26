# Project B — Custom GitHub-Backed Admin

**Date:** 2026-06-26
**Status:** Design — awaiting review
**Depends on:** Project A (finalized data schema + `data/blocks-registry.json`). Project A is merged.

---

## 1. Summary

Replace the Decap CMS admin with a custom, no-build, vanilla admin app under `admin/`. It authenticates the owner via GitHub OAuth (reusing the existing Vercel backend), reads and writes `data/*.json` and `assets/` images through the GitHub Contents API, and commits directly to `main` (which redeploys GitHub Pages). Forms are generated from a declarative schema, with content-block sub-forms generated from the same `data/blocks-registry.json` the site renderer uses. Single source of truth, zero runtime dependencies, full git history.

---

## 2. Goals & non-goals

### Goals
- A clean, owner-only content editor for every `data/*.json` file, including the Project-A fields that drive the graph (`cluster`, `tags`).
- Image upload to `assets/` from the browser.
- Direct-commit-to-`main` publishing with clear confirmation and safe conflict handling.
- No build step, zero runtime dependencies (matches the site).
- Block editing generated from `data/blocks-registry.json` so the site and admin never drift.
- Pure logic unit-tested with the existing Node `node:test` harness.

### Non-goals (v1)
- Editorial/PR/draft-branch workflow (direct to `main`).
- Multi-user / role management (GitHub repo permissions are the gate).
- Live in-admin preview of the rendered site.
- Rich-text WYSIWYG (textareas remain plain, matching current data).
- Editing files outside `data/*.json` and `assets/` (e.g., code, CLAUDE.md).

---

## 3. Architecture

No-build vanilla ES modules under `admin/`, loaded via `<script type="module">`.

**Files (created):**
- `admin/index.html` — shell: a login view and an app view (sidebar + form panel). `noindex`.
- `admin/app.js` — entry point: boot, route between login/app, mount the selected collection.
- `admin/auth.js` — OAuth popup flow + token storage/retrieval (sessionStorage).
- `admin/github.js` — GitHub Contents API client: `getFile`, `putFile`, `putBinary`; carries `sha` for updates.
- `admin/schema.js` — declarative collection + field definitions (pure data).
- `admin/forms.js` — pure schema→form-model helpers + DOM form renderer.
- `admin/blocks-editor.js` — block list editor (add/remove/reorder), sub-forms from `blocks-registry.json`.
- `admin/media.js` — image selection, size guard, base64 encode, upload via `github.js`.
- `admin/validate.js` — pure validation (required fields, JSON shape).
- `admin/admin.css` — styles, reusing the site's `css/tokens.css` theme variables.

**Files (modified):**
- `api/callback.js` — change the success `postMessage` to a simple `{type:'oauth:success', token, provider:'github'}` (drop the Decap-specific `authorization:github:success:` string).

**Files (removed):**
- `admin/config.yml` (Decap config), and the Decap loader in the old `admin/index.html` (replaced by the new shell).

**Pure vs DOM boundary:** `schema.js`, `validate.js`, the encode/serialize helpers, and the form-model + GitHub-payload builders in `forms.js`/`github.js` must not reference `window`/`document`/`fetch` at module top level, so Node can import and test them. `fetch` is injected (`github.js` takes a `fetchFn`/token), mirroring `data.js`'s `loadData(fetchFn)`.

---

## 4. Authentication

- Reuse the Vercel OAuth backend: `/auth` (redirect to GitHub with `repo,user` scope) and `/callback` (code→token exchange).
- Flow: admin opens `/auth` in a popup → GitHub consent → `/callback` `postMessage`s `{type:'oauth:success', token, provider:'github'}` to the opener → `auth.js` stores the token in **`sessionStorage`** (key `gh_token`) and closes the popup.
- The token is `repo`-scoped. **Access control is GitHub's:** any GitHub user can obtain a token, but the Contents API rejects writes unless they have write access to `7mxd/7mxd.github.io` — i.e., only the owner. The admin still works read-only for others, which is acceptable (the data is public anyway); writes fail with a clear "you don't have write access" message.
- `sessionStorage` (not `localStorage`): the token is cleared when the tab closes, limiting exposure of a powerful token. A "Sign out" button clears it.
- Origin check: `auth.js` validates `event.origin` against the known Vercel callback origin before accepting the token.

---

## 5. GitHub data flow

`github.js` wraps the Contents API (`https://api.github.com/repos/7mxd/7mxd.github.io/contents/<path>`):
- `getFile(path)` → `{ content (decoded JSON/text), sha }` (GET; base64-decode `content`).
- `putFile(path, contentString, sha, message)` → commit (PUT with base64 `content`, `sha`, `message`, `branch:'main'`).
- `putBinary(path, base64, sha|null, message)` → commit a binary (image) file.

**Editing cycle:** on opening a collection, `getFile('data/<name>.json')` loads content + `sha` into an in-memory model. **Save** serializes the model to pretty JSON (2-space, matching existing files) and `putFile`s it with the captured `sha` and a message like `admin: update <collection>`. On success, capture the new `sha` (so consecutive saves work) and show "published ✓".

**Conflict handling:** if `putFile` returns `409`/422 (stale `sha`), the admin re-fetches the file, warns "this file changed since you loaded it", and lets the user reload (discarding local edits) or overwrite (re-PUT with the fresh `sha`). No silent clobber.

**JSON formatting:** serialize with `JSON.stringify(obj, null, 2) + "\n"` to match the repo's existing style and keep diffs clean.

---

## 6. Schema-driven forms

`schema.js` declares each collection: its file path, a label, and an ordered list of fields. Field types: `string`, `text` (multiline), `boolean`, `select` (options), `list` (repeatable of a sub-schema or primitive), `object` (nested fields), `image` (uses `media.js`), and `blocks` (uses `blocks-editor.js`, scoped to a section).

Collections covered (full parity with current `config.yml` plus Project-A fields):
- **profile** — name, title, contact{email, phone, location, linkedin{url,label}, github{url,label}}.
- **summary** — content (text).
- **settings** — cv{path(image/file), downloadName}, siteTitle, navLogo, meta{title,description,keywords,url}, sections{<name>{enabled}} , statuses{<key>{label,glyph,tone}}, theme(select: auto/light/dark), **graph.clusters{math|data|engineering{label,color}}**.
- **education** — list of {institution, logo(image), degree, startDate, endDate, displayDate, grade, **cluster(select)**, blocks(scope=education)}.
- **experience** — list of {company, logo{default,light,dark images}, location, **cluster(select)**, **tags(list of string)**, roles(list of {title, startDate, endDate, displayDate, blocks(scope=experience)})}.
- **projects** — list of {title, status(select), **cluster(select)**, **tags(list of string)**, image(optional), links{github,webapp,ios,android,extra(list of {label,url})}, blocks(scope=project)}.
- **skills** — categories(list of {name, type(select: tags/list/languages), items(list of {name, level?})}).

`forms.js` has a **pure** `buildFormModel(schema, data)` (produces a normalized editable model) and `readFormModel()` (DOM→data), plus a DOM renderer that walks the schema. Block fields delegate to `blocks-editor.js`.

**Block sub-forms** are generated from `data/blocks-registry.json`: for the active scope (project/experience/education), the editor offers the allowed block types; each block's fields come from the registry entry. Adding a block type to the registry (+ a site renderer) automatically makes it editable here — no admin change needed.

---

## 7. Images (`media.js`)

- An `image` field shows the current value (path + thumbnail) and controls: pick a file, or choose from existing `assets/` (listed via `getFile`/Contents API directory listing).
- On pick: read as base64, enforce a size cap (e.g., ≤ 2 MB) and allowed types (png/jpg/svg/webp), then `putBinary('assets/<filename>', base64, existingSha|null, 'admin: upload <filename>')` and set the field to `assets/<filename>`. Filename collisions are surfaced (overwrite vs rename).
- Pure helpers (`fileToBase64` wrapper aside): filename sanitization, type/size validation — unit-tested.

---

## 8. UX / layout

- **Login view:** centered "Sign in with GitHub" button; explains it commits to the repo.
- **App view:** left sidebar lists collections; main panel renders the selected collection's form. Top bar shows repo/branch, signed-in user, Sign out.
- **Save:** per-collection Save button; states: idle / saving (spinner, disabled) / published ✓ / error (message). Unsaved-changes indicator + navigation guard (`beforeunload` and in-app switch confirm).
- **Theming:** reuse `css/tokens.css` variables; light/dark consistent with the site. `admin/` remains `noindex`.
- **Errors:** network/auth/permission/conflict errors surface as inline banners with actionable text (e.g., "No write access with this GitHub account").

---

## 9. Testing & verification

Hybrid TDD with the existing `node:test` harness (dev-only, not shipped):
- **Unit (pure):** `schema.js` integrity (every collection/field well-formed); `validate.js` (required-field + shape checks); `forms.js` `buildFormModel`/`readFormModel` round-trips; `github.js` payload builders (path, base64 encode/decode, PUT body with sha/branch/message); `media.js` filename/type/size validation; JSON serialization matches the 2-space + trailing-newline style.
- **Manual:** OAuth popup flow; real read of `data/*.json`; a real edit + commit to a test branch first, then `main`; image upload; conflict (edit a file on GitHub, then save → expect conflict warning); both themes; signed-out/read-only behavior; permission-denied path.
- **Budget:** admin JS+CSS kept lean (target < 60KB uncompressed); it's not on the public critical path but should stay dependency-free.

---

## 10. Risks & mitigations
- **Token exposure:** `repo`-scoped token in `sessionStorage` (session-lived), origin-checked message, sign-out clears it. Documented as owner-only.
- **Accidental overwrite/conflict:** mandatory `sha` on writes + 409 handling (§5).
- **Registry/schema drift:** block forms derive from `blocks-registry.json` (shared with the site); top-level schema in `schema.js` is the one place to update for new top-level fields.
- **Large images bloating the repo:** size cap + type allowlist in `media.js`.
- **Callback format change breaking nothing else:** Decap is being removed, so changing `api/callback.js`'s message format has no other consumer.

## 11. Deliverables
- New `admin/` app (files in §3), updated `api/callback.js`, removed Decap config/loader.
- Unit tests under `test/` for the pure admin logic.
- README note: how to run/sign in to the admin and that it commits to `main`.

## 12. Out of scope → future
- Draft-branch / PR workflow, live preview, WYSIWYG, multi-user — all deferred; the direct-commit core is built first and these can layer on later.
