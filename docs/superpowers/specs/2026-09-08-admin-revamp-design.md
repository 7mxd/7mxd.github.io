# Admin revamp — design

**Date:** 2026-09-08
**Status:** approved, ready for an implementation plan
**Supersedes nothing.** Extends `docs/superpowers/specs/2026-06-26-custom-admin-design.md`,
which describes the admin as first built.

## 1. Why now

The public site was rebuilt as the plain editorial page and shipped through
September 2026. The admin under `admin/` was not touched. Auditing it against
the site it edits found four independent failures, one of which means nobody can
use it at all and one of which destroys content.

Ahmed's requirement, in his words: *"The admin page should allow me add all
currently added items again in the same structure… All items should be editable
through the admin page, including the table."* That is a completeness
requirement, not a list of fixes, and section 5 turns it into a test.

## 2. What is broken today

Each of these was reproduced, not inferred.

### 2.1 Sign-in cannot complete

`api/callback.js` line 56 posts the OAuth result with
`window.opener.postMessage(data, "https://7mxd.github.io")`, and `vercel.json`
allows CORS from that origin only. The apex now 301-redirects to
`www.7mxd.me` — confirmed with a request — so the admin always runs on the www
origin and the browser silently discards a message addressed to the other one.
The OAuth endpoint itself is healthy; it returns a 302 to GitHub.

Nothing surfaces. The popup closes and `signIn()` rejects with "Sign-in
cancelled", which is indistinguishable from the user closing the window.

### 2.2 The styling is stranded on the retired design

`admin/admin.css` links `../css/tokens.css` but asks for token names that the
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
dialects of the same field vocabulary, and two separate form renderers each
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

1. Sign-in works at `www.7mxd.me`.
2. The admin looks like the site, in both themes, and cannot drift from it again.
3. Every shape the site can render is creatable and editable, proven by a test.
4. A photograph can be added from a phone, end to end, with no developer step.
5. The block editor never destroys content.

## 4. Non-goals

- **Live preview.** Attractive, and deliberately deferred: it is a second
  surface to build and maintain, and a deploy is minutes away. Revisit if the
  admin gets used enough to want it.
- **The hosting move to Vercel.** Agreed separately and scheduled after this.
  Section 6.1 is a patch that the move will later delete.
- **CI.** The project has none and this does not introduce any.
- **Editing `blocks-registry.json` through the UI.** It is the schema, not
  content. It stays hand-edited, as `UNMANAGED_DATA_FILES` already records.

## 5. The completeness rule

> Every field reachable from `data/*.json` must have a declared editor, and
> every block type in the registry must be constructible.

Enforced by a new test that walks the real content files rather than a fixture:

1. For each managed collection, traverse the actual JSON and collect every key
   path that carries a value.
2. Assert `admin/schema.js` declares a field for each one. A key in the data
   with no declared field is the exact defect that silently deletes content on
   save, which `admin-roundtrip.test.js` already catches for whole fields; this
   extends the guarantee to nested and newly-added keys.
3. For each block type in `blocks-registry.json`, assert every declared field
   has a type the shared renderer implements, and that `newBlock()` produces a
   value of the right shape for it.
4. Assert every block type's `scope` names at least one collection that
   actually declares a `blocks` field with that scope, so a block type cannot
   exist that nothing can hold.

This test is the requirement. If it passes, "everything is touchable" is true by
construction rather than by inspection.

## 6. Design

### 6.1 Sign-in

Change the two origin literals from `https://7mxd.github.io` to
`https://www.7mxd.me`:

- `api/callback.js`, the `postMessage` target
- `vercel.json`, both `Access-Control-Allow-Origin` headers

Requires a Vercel redeploy, which is Ahmed's to run. The hosting move will make
both same-origin and remove the need for either.

Additionally, `admin/auth.js` currently reports a discarded message and a
user-closed popup identically. Distinguish them: if the popup closes without a
message, say so; if a message arrives from an unexpected origin, say that
instead of ignoring it. A silent failure cost this project a working admin for
an unknown number of weeks.

### 6.2 One design system, not two

`admin/index.html` loads `css/tokens.css` and `css/base.css` — the same files,
in the same order, as the site — followed by a small `admin/admin.css` for what
a form needs and a reading page does not: the collection sidebar, fieldsets, the
save bar, list-item controls.

`admin.css` declares **no colour, no font family, and no font size of its own**.
Everything comes from the tokens. A guard test asserts this by parsing
`admin/admin.css` for hex literals, `rgb(`, `font-family` and `font-size`
declarations that are not `var(...)`, mirroring how `test/css-contract.test.js`
already polices the site's stylesheets.

Consequences that fall out for free: the blue palette, Source Serif and Public
Sans, dark mode, `prefers-contrast`, `prefers-reduced-motion`, focus rings.

The admin is excluded from `test/budget.test.js`, which measures `css/` and
`js/` only. It is not on the public critical path.

### 6.3 One field vocabulary, one renderer

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

`data/blocks-registry.json` migrates to it. Two changes to real data:

- `callout.tone.options` becomes `[{label:'Note',value:'note'}, …]`
- `benchmark.rows` becomes `{ type:'list', fields:[ {name:'label',type:'string',required:true}, {name:'value',type:'string',required:true}, {name:'highlight',type:'boolean'} ] }`
- `coursework.items` becomes `{ type:'list', itemField:{name:'item',type:'string'} }`

The field renderer is extracted into `admin/fields.js` and both `forms.js` and
`blocks-editor.js` call it; the two files stay, each keeping only its own
concern — a collection form, a block list. Today they each carry a private copy
of field rendering and the copies diverge: `forms.js` understands `itemField`,
the block editor does not; the block editor handles `image` upload, `forms.js`
has its own version. One renderer removes the whole bug class rather than
patching two instances of it.

The site's own `js/blocks.js` renderer is unaffected: it dispatches on block
`type` and reads block values, not registry field declarations.

### 6.4 Milestones and metrics become managed

Added to `COLLECTIONS` and removed from `UNMANAGED_DATA_FILES`:

**milestones** — list on `items`, fields: `id` (required), `kind`
(select: certification, award, volunteering), `date` (YYYY-MM), `title`
(required), `org`, `note` (text), `order` (number), `link`
(object: `url`, `label`), `images` (the shared image list).

**metrics** — list on `items`, fields: `value` (required), `label` (required).

`admin-roundtrip.test.js` covers new collections automatically: it iterates
`COLLECTIONS`, so both are checked the moment they are declared.

### 6.5 Photographs, processed in the browser

A new `admin/photos.js` does what `tools/process_photos.py` does, using only the
Canvas API:

1. `createImageBitmap(file, { imageOrientation: 'from-image' })` applies the
   EXIF rotation to the pixels. This is the same bug the Python tool carried
   until this month, so it is stated rather than assumed.
2. Draw to a canvas at 1600 and again at 800 on the long edge, `LANCZOS`-
   equivalent smoothing on.
3. `canvas.toBlob('image/jpeg', 0.82)` — the same quality the Python tool uses.
   Re-encoding through a canvas drops all metadata, which is the same guarantee
   the Python tool gets by rebuilding from raw pixels.
4. Commit both derivatives to
   `assets/photos/derived/<slug>-1600.jpg` and `-800.jpg`.
5. Write `src`, `srcSmall`, `width`, `height`, `widthSmall` into the model from
   the canvases' real dimensions, so the required fields are never typed by
   hand.

**The original is not committed.** The cost is that `tools/process_photos.py`
cannot regenerate an admin-added photograph if the sizes ever change; Ahmed
still holds the original. The benefit is that adding a photograph from a phone
uploads roughly 260 KB instead of 4 MB over mobile data. Stated here because it
is a real trade, decided deliberately.

`validateImage`'s 2 MB cap applies to the input today and rejects ordinary phone
photographs. It moves to 12 MB on input, since the committed output is bounded
by the resize rather than by the source.

SVG bypasses the canvas path: it is already small, has no orientation, and
rasterising it would be a downgrade. It commits as-is to `assets/`.

### 6.6 What the interface looks like

The current shape is kept: a collection sidebar, one collection open at a time,
one Save that commits that collection. It is honest about the data model — one
file, one commit — and the conflict handling already works. Restyling it is
section 6.2's job.

Two additions the completeness rule forces:

- **Add and remove at every level.** A list of records already has add and
  remove; a list of scalars must too, and so must nested lists such as a
  benchmark's rows inside a project's blocks.
- **Reorder at every level.** The block editor has up and down controls; list
  items do not, and ordering is meaningful for pills, bullets, skills within a
  category, and photographs in a gallery — where the lead image now takes the
  wide slot.

The sidebar gains the two new collections, so it lists nine.

## 7. File structure after the change

```
admin/
  index.html        loads tokens.css, base.css, admin.css
  admin.css         layout only; no colour, font family or size
  app.js            unchanged in shape: boot, sidebar, select, save
  auth.js           + distinguishes a discarded message from a closed popup
  github.js         unchanged
  lib.js            + raised image cap
  schema.js         + milestones, + metrics
  fields.js         NEW — the one field renderer
  forms.js          collection form, built on fields.js
  blocks-editor.js  block list, built on fields.js
  blocks-model.js   unchanged
  forms-model.js    unchanged
  photos.js         NEW — EXIF, resize, encode, commit
  media.js          shrinks to the SVG and non-photo path
  validate.js       + list-of-scalars validation
```

## 8. Testing

New:

- `admin-completeness.test.js` — section 5.
- `admin-css-contract.test.js` — section 6.2.
- `admin-fields.test.js` — the shared renderer: every declared type produces a
  control, a list of records round-trips through the editor unchanged, and a
  benchmark's rows survive an edit. This is the regression guard for 2.3.
- `admin-photos.test.js` — the resize maths (long-edge cap, aspect preserved,
  the derived dimensions written into the model). Canvas encoding itself is a
  browser API and is exercised by hand, not in Node.

Extended:

- `admin-roundtrip.test.js` picks up milestones and metrics automatically.
- `admin-schema.test.js` gains the vocabulary rules from 6.3.

## 9. Risks

- **The Vercel redeploy is not mine to run.** Everything else can be built and
  tested, but sign-in cannot be verified end to end until Ahmed redeploys.
  Implementation should not block on it.
- **Canvas JPEG output differs from Pillow's.** Sizes and bytes will not match
  the Python tool exactly. Acceptable: both target quality 82 and the visual
  result is equivalent. Do not add a test asserting byte equality.
- **`createImageBitmap`'s `imageOrientation` option** is well supported in
  current Safari and Chrome but should be feature-detected, falling back to
  drawing without rotation and warning rather than silently shipping a sideways
  photograph.
- **The registry migration touches a file the site loads.** Checked rather than
  assumed: `js/data.js` validates only that the registry is an object, and
  `js/blocks.js` dispatches on a block's `type` through its own table. Neither
  reads a field declaration, so changing declarations cannot affect rendering.
  The plan should still run the render suite across the migration, because that
  is cheap and the reasoning above is the kind that turns out to be wrong once.
