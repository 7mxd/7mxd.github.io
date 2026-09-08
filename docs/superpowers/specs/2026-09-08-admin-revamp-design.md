# Admin revamp — design

**Date:** 2026-09-08
**Status:** approved, ready for an implementation plan
**Extends** `docs/superpowers/specs/2026-06-26-custom-admin-design.md`, which
describes the admin as first built.

## 1. Why now

The public site was rebuilt as the plain editorial page and shipped through
September 2026. The admin under `admin/` was not touched. Auditing it against
the site it edits found five independent failures, one of which means nobody can
use it at all and one of which destroys content.

Ahmed's requirement, in his words: *"The admin page should allow me add all
currently added items again in the same structure… All items should be editable
through the admin page, including the table."* Followed by: *"I want the best UI
and UX."* The first is a completeness requirement, which section 5 turns into a
test. The second raised the ceiling on the design and is why sections 6.1, 6.8
and 6.9 exist.

## 2. What is broken today

Each of these was reproduced, not inferred.

### 2.1 Sign-in cannot complete

`api/callback.js` line 56 posts the OAuth result with
`window.opener.postMessage(data, "https://7mxd.github.io")`, and `vercel.json`
allows CORS from that origin only. The apex now 301-redirects to `www.7mxd.me` —
confirmed with a request — so the admin always runs on the www origin and the
browser silently discards a message addressed to the other one. The OAuth
endpoint itself is healthy; it returns a 302 to GitHub.

Nothing surfaces. The popup closes and `signIn()` rejects with "Sign-in
cancelled", which is indistinguishable from the user closing the window.

### 2.2 The styling is stranded on the retired design

`admin/admin.css` links `../css/tokens.css` but asks for token names the
editorial revamp removed: `--bg`, `--surface`, `--line`, `--font-sans`,
`--font-mono`. Every one falls through to its hardcoded fallback, so the admin
renders on `#f7f6f3` cream, with `#1d9bb8` teal on hover, in monospace
throughout. `CLAUDE.md` bans cream grounds, that exact teal, and the terminal
metaphor by name. The admin is wearing the design the site retired.

This is the failure the architecture must prevent recurring, not merely repair.

### 2.3 The block editor corrupts records

`data/blocks-registry.json` types the benchmark table's `rows` as `list`. Its
real contents are records:

```json
{ "label": "This work, iterative KRLS", "value": "0.043", "highlight": true }
```

`admin/blocks-editor.js` renders any `list` field as a textarea holding
`rows.join('\n')`, which produces three lines reading `[object Object]`, and
writes back `value.split('\n')` — replacing the records with those literal
strings. Editing the site's only table destroys it, including the flag marking
Ahmed's own result. Merely opening the project is safe; the write-back fires on
`input`.

The same fault in a second place: `admin/schema.js` writes select options as
`{label, value}` objects while `blocks-registry.json` writes them as plain
strings, and one renderer reads `.value` off both, so the callout tone dropdown
renders empty.

Both are the same root cause. **The registry and the schema speak different
dialects of one field vocabulary, and two separate form renderers each
understand only one of them.**

### 2.4 Two collections cannot be edited at all

`admin/schema.js` lists `milestones.json` and `metrics.json` in
`UNMANAGED_DATA_FILES`. Together they hold every certificate, award and
volunteering entry on the timeline, and all four "By the numbers" figures.

### 2.5 Photograph upload is unusable

`admin/media.js` commits the raw file to `assets/<name>` and writes that path
into the field. It does not apply EXIF orientation, resize, strip metadata,
produce the 800 and 1600 derivatives the site references, or fill
`width`/`height`/`widthSmall`, which the schema marks required. It also writes
to the wrong directory: photographs live in `assets/photos/derived/`. And
`validateImage` caps input at 2 MB, below a routine phone photograph — the
Honors Day picture added this month is 2.1 MB and would have been rejected.

## 3. Goals

1. Sign-in works at `www.7mxd.me`, and fails loudly when it fails.
2. The admin looks like the site, in both themes, and cannot drift from it again.
3. Every shape the site can render is creatable and editable, proven by a test.
4. Adding an entry means saying what happened, not knowing which file it lives in.
5. A change can be seen before it is published.
6. A photograph can be added from a phone, end to end, with no developer step.
7. The block editor never destroys content.

## 4. Non-goals

- **The hosting move to Vercel.** Agreed separately and scheduled after this.
  Section 6.2 is a patch that the move will later delete.
- **CI.** The project has none and this does not introduce any.
- **Editing `blocks-registry.json` through the UI.** It is the schema, not
  content. It stays hand-edited, as `UNMANAGED_DATA_FILES` already records.
- **Committing photograph originals.** Section 6.7 explains why leaving them out
  is the better experience rather than the cheaper one.

## 5. The completeness rule

> Every field reachable from `data/*.json` must have a declared editor, and
> every block type in the registry must be constructible.

Enforced by a test that walks the real content files rather than a fixture:

1. For each managed collection, traverse the actual JSON and collect every key
   path that carries a value.
2. Assert `admin/schema.js` declares a field for each one. A key in the data
   with no declared field is the exact defect that silently deletes content on
   save, which `admin-roundtrip.test.js` already catches for whole fields; this
   extends the guarantee to nested and newly-added keys.
3. For each block type in `blocks-registry.json`, assert every declared field
   has a type the shared renderer implements, and that `newBlock()` produces a
   value of the right shape for it.
4. Assert every block type's `scope` names at least one collection that actually
   declares a `blocks` field with that scope, so a block type cannot exist that
   nothing can hold.
5. Assert every timeline kind in section 6.1 maps to a collection that exists
   and a record shape the schema declares.

This test is the requirement. If it passes, "everything is touchable" is true by
construction rather than by inspection.

## 6. Design

### 6.1 The admin is organised around the work, not the files

Today the sidebar mirrors the JSON layout, so adding a certificate requires
knowing it lives in `milestones.json` and not in `education.json`, and adding a
job requires knowing roles nest inside companies. The site's spine is the
timeline, which is assembled from four files. The admin adopts that spine.

Navigation becomes:

| Section | Backed by |
|---|---|
| **The path** | a composed list of every timeline entry, from four files |
| **Selected work** | `projects.json`, including entries not on the rail |
| **Profile** | `profile.json` |
| **About** | `summary.json` |
| **Skills** | `skills.json` |
| **Numbers** | `metrics.json` |
| **Settings** | `settings.json` |

**The path** lists every entry in the same reverse-chronological order the site
renders, each showing its date, title and kind. Opening one opens the form for
the record behind it. Adding one asks what happened and creates the right record
in the right file:

| Add… | Creates |
|---|---|
| Job | a role under a chosen or new company in `experience.json` |
| Education | an item in `education.json` |
| Project | an item in `projects.json` with `timeline: true` |
| Certificate / Award / Volunteering | an item in `milestones.json` with `kind` set |

Projects are reachable from both **The path** and **Selected work**, because on
the site they genuinely are two things: a station on the rail and an article
with blocks and photographs. Both routes open the same record and the same form.
Projects with `timeline: false`, such as the audit platform, appear only under
Selected work — which is exactly where they appear on the site.

**How the admin knows where an entry came from.** `js/timeline.js` gains a
`source: { collection, id }` on every entry it composes, set by each `from*`
function. Every record already carries a unique `id`, including roles, so the
admin resolves an entry to its record without duplicating composition logic. The
alternative — the admin building its own timeline — is the drift this whole
revamp exists to stop. Cost to the site is roughly 250 bytes uncompressed,
against 1.8 KB of remaining budget.

Saving stays one collection, one commit, as today. An entry belongs to exactly
one file, so editing it dirties exactly one.

### 6.2 Sign-in

Change the two origin literals from `https://7mxd.github.io` to
`https://www.7mxd.me`:

- `api/callback.js`, the `postMessage` target
- `vercel.json`, both `Access-Control-Allow-Origin` headers

Requires a Vercel redeploy, which is Ahmed's to run. The hosting move will make
both same-origin and remove the need for either.

`admin/auth.js` currently reports a discarded message and a user-closed popup
identically. Distinguish them: if the popup closes without a message, say so; if
a message arrives from an unexpected origin, name the origin. A silent failure
cost this project a working admin for an unknown number of weeks.

### 6.3 One design system, not two

`admin/index.html` loads `css/tokens.css` and `css/base.css` — the same files, in
the same order, as the site — then a small `admin/admin.css` for what a form
needs and a reading page does not: navigation, fieldsets, the save bar,
list-item controls.

`admin.css` declares **no colour, no font family, and no font size of its own**.
Everything comes from the tokens. A guard test asserts this by parsing
`admin/admin.css` for hex literals, `rgb(`, and `font-family` or `font-size`
declarations whose value is not a `var(...)`, mirroring how
`test/css-contract.test.js` already polices the site's stylesheets.

Consequences that fall out for free: the blue palette, Source Serif and Public
Sans, dark mode, `prefers-contrast`, `prefers-reduced-motion`, focus rings.

The admin is excluded from `test/budget.test.js`, which measures `css/` and
`js/` only. It is not on the public critical path.

### 6.4 One field vocabulary, one renderer

Both the collection schema and the block registry adopt `admin/schema.js`'s
vocabulary, which is the richer of the two and already has a passing round-trip
guard:

| Shape | Declaration |
|---|---|
| Scalar | `{ name, label, type: 'string' \| 'text' \| 'code' \| 'url' \| 'number' \| 'boolean' \| 'image' }` |
| Choice | `{ type: 'select', options: [{ label, value }] }` |
| List of scalars | `{ type: 'list', itemField: { name, label, type } }` |
| List of records | `{ type: 'list', fields: [ … ] }` |
| Record | `{ type: 'object', fields: [ … ] }` |
| Block container | `{ type: 'blocks', scope }` |

`data/blocks-registry.json` migrates to it. Three changes to declarations:

- `callout.tone.options` becomes `[{label:'Note',value:'note'}, …]`
- `benchmark.rows` becomes `{ type:'list', fields:[ {name:'label',type:'string',required:true}, {name:'value',type:'string',required:true}, {name:'highlight',type:'boolean'} ] }`
- `coursework.items` becomes `{ type:'list', itemField:{name:'item',type:'string'} }`

The field renderer is extracted into `admin/fields.js`, and `forms.js` and
`blocks-editor.js` both call it, each keeping only its own concern — a
collection form, a block list. Today they each carry a private copy of field
rendering and the copies diverge: `forms.js` understands `itemField`, the block
editor does not; the block editor handles `image` upload, `forms.js` has its own
version. One renderer removes the whole bug class rather than patching two
instances of it.

The site's renderer is unaffected. Checked rather than assumed: `js/data.js`
validates only that the registry is an object, and `js/blocks.js` dispatches on
a block's `type` through its own table. Neither reads a field declaration.

### 6.5 Milestones and metrics become managed

Added to `COLLECTIONS` and removed from `UNMANAGED_DATA_FILES`:

**milestones** — list on `items`, fields: `id` (required), `kind` (select:
certification, award, volunteering), `date` (YYYY-MM), `title` (required),
`org`, `note` (text), `order` (number), `link` (object: `url`, `label`),
`images` (the shared image list).

**metrics** — list on `items`, fields: `value` (required), `label` (required).

`admin-roundtrip.test.js` covers new collections automatically: it iterates
`COLLECTIONS`, so both are checked the moment they are declared.

### 6.6 Add and reorder at every level

The completeness rule forces two things the current editors only do in places:

- **Add and remove at every level.** A list of records has both; a list of
  scalars must too, and so must a nested list such as a benchmark's rows inside
  a project's blocks.
- **Reorder at every level.** The block editor has up and down controls; list
  items do not. Order is meaningful for pills, bullets, skills within a
  category, and photographs in a gallery — where the lead image takes the wide
  slot, so which one is first is a visible design decision.

### 6.7 Photographs, processed in the browser

A new `admin/photos.js` does what `tools/process_photos.py` does, using only the
Canvas API:

1. `createImageBitmap(file, { imageOrientation: 'from-image' })` applies the EXIF
   rotation to the pixels. This is the same bug the Python tool carried until
   this month, so it is stated rather than assumed.
2. Draw to a canvas at 1600 and again at 800 on the long edge, with image
   smoothing at high quality.
3. `canvas.toBlob('image/jpeg', 0.82)` — the same quality the Python tool uses.
   Re-encoding through a canvas drops all metadata, which is the same guarantee
   the Python tool gets by rebuilding from raw pixels.
4. Commit both derivatives to `assets/photos/derived/<slug>-1600.jpg` and
   `-800.jpg`.
5. Write `src`, `srcSmall`, `width`, `height`, `widthSmall` into the model from
   the canvases' real dimensions, so required fields are never typed by hand.

**The original is not committed.** The cost is that `tools/process_photos.py`
cannot regenerate an admin-added photograph if the sizes ever change; Ahmed
still holds the original. The benefit is that adding a photograph from a phone
uploads roughly 260 KB instead of 4 MB over mobile data. It is a UX decision
before it is a storage one.

`validateImage`'s 2 MB cap applies to the input today and rejects ordinary phone
photographs. It moves to 12 MB on input, since the committed output is bounded
by the resize rather than by the source.

SVG bypasses the canvas path: it is already small, has no orientation, and
rasterising it would be a downgrade. It commits as-is to `assets/`.

### 6.8 See it before publishing

The admin shows the real page, rendered by the real renderer, with the edited
data.

`renderAll(doc, data, timeline)` in `js/render.js` takes any document, and the
admin is same-origin with the site. So the preview is an `<iframe src="/">`,
and on each change the admin merges its edited collection over the other data
files, runs `normalizeSiteImages` and `buildTimeline`, and calls `renderAll`
against the iframe's document. It reuses `js/data.js`, `js/timeline.js` and
`js/render.js` unchanged; there is no second renderer to keep in step, because
the preview *is* the site.

This was deferred in an earlier draft on the assumption it meant building a
second surface. It does not, and the loop it replaces is a ten-minute deploy
plus a hard refresh, because GitHub Pages caches the stylesheet for four hours
while serving the page in ten minutes.

Details:

- Re-render is debounced, and scoped to the section being edited where the
  section is known, so typing stays responsive.
- Validation errors suspend the preview with the last good render left on
  screen, rather than rendering a half-built record.
- On a phone the preview is a panel you switch to, not a split; below the
  layout breakpoint the form and the preview share the screen one at a time.

### 6.9 Errors at the field

`validateModel` already returns `{ path, message }` for every failure. Today the
save handler shows `errs[0]` as one line in the status bar, so a message like
`experience.items[0].roles[2].title: Title is required` leaves the reader to find
the field themselves.

Instead: every error renders against its own control, the first invalid control
receives focus, and the save bar says how many problems there are rather than
naming one. The path is already the address of the control, so this is a
rendering change, not new validation.

## 7. File structure after the change

```
admin/
  index.html        loads tokens.css, base.css, admin.css
  admin.css         layout only; no colour, font family or size
  app.js            boot, navigation, select, save
  nav.js            NEW — the path list and the section list
  timeline-edit.js  NEW — entry to record resolution, and the add-entry flow
  preview.js        NEW — the iframe, the merge, the debounce
  auth.js           + distinguishes a discarded message from a closed popup
  github.js         unchanged
  lib.js            + raised image cap
  schema.js         + milestones, + metrics, + timeline kind map
  fields.js         NEW — the one field renderer
  forms.js          collection form, built on fields.js
  blocks-editor.js  block list, built on fields.js
  blocks-model.js   unchanged
  forms-model.js    unchanged
  photos.js         NEW — EXIF, resize, encode, commit
  media.js          shrinks to the SVG and non-photo path
  validate.js       + list-of-scalars validation

js/timeline.js      + source: { collection, id } on every composed entry
```

## 8. Testing

New:

- `admin-completeness.test.js` — section 5.
- `admin-css-contract.test.js` — section 6.3.
- `admin-fields.test.js` — the shared renderer: every declared type produces a
  control, a list of records round-trips through the editor unchanged, and a
  benchmark's rows survive an edit. This is the regression guard for 2.3.
- `admin-timeline-edit.test.js` — every entry `buildTimeline` composes resolves
  back to exactly one record, and each add-entry kind produces a record the
  schema validates.
- `admin-photos.test.js` — the resize maths: long-edge cap, aspect preserved,
  derived dimensions written into the model. Canvas encoding is a browser API
  and is exercised by hand, not in Node.

Extended:

- `admin-roundtrip.test.js` picks up milestones and metrics automatically.
- `admin-schema.test.js` gains the vocabulary rules from 6.4.
- `test/timeline.test.js` gains `source` on every composed entry.

## 9. Risks

- **The Vercel redeploy is not mine to run.** Everything else can be built and
  tested, but sign-in cannot be verified end to end until Ahmed redeploys.
  Implementation must not block on it.
- **The preview needs the whole dataset, not one collection.** It fetches the
  other files once and caches them; a stale cache would preview against old
  neighbouring content. Refetch on collection change, and treat a fetch failure
  as "preview unavailable" rather than rendering something wrong.
- **Canvas JPEG output differs from Pillow's.** Sizes and bytes will not match
  the Python tool. Acceptable: both target quality 82 and the result is visually
  equivalent. Do not write a test asserting byte equality.
- **`createImageBitmap`'s `imageOrientation` option** is well supported in
  current Safari and Chrome but must be feature-detected, falling back to
  drawing without rotation and warning, rather than silently shipping a sideways
  photograph.
- **Two routes to a project** means two places that can open the same record.
  They must share one form and one dirty-state, or an edit made in one will be
  silently discarded by the other.
- **The site's budget is at 34.2 KB of 36 gzipped.** The `source` field is small
  but the margin is not large; the plan should measure after adding it rather
  than assume.
