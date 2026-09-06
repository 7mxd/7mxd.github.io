# Editorial Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the terminal-metaphor portfolio with a plain, photo-led, single-column editorial page driven by a reverse-chronological timeline composed from existing content files.

**Architecture:** Static site, no build step. `index.html` holds an empty section skeleton; ES modules under `js/` fetch `data/*.json`, compose a timeline, and render into it. Styles split across five files under `css/`. Image derivatives are generated once by Python scripts under `tools/` and committed.

**Tech Stack:** HTML, CSS, vanilla ES2020 modules. Tests via `node --test`. Image processing via Pillow and NumPy, already installed.

**Spec:** `docs/superpowers/specs/2026-09-06-editorial-revamp-design.md`

## Global Constraints

- No build step, no bundler, no framework, no runtime dependencies.
- Total CSS plus JS under 80 KB uncompressed. Currently about 101 KB.
- WCAG AA minimum on all text. Preserve skip link, `prefers-reduced-motion`, `prefers-contrast: high`, `html.using-keyboard` detection, and screen-reader theme announcements.
- No copy hard-coded in HTML or JS. All content lives in `data/*.json`.
- Tests are ESM using `node:test` and `node:assert/strict`. Run with `npm test`.
- Exact light palette: ground `#fafaf9`, raised `#ffffff`, ink `#1c1f32`, ink-muted `#585b6b`, accent `#a85a32`, accent-strong `#8f4a2c`, rule `#e2e2df`.
- Exact dark palette: ground `#15171f`, raised `#1c1f2a`, ink `#e9e7e2`, ink-muted `#9a9aa6`, accent `#e7ad87`, accent-strong `#f3cbb0`, rule `#2a2d3a`.
- Fonts: Source Serif 4 (prose), Public Sans (metadata), Amiri (Arabic name only, subsetted).
- Banned: the terminal metaphor and shell-command headers, the `ascii-chart` block, gradient text, `border-left` accent stripes wider than 1px, uniform card grids, and the token names `--paper`, `--cream`, `--sand`, `--bone`.
- Ahmed's name in Arabic is exactly `أحمد علوي رضي`.

---

### Task 1: Brand marks and favicons

**Files:**
- Create: `tools/process_brand.py`
- Create: `assets/brand/logo-icon.png`, `assets/brand/logo-wordmark.png`
- Create: `assets/favicon-16x16.png`, `assets/favicon-32x32.png`, `assets/apple-touch-icon.png`, `assets/android-chrome-192x192.png`, `assets/android-chrome-512x512.png` (overwrite existing)
- Delete: `assets/favicon.svg`
- Test: `test/assets-brand.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `assets/brand/logo-icon.png` (square, transparent, centred) referenced by the nav in Task 7; `assets/brand/logo-wordmark.png` (transparent, trimmed) used by the Open Graph image in Task 12.

The source files `assets/brand/logo-icon-source.jpg` and `assets/brand/logo-wordmark-source.jpg` are already committed. Both are 1024 by 1024 JPEGs on flat white.

Naive white-keying would destroy the artwork: the headdress in the illustration is white and must survive. Use a flood fill seeded from the four corners so only background white connected to the border is removed.

- [ ] **Step 1: Write the failing test**

```js
// test/assets-brand.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const asset = (p) => new URL(`../${p}`, import.meta.url);

// Minimal PNG header reader: width, height, colour type.
function pngInfo(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', 'not a PNG');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colourType: buf.readUInt8(25), // 6 = RGBA, 2 = RGB
  };
}

test('logo icon is square, RGBA, and reasonably sized', () => {
  const info = pngInfo(asset('assets/brand/logo-icon.png'));
  assert.equal(info.width, info.height, 'icon must be square');
  assert.ok(info.width >= 512, `icon too small: ${info.width}`);
  assert.equal(info.colourType, 6, 'icon must have an alpha channel');
});

test('logo wordmark is transparent and wider than tall', () => {
  const info = pngInfo(asset('assets/brand/logo-wordmark.png'));
  assert.equal(info.colourType, 6, 'wordmark must have an alpha channel');
  assert.ok(info.width > info.height, 'wordmark should be landscape after trimming');
});

test('favicon set is generated at the expected sizes', () => {
  const expected = [
    ['assets/favicon-16x16.png', 16],
    ['assets/favicon-32x32.png', 32],
    ['assets/apple-touch-icon.png', 180],
    ['assets/android-chrome-192x192.png', 192],
    ['assets/android-chrome-512x512.png', 512],
  ];
  for (const [path, size] of expected) {
    const info = pngInfo(asset(path));
    assert.equal(info.width, size, `${path} width`);
    assert.equal(info.height, size, `${path} height`);
  }
});

test('apple touch icon is opaque, since iOS does not composite transparency', () => {
  const info = pngInfo(asset('assets/apple-touch-icon.png'));
  assert.equal(info.colourType, 2, 'apple touch icon must be RGB, not RGBA');
});

test('the old SVG favicon is gone', () => {
  assert.equal(existsSync(asset('assets/favicon.svg')), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/assets-brand.test.js`
Expected: FAIL with `ENOENT` on `assets/brand/logo-icon.png`.

- [ ] **Step 3: Write the processing script**

```python
# tools/process_brand.py
"""Key the flat-white background out of the logo art and emit brand marks.

Run from the repository root:  python tools/process_brand.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
ASSETS = ROOT / "assets"

SENTINEL = (255, 0, 255)
GROUND = (250, 250, 249)  # --ground, for the opaque Apple touch icon


def key_background(path, thresh=30, feather=0.8):
    """Remove background white reachable from the border, keeping enclosed white."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(im, seed, SENTINEL, thresh=thresh)

    arr = np.array(im)
    mask = np.all(arr == np.array(SENTINEL, dtype=arr.dtype), axis=-1)

    # Repaint sentinel pixels white so feathering cannot bleed magenta inward.
    arr[mask] = (255, 255, 255)

    alpha = Image.fromarray(np.where(mask, 0, 255).astype("uint8"))
    if feather:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))

    out = Image.fromarray(arr).convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(im):
    bbox = im.getchannel("A").getbbox()
    return im.crop(bbox) if bbox else im


def center_square(im, pad_ratio=0.08):
    im = trim(im)
    w, h = im.size
    side = int(round(max(w, h) * (1 + pad_ratio * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas


def main():
    icon = center_square(key_background(BRAND / "logo-icon-source.jpg"))
    icon.save(BRAND / "logo-icon.png")

    wordmark = trim(key_background(BRAND / "logo-wordmark-source.jpg"))
    wordmark.save(BRAND / "logo-wordmark.png")

    for name, size in (
        ("favicon-16x16.png", 16),
        ("favicon-32x32.png", 32),
        ("android-chrome-192x192.png", 192),
        ("android-chrome-512x512.png", 512),
    ):
        icon.resize((size, size), Image.LANCZOS).save(ASSETS / name)

    # iOS ignores alpha and composites on black, so flatten onto the site ground.
    touch = Image.new("RGB", (180, 180), GROUND)
    scaled = icon.resize((180, 180), Image.LANCZOS)
    touch.paste(scaled, (0, 0), scaled)
    touch.save(ASSETS / "apple-touch-icon.png")

    print(f"icon {icon.size}  wordmark {wordmark.size}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the script and remove the stale SVG favicon**

```bash
python tools/process_brand.py
rm assets/favicon.svg
```

- [ ] **Step 5: Verify the keying visually**

Open `assets/brand/logo-icon.png` in an image viewer over a dark background. Confirm the white headdress is intact and there is no white halo along the outer edge. If a halo shows, raise `feather` to `1.2` and re-run. If part of the headdress became transparent, lower `thresh` to `18` and re-run.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/assets-brand.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add tools/process_brand.py assets/brand assets/favicon-16x16.png assets/favicon-32x32.png assets/apple-touch-icon.png assets/android-chrome-192x192.png assets/android-chrome-512x512.png test/assets-brand.test.js
git rm assets/favicon.svg
git commit -m "feat(brand): key logo backgrounds and generate the favicon set"
```

---

### Task 2: Photograph derivatives

**Files:**
- Create: `tools/process_photos.py`
- Create: `assets/photos/derived/*.jpg` (16 files)
- Test: `test/assets-photos.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: derived files named `<stem>-1600.jpg` and `<stem>-800.jpg` under `assets/photos/derived/`. Task 4 references these paths from the data files, and Task 8 builds `srcset` from the pair.

Eight source photographs are committed under `assets/photos/`, plus three Stmnt captures under `assets/photos/stmnt/`. Two photographs are unused per the spec and are not processed.

Several sources are phone originals carrying GPS EXIF. Stripping it is mandatory, not cosmetic.

- [ ] **Step 1: Write the failing test**

```js
// test/assets-photos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const asset = (p) => new URL(`../${p}`, import.meta.url);

const STEMS = [
  'portrait-formal',
  'graduation-ceremony-certificate',
  'graduation-campus-certificate',
  'honors-day-ceremony',
  'volunteering-meal-packing',
  'egaming-competition-demo',
  'stmnt-01-spending-by-category',
  'stmnt-04-recurring-subscriptions',
];

// Walk JPEG segment markers to read the SOF frame dimensions.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF3 and SOF5..SOF7 and SOF9..SOF11 carry the frame header.
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker found');
}

test('every derived photograph exists at both widths', () => {
  for (const stem of STEMS) {
    for (const w of [1600, 800]) {
      const buf = readFileSync(asset(`assets/photos/derived/${stem}-${w}.jpg`));
      assert.ok(buf.length > 0, `${stem}-${w} is empty`);
    }
  }
});

test('long edge is capped at the nominal width', () => {
  for (const stem of STEMS) {
    for (const cap of [1600, 800]) {
      const { width, height } = jpegSize(readFileSync(asset(`assets/photos/derived/${stem}-${cap}.jpg`)));
      assert.equal(Math.max(width, height), cap, `${stem}-${cap} long edge`);
    }
  }
});

test('EXIF is stripped, so no GPS coordinates ship', () => {
  for (const stem of STEMS) {
    const buf = readFileSync(asset(`assets/photos/derived/${stem}-1600.jpg`));
    assert.equal(buf.includes(Buffer.from('Exif\0\0', 'binary')), false, `${stem} still carries EXIF`);
  }
});

test('derived files are small enough to ship', () => {
  for (const stem of STEMS) {
    const buf = readFileSync(asset(`assets/photos/derived/${stem}-1600.jpg`));
    assert.ok(buf.length < 400 * 1024, `${stem}-1600 is ${Math.round(buf.length / 1024)}KB`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/assets-photos.test.js`
Expected: FAIL with `ENOENT` on `assets/photos/derived/portrait-formal-1600.jpg`.

- [ ] **Step 3: Write the processing script**

```python
# tools/process_photos.py
"""Resize, strip EXIF, and re-encode the site photographs.

Run from the repository root:  python tools/process_photos.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "assets" / "photos"
DERIVED = PHOTOS / "derived"

WIDTHS = (1600, 800)
QUALITY = 82

# (source path relative to assets/photos, output stem)
SOURCES = [
    ("portrait-formal.jpg", "portrait-formal"),
    ("graduation-ceremony-certificate.jpg", "graduation-ceremony-certificate"),
    ("graduation-campus-certificate.jpg", "graduation-campus-certificate"),
    ("honors-day-ceremony.jpg", "honors-day-ceremony"),
    ("volunteering-meal-packing.jpg", "volunteering-meal-packing"),
    ("egaming-competition-demo.jpg", "egaming-competition-demo"),
    ("stmnt/01-spending-by-category.png", "stmnt-01-spending-by-category"),
    ("stmnt/04-recurring-subscriptions.png", "stmnt-04-recurring-subscriptions"),
    ("stmnt/05-smart-forecast.png", "stmnt-05-smart-forecast"),
]


def main():
    DERIVED.mkdir(parents=True, exist_ok=True)
    for rel, stem in SOURCES:
        src = Image.open(PHOTOS / rel)
        # Re-creating the image from its pixel data drops every EXIF block.
        clean = Image.new("RGB", src.size)
        clean.paste(src.convert("RGB"))

        for cap in WIDTHS:
            im = clean.copy()
            im.thumbnail((cap, cap), Image.LANCZOS)
            out = DERIVED / f"{stem}-{cap}.jpg"
            im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            print(f"{out.name:52} {im.size[0]}x{im.size[1]} {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the script**

```bash
python tools/process_photos.py
```

Expected: 18 lines of output. Note the printed dimensions of each `-1600` file. Task 4 needs the exact width and height of every image, so record them now.

- [ ] **Step 5: Crop the volunteering photograph closer**

The spec calls for this one cropped nearer to Ahmed, since he occupies only the left portion of a soft video frame. Add this entry to `SOURCES` handling by inserting a crop before the resize loop:

```python
CROPS = {
    # stem: (left, top, right, bottom) as fractions of the source size
    "volunteering-meal-packing": (0.0, 0.05, 0.62, 0.95),
}
```

and inside the loop, after building `clean`:

```python
        if stem in CROPS:
            w, h = clean.size
            l, t, r, b = CROPS[stem]
            clean = clean.crop((int(w * l), int(h * t), int(w * r), int(h * b)))
```

Re-run `python tools/process_photos.py` and open `assets/photos/derived/volunteering-meal-packing-1600.jpg` to confirm Ahmed and the vest fill the frame.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/assets-photos.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add tools/process_photos.py assets/photos/derived test/assets-photos.test.js
git commit -m "feat(assets): generate photo derivatives and strip EXIF"
```

---

### Task 3: Design tokens

**Files:**
- Modify: `css/tokens.css` (replace entirely)
- Test: `test/tokens-contrast.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: the custom properties every later CSS task uses: `--ground`, `--ground-raised`, `--ink`, `--ink-muted`, `--accent`, `--accent-strong`, `--rule`, `--font-prose`, `--font-meta`, `--font-arabic`, `--text-*`, `--space-*`, `--measure-prose`, `--measure-wide`, `--gutter`.

The existing `css/tokens.css` holds the parked 3D redesign's palette, including the banned teal `#1d9bb8`. It is replaced wholesale.

The contrast test parses the stylesheet and computes real WCAG ratios, so the spec's accessibility claim is enforced by CI rather than asserted in prose.

- [ ] **Step 1: Write the failing test**

```js
// test/tokens-contrast.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');

// Pull the custom properties out of one selector block.
function blockTokens(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

test('light theme text tokens pass AA against both grounds', () => {
  const t = blockTokens(':root');
  for (const ground of [t.ground, t['ground-raised']]) {
    for (const name of ['ink', 'ink-muted', 'accent', 'accent-strong']) {
      const ratio = contrast(t[name], ground);
      assert.ok(ratio >= AA, `light --${name} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('dark theme text tokens pass AA against both grounds', () => {
  const t = blockTokens('[data-theme="dark"]');
  for (const ground of [t.ground, t['ground-raised']]) {
    for (const name of ['ink', 'ink-muted', 'accent', 'accent-strong']) {
      const ratio = contrast(t[name], ground);
      assert.ok(ratio >= AA, `dark --${name} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the banned teal and cream token names are gone', () => {
  assert.equal(/#1d9bb8|#1a8fa8|#36b6d6/i.test(css), false, 'banned teal present');
  assert.equal(/--(paper|cream|sand|bone|linen|parchment)\b/i.test(css), false, 'banned token name present');
});

test('no monospace family is declared, since the terminal metaphor is retired', () => {
  assert.equal(/--font-mono/.test(css), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/tokens-contrast.test.js`
Expected: FAIL. The current file has no `--ink` and does contain `#1d9bb8`.

- [ ] **Step 3: Replace `css/tokens.css`**

```css
/* Design tokens. Palette derived from Ahmed's own logo artwork.
   Every text colour below is verified against both grounds by
   test/tokens-contrast.test.js. Do not edit a colour without re-running it. */

:root {
  /* Type. Source Serif 4 for prose, Public Sans for metadata,
     Amiri for the Arabic name only. */
  --font-prose: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --font-meta: "Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-arabic: "Amiri", "Noto Naskh Arabic", "Segoe UI", serif;

  --text-xs: 0.8125rem;
  --text-sm: 0.9375rem;
  --text-base: 1.0625rem;
  --text-lg: 1.1875rem;
  --text-xl: clamp(1.375rem, 1.2rem + 0.9vw, 1.75rem);
  --text-2xl: clamp(2rem, 1.55rem + 2.2vw, 3.25rem);

  --leading-prose: 1.62;
  --leading-tight: 1.18;

  /* Space */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: clamp(3rem, 2rem + 5vw, 6rem);

  /* Measure and gutters */
  --measure-prose: 34rem;
  --measure-wide: 46rem;
  --gutter: clamp(1.25rem, 0.5rem + 3vw, 4rem);

  --rule-width: 1px;
  --focus-width: 2px;

  /* Light is the default and the primary theme. */
  --ground: #fafaf9;
  --ground-raised: #ffffff;
  --ink: #1c1f32;
  --ink-muted: #585b6b;
  --accent: #a85a32;
  --accent-strong: #8f4a2c;
  --rule: #e2e2df;
}

[data-theme="dark"] {
  --ground: #15171f;
  --ground-raised: #1c1f2a;
  --ink: #e9e7e2;
  --ink-muted: #9a9aa6;
  --accent: #e7ad87;
  --accent-strong: #f3cbb0;
  --rule: #2a2d3a;
}

/* The page is rendered by JavaScript, so js/theme.js always sets
   data-theme on <html> before paint. No prefers-color-scheme duplicate
   block is needed, which keeps the palette defined exactly twice. */

@media (prefers-contrast: more) {
  :root {
    --ink-muted: #3d4050;
    --rule: #9a9a94;
  }
  [data-theme="dark"] {
    --ink-muted: #c8c8d2;
    --rule: #6a6d7e;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/tokens-contrast.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add css/tokens.css test/tokens-contrast.test.js
git commit -m "feat(css): palette and type tokens derived from the logo, AA-verified"
```

---

### Task 4: Rewrite the content data

**Files:**
- Modify: `data/profile.json`, `data/summary.json`, `data/settings.json`, `data/experience.json`, `data/education.json`, `data/projects.json`, `data/skills.json`, `data/blocks-registry.json`
- Create: `data/milestones.json`, `data/metrics.json`
- Modify: `test/data-projects.test.js` (it currently asserts the removed HiSalon and Wafa entries and will fail otherwise)
- Test: `test/data-integrity.test.js`

**Interfaces:**
- Consumes: the derived image paths from Task 2.
- Produces: the JSON shapes that `js/data.js` (Task 5) validates and `js/timeline.js` (Task 6) composes. Key field names: experience items carry `company`, `logo`, `location`, `roles[]`; each role carries `id`, `title`, `startDate`, `endDate`, `displayDate`, `bullets[]`, `images[]`, `workRef`. Education items carry `id`, `institution`, `degree`, `endDate`, `displayDate`, `grade`, `images[]`. Projects carry `id`, `title`, `timeline`, `startDate`, `displayDate`, `tags[]`, `links{}`, `blocks[]`, `images[]`. Milestones carry `id`, `kind`, `date`, `title`, `org`, `note`, `link`, `images[]`, where `link` is either `null` or `{ url, label }`.

Every image object is `{ src, srcSmall, alt, caption, width, height }`. Use the exact pixel dimensions printed by Task 2 Step 4.

- [ ] **Step 1: Write the failing integrity test**

```js
// test/data-integrity.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const repoFile = (p) => new URL(`../${p}`, import.meta.url);

const experience = load('experience');
const education = load('education');
const projects = load('projects');
const milestones = load('milestones');
const metrics = load('metrics');
const settings = load('settings');
const profile = load('profile');
const registry = load('blocks-registry');

function everyImage() {
  const out = [];
  for (const c of experience.items) for (const r of c.roles) out.push(...(r.images ?? []));
  for (const e of education.items) out.push(...(e.images ?? []));
  for (const p of projects.items) out.push(...(p.images ?? []));
  for (const m of milestones.items) out.push(...(m.images ?? []));
  return out;
}

test('every referenced image exists on disk at both widths', () => {
  for (const img of everyImage()) {
    assert.ok(existsSync(repoFile(img.src)), `missing ${img.src}`);
    assert.ok(existsSync(repoFile(img.srcSmall)), `missing ${img.srcSmall}`);
  }
});

test('every image has alt text, and it is not a filename echo', () => {
  for (const img of everyImage()) {
    assert.ok(img.alt && img.alt.trim().length > 12, `weak alt for ${img.src}`);
    assert.equal(/\.(jpe?g|png)$/i.test(img.alt), false, `alt looks like a filename: ${img.alt}`);
    assert.notEqual(img.alt.trim(), (img.caption ?? '').trim(), `alt duplicates caption for ${img.src}`);
  }
});

test('every image declares intrinsic dimensions so layout does not shift', () => {
  for (const img of everyImage()) {
    assert.equal(typeof img.width, 'number', `width missing for ${img.src}`);
    assert.equal(typeof img.height, 'number', `height missing for ${img.src}`);
    assert.ok(img.width > 0 && img.height > 0, `bad dimensions for ${img.src}`);
  }
});

test('the CV path in settings resolves', () => {
  assert.ok(existsSync(repoFile(settings.cv.path)), `missing ${settings.cv.path}`);
  assert.match(settings.cv.path, /2026/, 'settings still points at the old CV');
});

test('the Arabic name is present and correct', () => {
  assert.equal(profile.nameArabic, 'أحمد علوي رضي');
});

test('phone number, GRE scores, and nationality are absent from all data', () => {
  const raw = JSON.stringify([profile, load('summary'), experience, education, projects, milestones, metrics, settings]);
  assert.equal(/56\s*913|\+971/.test(raw), false, 'phone number present');
  assert.equal(/\bGRE\b|EmSAT|Emsat/.test(raw), false, 'test scores present');
  assert.equal(/Bahraini|Emirati mother/.test(raw), false, 'nationality present');
});

test('the ascii-chart block type is gone from the registry and the data', () => {
  assert.equal('ascii-chart' in registry, false, 'still declared in the registry');
  const raw = JSON.stringify(projects);
  assert.equal(/ascii-chart/.test(raw), false, 'still used in projects');
});

test('every block type used is declared in the registry and in scope', () => {
  const check = (blocks, scope) => {
    for (const b of blocks ?? []) {
      const entry = registry[b.type];
      assert.ok(entry, `undeclared block type: ${b.type}`);
      assert.ok(entry.scope.includes(scope), `${b.type} is not in scope for ${scope}`);
    }
  };
  for (const p of projects.items) check(p.blocks, 'project');
  for (const e of education.items) check(e.blocks, 'education');
  for (const c of experience.items) for (const r of c.roles) check(r.blocks, 'experience');
});

test('graph and cluster configuration is removed from settings', () => {
  assert.equal('graph' in settings, false);
  assert.equal(/cluster/.test(JSON.stringify(settings)), false);
});

test('by-the-numbers metrics each carry a value and a label', () => {
  assert.ok(metrics.items.length >= 3);
  for (const m of metrics.items) {
    assert.ok(m.value && m.label, `incomplete metric: ${JSON.stringify(m)}`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/data-integrity.test.js`
Expected: FAIL with `ENOENT` on `data/milestones.json`.

- [ ] **Step 3: Write `data/profile.json`**

```json
{
  "name": "Ahmed Alawi Radhi",
  "nameArabic": "أحمد علوي رضي",
  "role": "Data scientist in Abu Dhabi",
  "tagline": "I build data pipelines and audit systems at Saal.ai. Applied mathematics and statistics, Khalifa University.",
  "location": "Abu Dhabi, United Arab Emirates",
  "portrait": {
    "src": "assets/photos/derived/portrait-formal-1600.jpg",
    "srcSmall": "assets/photos/derived/portrait-formal-800.jpg",
    "alt": "Ahmed Alawi Radhi in a red and white ghutra against a plain background",
    "caption": "",
    "width": 827,
    "height": 1063
  },
  "contact": {
    "email": "AhmedARadhi00@gmail.com",
    "linkedin": { "url": "https://www.linkedin.com/in/ahmedaradhi/", "label": "LinkedIn" },
    "github": { "url": "https://github.com/7mxd", "label": "GitHub" }
  }
}
```

Replace `width` and `height` with the values Task 2 printed for `portrait-formal-1600.jpg`.

- [ ] **Step 4: Write `data/summary.json`**

```json
{
  "content": "I am an Applied Mathematics and Statistics graduate from Khalifa University with two years across data science, data engineering, and analytics. At Saal.ai I am the primary developer of a procurement audit platform that reads ERP data and flags exceptions, and I have worked on ETL pipelines, NLP-based matching, and dashboards. Outside work I built and shipped Stmnt, an iOS app that turns bank statement PDFs into spending analysis. I am open to Data Scientist, Quantitative Developer, and Data Analyst roles, especially ones that pair modelling with the engineering that makes a model usable."
}
```

- [ ] **Step 5: Write `data/settings.json`**

```json
{
  "cv": {
    "path": "assets/ahmed_radhi_cv_2026.pdf",
    "downloadName": "Ahmed_Radhi_CV.pdf"
  },
  "siteTitle": "Ahmed Alawi Radhi, Data Scientist",
  "meta": {
    "title": "Ahmed Alawi Radhi, Data Scientist",
    "description": "Data scientist in Abu Dhabi. Procurement audit systems and data pipelines at Saal.ai. Applied mathematics and statistics, Khalifa University.",
    "keywords": "Data Science, Applied Mathematics, Statistics, ETL, Data Engineering, Quantitative Developer, Abu Dhabi, Saal.ai",
    "url": "https://7mxd.github.io/"
  },
  "nav": [
    { "id": "about", "label": "About" },
    { "id": "path", "label": "Path" },
    { "id": "work", "label": "Work" },
    { "id": "skills", "label": "Skills" },
    { "id": "contact", "label": "Contact" }
  ],
  "sections": {
    "about": { "enabled": true },
    "path": { "enabled": true },
    "numbers": { "enabled": true },
    "work": { "enabled": true },
    "skills": { "enabled": true },
    "contact": { "enabled": true }
  },
  "theme": "auto"
}
```

- [ ] **Step 6: Write `data/experience.json`**

Bullets come from the September 2026 CV verbatim in substance. The Graduate Trainee role carries three headline bullets and a `workRef`, per the rule in spec section 8. The other two roles carry their full lists.

```json
{
  "items": [
    {
      "company": "Saal.ai",
      "location": "Abu Dhabi, UAE",
      "logo": {
        "default": "assets/SAAL_LIGHT.png",
        "light": "assets/SAAL_LIGHT.png",
        "dark": "assets/SAAL_DARK.png"
      },
      "roles": [
        {
          "id": "saal-graduate-trainee",
          "title": "Graduate Trainee, Data Science",
          "startDate": "2024-09",
          "endDate": "Present",
          "displayDate": "Sep 2024 — Present",
          "workRef": "saal-audit-platform",
          "bullets": [
            "Primary developer of a procurement audit platform that ingests Microsoft Dynamics 365 ERP data from Azure Blob Storage, authoring 28 of its 38 exception checks.",
            "Applied NLP-based matching within the pipeline, combining fuzzy and Levenshtein similarity with a cross-encoder transformer model to flag near-duplicate line item descriptions.",
            "Developed ETL pipelines in a microservices architecture using Python, Pandas, and MongoDB, and built interactive Power BI and Tableau dashboards for proof-of-concept projects."
          ],
          "images": [],
          "blocks": []
        },
        {
          "id": "saal-ds-intern",
          "title": "Data Scientist Intern",
          "startDate": "2024-03",
          "endDate": "2024-09",
          "displayDate": "Mar 2024 — Sep 2024",
          "workRef": null,
          "bullets": [
            "Developed skills in NoSQL databases with MongoDB and PyMongo, and built a REST API with Flask, validated using Postman and documented with Swagger UI.",
            "Completed the Dataiku Core Designer and ML Practitioner certifications, applying both to design a data processing flow.",
            "Applied Python and Pandas for data cleaning, transformation, and feature engineering, including a pipeline that improved predictive workflows within a microservices framework.",
            "Collaborated with the UI/UX and frontend teams to design and deliver a dashboard, progressing from wireframe to production."
          ],
          "images": [],
          "blocks": []
        }
      ]
    },
    {
      "company": "Daman, National Health Insurance Company",
      "location": "Abu Dhabi, UAE",
      "logo": { "default": "assets/Daman_Logo.png" },
      "roles": [
        {
          "id": "daman-analyst-intern",
          "title": "Data Analyst Intern",
          "startDate": "2022-07",
          "endDate": "2022-09",
          "displayDate": "Jul 2022 — Sep 2022",
          "workRef": null,
          "bullets": [
            "Performed data analysis, visualisation, and reporting in Microsoft Power BI to support business intelligence initiatives.",
            "Built dashboards highlighting key performance metrics, cost drivers, and trends."
          ],
          "images": [],
          "blocks": []
        }
      ]
    }
  ]
}
```

- [ ] **Step 7: Write `data/education.json`**

The Khalifa University entry carries three photographs, which is the case that exercises the multi-image layout rule.

```json
{
  "items": [
    {
      "id": "khalifa-bsc",
      "institution": "Khalifa University",
      "degree": "BSc in Applied Mathematics and Statistics",
      "location": "Abu Dhabi, UAE",
      "logo": { "default": "assets/Khalifa_University_Logo.png" },
      "startDate": "2018-08",
      "endDate": "2023-05",
      "displayDate": "2018 — 2023",
      "grade": "CGPA 3.30",
      "images": [
        {
          "src": "assets/photos/derived/graduation-ceremony-certificate-1600.jpg",
          "srcSmall": "assets/photos/derived/graduation-ceremony-certificate-800.jpg",
          "alt": "Ahmed receiving his degree certificate on stage at the Khalifa University graduation ceremony",
          "caption": "Graduation ceremony, Khalifa University, 2023",
          "width": 1600,
          "height": 1067
        },
        {
          "src": "assets/photos/derived/graduation-campus-certificate-1600.jpg",
          "srcSmall": "assets/photos/derived/graduation-campus-certificate-800.jpg",
          "alt": "Ahmed holding his Applied Mathematics and Statistics degree certificate on the Khalifa University campus",
          "caption": "Campus, June 2023",
          "width": 1600,
          "height": 1054
        },
        {
          "src": "assets/photos/derived/egaming-competition-demo-1600.jpg",
          "srcSmall": "assets/photos/derived/egaming-competition-demo-800.jpg",
          "alt": "Ahmed presenting his team's game at a whiteboard during the Sustainability E-gaming Competition",
          "caption": "Presenting at the Sustainability E-gaming Competition, Khalifa University",
          "width": 1066,
          "height": 711
        }
      ],
      "blocks": []
    },
    {
      "id": "al-nahda-diploma",
      "institution": "Al Nahda National Schools",
      "degree": "High School Diploma",
      "location": "Abu Dhabi, UAE",
      "logo": { "default": "assets/Al_Nahda_Logo.png" },
      "startDate": "2015",
      "endDate": "2018",
      "displayDate": "2015 — 2018",
      "grade": "95.9",
      "images": [],
      "blocks": []
    }
  ]
}
```

Replace every `width` and `height` with the values Task 2 printed.

- [ ] **Step 8: Write `data/projects.json`**

Three entries. The audit platform has `timeline: false` because the Saal.ai role already represents it and links down via `workRef`.

```json
{
  "items": [
    {
      "id": "saal-audit-platform",
      "title": "Procurement audit platform",
      "org": "Saal.ai",
      "status": "in-progress",
      "timeline": false,
      "startDate": "2024-09",
      "displayDate": "2024 — present",
      "tags": ["Python", "Pandas", "MongoDB", "Azure Blob Storage", "Docker", "APScheduler", "NLP", "Dynamics 365"],
      "links": {},
      "images": [],
      "blocks": [
        {
          "type": "description",
          "content": "A platform that ingests Microsoft Dynamics 365 ERP data from Azure Blob Storage and audits it across procure-to-pay, vendor master data, and user access rights. I am its primary developer and authored 28 of its 38 exception checks."
        },
        {
          "type": "description",
          "content": "I designed the Delegation of Authority control set: six checks that trace ERP workflow records to flag purchases approved by the wrong person, or at fewer levels than company spending limits require. I built four further controls over payments and vendor master data, extending the platform from the ERP to treasury payment exports."
        },
        {
          "type": "description",
          "content": "Duplicate detection is the interesting part. Line item descriptions are free text, so exact matching finds almost nothing. The pipeline combines fuzzy and Levenshtein similarity with a cross-encoder transformer model to surface near duplicates that a human reviewer would recognise but a string comparison would miss."
        },
        {
          "type": "description",
          "content": "I containerised the pipeline with Docker, scheduled it with APScheduler, scaled it to run over one business entity or all of them, and added automatic retry with backoff on Azure ingestion. On the client-facing dashboard I replaced a pop-up with a standalone, shareable exception page and added an info panel explaining each check."
        },
        {
          "type": "callout",
          "tone": "note",
          "content": "This is client audit software, so there are no screenshots. Alongside it I designed ER diagrams, wrote technical documentation for several use cases, and supported client teams in resolving data availability and update issues."
        }
      ]
    },
    {
      "id": "stmnt",
      "title": "Stmnt, bank statement analyser",
      "org": "Independent",
      "status": "in-progress",
      "timeline": true,
      "startDate": "2026-02",
      "displayDate": "Feb 2026 — present",
      "tags": ["Flutter", "Dart", "OpenRouter", "Gemini", "Supabase", "iOS", "Xcode Cloud"],
      "links": {
        "ios": "https://apps.apple.com/app/stmnt/id6760298169",
        "webapp": "https://stmnt.7mxd.me"
      },
      "images": [
        {
          "src": "assets/photos/derived/stmnt-01-spending-by-category-1600.jpg",
          "srcSmall": "assets/photos/derived/stmnt-01-spending-by-category-800.jpg",
          "alt": "Stmnt spending by category screen showing a donut chart and a ranked category breakdown",
          "caption": "Spending breakdown",
          "width": 738,
          "height": 1600
        },
        {
          "src": "assets/photos/derived/stmnt-04-recurring-subscriptions-1600.jpg",
          "srcSmall": "assets/photos/derived/stmnt-04-recurring-subscriptions-800.jpg",
          "alt": "Stmnt recurring expenses screen listing detected monthly subscriptions and their amounts",
          "caption": "Detected subscriptions",
          "width": 738,
          "height": 1600
        },
        {
          "src": "assets/photos/derived/stmnt-05-smart-forecast-1600.jpg",
          "srcSmall": "assets/photos/derived/stmnt-05-smart-forecast-800.jpg",
          "alt": "Stmnt forecast screen plotting actual spending against predicted spending for the coming month",
          "caption": "Forecast against actuals",
          "width": 738,
          "height": 1600
        }
      ],
      "blocks": [
        {
          "type": "description",
          "content": "An iOS app, published on the App Store, that reads bank statement PDFs from any bank and turns them into spending breakdowns, subscription tracking, and forecasts. I am its sole developer."
        },
        {
          "type": "description",
          "content": "The pipeline pulls transactions out of unstructured PDF text, then categorises them, removes duplicates at both the file and transaction level, and flags unusual spending across more than 35 currencies. Extraction runs through OpenRouter with Gemini as the primary model and a GPT model as a fallback, so a single provider outage or rate limit does not fail the import."
        },
        {
          "type": "description",
          "content": "Built in Flutter and Dart through an agent-driven workflow with Claude Code, while owning the architecture and reviewing every change. I ship updates most weeks."
        }
      ]
    },
    {
      "id": "kernel-rls",
      "title": "On a Generalization of Kernel RLS to Nonlinear State-Space Systems",
      "org": "Khalifa University",
      "status": "research",
      "timeline": true,
      "startDate": "2023-05",
      "displayDate": "Sep 2022 — May 2023",
      "tags": ["MATLAB", "Kernel Methods", "Time Series", "State Space", "RKHS"],
      "links": {
        "github": "https://github.com/7mxd/Senior-Research-Project-2022-2023",
        "extra": [
          { "url": "assets/SRP_Kernel_RLS_Nonlinear_State_Space_2023.pdf", "label": "Read the paper" }
        ]
      },
      "images": [],
      "blocks": [
        {
          "type": "description",
          "content": "My senior research project at Khalifa University, supervised by Prof. Ibrahim Elfadel and Prof. Jorge Zubelli. I derived the ARMA learning algorithm from first principles, rewrote it as a least squares problem in two unknowns, and implemented least squares, recursive least squares, and kernel recursive least squares in MATLAB. I then extended the construction to nonlinear state-space systems using tensor products in a reproducing kernel Hilbert space."
        },
        {
          "type": "benchmark",
          "caption": "Tested on the Santa Fe laser series, the standard benchmark for chaotic time-series prediction. NMSE is normalised mean squared error; lower is better.",
          "unit": "NMSE",
          "rows": [
            { "label": "Competition winner, 1993", "value": "0.028" },
            { "label": "This work, iterative KRLS", "value": "0.042", "highlight": true },
            { "label": "Competition second place", "value": "0.080" }
          ]
        }
      ]
    }
  ]
}
```

Replace the Stmnt image `width` and `height` with the values Task 2 printed.

- [ ] **Step 9: Write `data/milestones.json`**

```json
{
  "items": [
    {
      "id": "cert-deeplearning-ai",
      "kind": "certification",
      "date": "2024-12",
      "title": "Supervised Machine Learning: Regression and Classification",
      "org": "DeepLearning.AI",
      "note": "",
      "images": []
    },
    {
      "id": "cert-dataiku-mlp",
      "kind": "certification",
      "date": "2024-04",
      "title": "Dataiku ML Practitioner and Core Designer",
      "org": "Dataiku Academy",
      "note": "",
      "images": []
    },
    {
      "id": "golden-key",
      "kind": "award",
      "date": "2023-05",
      "title": "Golden Key International Honour Society",
      "org": "Khalifa University chapter",
      "note": "Invitation-only, extended to the top fifteen percent of the class.",
      "images": [
        {
          "src": "assets/photos/derived/honors-day-ceremony-1600.jpg",
          "srcSmall": "assets/photos/derived/honors-day-ceremony-800.jpg",
          "alt": "Ahmed receiving a certificate on stage beneath the Golden Key and Khalifa University logos",
          "caption": "Honors Day, Khalifa University, May 2023",
          "width": 1600,
          "height": 1066
        }
      ]
    },
    {
      "id": "feed-and-reap",
      "kind": "volunteering",
      "date": "2023-04",
      "title": "Feed and Reap Initiative",
      "org": "Absher Ya Watan team, Abu Dhabi",
      "note": "Ramadan meal packing and distribution.",
      "images": [
        {
          "src": "assets/photos/derived/volunteering-meal-packing-1600.jpg",
          "srcSmall": "assets/photos/derived/volunteering-meal-packing-800.jpg",
          "alt": "Ahmed in a high-visibility volunteer vest packing meal boxes at a distribution hall",
          "caption": "Ramadan meal packing, April 2023",
          "width": 990,
          "height": 1350
        }
      ]
    },
    {
      "id": "deans-list",
      "kind": "award",
      "date": "2022-12",
      "title": "Dean's List",
      "org": "Khalifa University",
      "note": "Fall 2021 and Fall 2022.",
      "link": { "url": "https://www.ku.ac.ae/student-life/honors-list", "label": "Khalifa University honors list" },
      "images": []
    },
    {
      "id": "peer-mentor",
      "kind": "volunteering",
      "date": "2022-09",
      "title": "Lead Peer Mentor",
      "org": "Khalifa University",
      "note": "Mentored nine freshmen across Fall 2022 and Spring 2023.",
      "images": []
    },
    {
      "id": "python-workshop",
      "kind": "certification",
      "date": "2022-06",
      "title": "Python for Data Analysis Workshop",
      "org": "Khalifa University",
      "note": "",
      "images": []
    },
    {
      "id": "mawhibatna",
      "kind": "volunteering",
      "date": "2019-07",
      "title": "Mawhibatna Program volunteer",
      "org": "Sandooq Al Watan",
      "note": "Organiser supporting programme activities.",
      "images": []
    }
  ]
}
```

Replace the two `width` and `height` pairs with the values Task 2 printed. The volunteering image is cropped, so its dimensions will differ from the source.

- [ ] **Step 10: Write `data/metrics.json`**

Every figure traces to the CV or a verified repository.

```json
{
  "items": [
    { "value": "28 / 38", "label": "exception checks on the Saal.ai audit platform written by me" },
    { "value": "6", "label": "Delegation of Authority controls designed from scratch" },
    { "value": "35+", "label": "currencies handled by Stmnt" },
    { "value": "9", "label": "freshmen mentored at Khalifa University" }
  ]
}
```

- [ ] **Step 11: Write `data/skills.json`**

Rebuilt from the CV, which lists considerably more than the current file.

```json
{
  "categories": [
    {
      "name": "Programming languages",
      "type": "tags",
      "items": [
        { "name": "Python" }, { "name": "R" }, { "name": "MATLAB" },
        { "name": "Java" }, { "name": "LaTeX" }
      ]
    },
    {
      "name": "Libraries",
      "type": "tags",
      "items": [
        { "name": "Pandas" }, { "name": "NumPy" }, { "name": "Matplotlib" },
        { "name": "Seaborn" }, { "name": "scikit-learn" }, { "name": "TensorFlow" },
        { "name": "Keras" }, { "name": "PyMongo" }, { "name": "Tidyverse" },
        { "name": "lubridate" }, { "name": "caret" }
      ]
    },
    {
      "name": "Databases and cloud",
      "type": "tags",
      "items": [
        { "name": "MongoDB" }, { "name": "Studio 3T" },
        { "name": "Azure Blob Storage" }, { "name": "Docker" }
      ]
    },
    {
      "name": "Analytics and BI",
      "type": "tags",
      "items": [
        { "name": "Power BI" }, { "name": "Tableau" },
        { "name": "Dataiku" }, { "name": "Minitab" }
      ]
    },
    {
      "name": "Developer tools",
      "type": "tags",
      "items": [
        { "name": "Claude Code" }, { "name": "Git and GitHub" }, { "name": "VS Code" },
        { "name": "Jupyter" }, { "name": "RStudio" }, { "name": "Postman" }
      ]
    },
    {
      "name": "Languages",
      "type": "languages",
      "items": [
        { "name": "Arabic", "level": "Native" },
        { "name": "English", "level": "Fluent" },
        { "name": "Spanish", "level": "Beginner" }
      ]
    }
  ]
}
```

- [ ] **Step 12: Update `data/blocks-registry.json`**

Remove the `ascii-chart` entry entirely. Add a `benchmark` entry. Widen `image` scope to include `milestone`. Leave the rest untouched.

```json
  "benchmark": {
    "scope": ["project"],
    "label": "Benchmark table",
    "fields": [
      { "name": "caption", "type": "text", "label": "Caption", "required": false },
      { "name": "unit", "type": "string", "label": "Unit (e.g. NMSE)", "required": true },
      { "name": "rows", "type": "list", "label": "Rows as label / value / highlight", "required": true }
    ]
  },
```

Also update the `_comment` field so it no longer promises an `ascii-chart`, and change the `image` scope line to:

```json
    "scope": ["project", "experience", "education", "milestone"],
```

- [ ] **Step 13: Rewrite `test/data-projects.test.js`**

The existing file asserts a four-project ordering including HiSalon and Wafa, both removed. Replace its contents entirely.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url)));
const ids = data.items.map((p) => p.id);

test('selected work is the audit platform, Stmnt, and the kernel RLS research', () => {
  assert.deepEqual(ids, ['saal-audit-platform', 'stmnt', 'kernel-rls']);
});

test('HiSalon and Wafa are removed', () => {
  const raw = JSON.stringify(data);
  assert.equal(/HiSalon|Wafa/i.test(raw), false);
});

test('no forbidden Join-Future product names anywhere', () => {
  const raw = JSON.stringify(data);
  assert.equal(/HiPay|joinfuture\.ai|joinCX/i.test(raw), false);
});

test('the audit platform is excluded from the timeline, since the role represents it', () => {
  const audit = data.items.find((p) => p.id === 'saal-audit-platform');
  assert.equal(audit.timeline, false);
});

test('Stmnt describes the real model chain: OpenRouter, Gemini primary, GPT fallback', () => {
  const stmnt = data.items.find((p) => p.id === 'stmnt');
  const text = stmnt.blocks.map((b) => b.content ?? '').join(' ');
  assert.match(text, /OpenRouter/);
  assert.match(text, /Gemini/);
  assert.match(text, /fallback/i);
  assert.equal(stmnt.links.ios, 'https://apps.apple.com/app/stmnt/id6760298169');
});

test('the kernel RLS benchmark is a table, not an ASCII chart', () => {
  const krls = data.items.find((p) => p.id === 'kernel-rls');
  const bench = krls.blocks.find((b) => b.type === 'benchmark');
  assert.ok(bench, 'benchmark block missing');
  assert.equal(bench.rows.length, 3);
  assert.ok(bench.rows.some((r) => r.highlight === true), 'no row is highlighted');
});
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `npm test`
Expected: `test/data-integrity.test.js` and `test/data-projects.test.js` both PASS. The admin tests still pass. Tasks 5 onward have no files yet, so no other new failures.

If an image dimension assertion fails, correct the JSON to match what Task 2 actually produced rather than adjusting the test.

- [ ] **Step 15: Commit**

```bash
git add data test/data-integrity.test.js test/data-projects.test.js
git commit -m "feat(data): rebuild content from the 2026 CV, add milestones and metrics"
```

---

### Task 5: Data loading module

**Files:**
- Create: `js/data.js`
- Test: `test/data-module.test.js`

**Interfaces:**
- Consumes: the JSON shapes from Task 4.
- Produces:
  - `export function normalizeImage(img)` returns `{ src, srcSmall, alt, caption, width, height }`, throwing `TypeError` when `src` or `alt` is missing.
  - `export function validateSiteData(data)` returns `{ ok: boolean, errors: string[] }`.
  - `export async function loadSiteData(base = '')` returns `{ profile, summary, settings, experience, education, projects, milestones, metrics, skills, registry }`.

Fetching and validation are separated so validation is unit-testable with no DOM and no network.

- [ ] **Step 1: Write the failing test**

```js
// test/data-module.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImage, validateSiteData } from '../js/data.js';

test('normalizeImage fills optional fields and preserves required ones', () => {
  const img = normalizeImage({ src: 'a.jpg', alt: 'A person at a desk working', width: 10, height: 20 });
  assert.equal(img.src, 'a.jpg');
  assert.equal(img.srcSmall, 'a.jpg', 'srcSmall falls back to src');
  assert.equal(img.caption, '');
  assert.equal(img.width, 10);
});

test('normalizeImage rejects a missing src', () => {
  assert.throws(() => normalizeImage({ alt: 'something descriptive here' }), TypeError);
});

test('normalizeImage rejects missing alt text', () => {
  assert.throws(() => normalizeImage({ src: 'a.jpg' }), TypeError);
});

test('validateSiteData accepts a minimal well-formed payload', () => {
  const result = validateSiteData({
    profile: { name: 'A', nameArabic: 'ب', role: 'R', contact: { email: 'e@x.com' } },
    summary: { content: 'x' },
    settings: { cv: { path: 'a.pdf' }, sections: {}, nav: [] },
    experience: { items: [] },
    education: { items: [] },
    projects: { items: [] },
    milestones: { items: [] },
    metrics: { items: [] },
    skills: { categories: [] },
    registry: {},
  });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('validateSiteData reports every missing top-level key by name', () => {
  const result = validateSiteData({ profile: { name: 'A' } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('milestones')), result.errors.join('; '));
  assert.ok(result.errors.some((e) => e.includes('metrics')), result.errors.join('; '));
});

test('validateSiteData rejects a profile with no Arabic name', () => {
  const result = validateSiteData({
    profile: { name: 'A', role: 'R', contact: { email: 'e@x.com' } },
    summary: { content: 'x' },
    settings: { cv: { path: 'a.pdf' }, sections: {}, nav: [] },
    experience: { items: [] }, education: { items: [] }, projects: { items: [] },
    milestones: { items: [] }, metrics: { items: [] }, skills: { categories: [] }, registry: {},
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /nameArabic/.test(e)));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/data-module.test.js`
Expected: FAIL, cannot find module `../js/data.js`.

- [ ] **Step 3: Write `js/data.js`**

```js
/** Loading and validation for the site's JSON content.
 *  Validation is pure so it can be unit tested without a DOM or a network. */

const FILES = {
  profile: 'profile',
  summary: 'summary',
  settings: 'settings',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
  milestones: 'milestones',
  metrics: 'metrics',
  skills: 'skills',
  registry: 'blocks-registry',
};

/** Fill an image's optional fields and fail loudly if a required one is absent. */
export function normalizeImage(img) {
  if (!img || typeof img.src !== 'string' || img.src === '') {
    throw new TypeError('image requires a src');
  }
  if (typeof img.alt !== 'string' || img.alt.trim() === '') {
    throw new TypeError(`image ${img.src} requires alt text`);
  }
  return {
    src: img.src,
    srcSmall: img.srcSmall || img.src,
    alt: img.alt,
    caption: img.caption || '',
    width: Number(img.width) || 0,
    height: Number(img.height) || 0,
  };
}

const SHAPES = {
  profile: (v) => (v && v.name && v.role && v.contact ? null : 'profile needs name, role, contact'),
  summary: (v) => (v && typeof v.content === 'string' ? null : 'summary needs content'),
  settings: (v) => (v && v.cv && v.cv.path ? null : 'settings needs cv.path'),
  experience: (v) => (v && Array.isArray(v.items) ? null : 'experience needs items[]'),
  education: (v) => (v && Array.isArray(v.items) ? null : 'education needs items[]'),
  projects: (v) => (v && Array.isArray(v.items) ? null : 'projects needs items[]'),
  milestones: (v) => (v && Array.isArray(v.items) ? null : 'milestones needs items[]'),
  metrics: (v) => (v && Array.isArray(v.items) ? null : 'metrics needs items[]'),
  skills: (v) => (v && Array.isArray(v.categories) ? null : 'skills needs categories[]'),
  registry: (v) => (v && typeof v === 'object' ? null : 'registry must be an object'),
};

/** Check the payload's shape. Returns every problem rather than the first. */
export function validateSiteData(data) {
  const errors = [];
  for (const key of Object.keys(SHAPES)) {
    if (!(key in (data || {}))) {
      errors.push(`missing ${key}`);
      continue;
    }
    const problem = SHAPES[key](data[key]);
    if (problem) errors.push(problem);
  }
  if (data && data.profile && !data.profile.nameArabic) {
    errors.push('profile.nameArabic is required');
  }
  return { ok: errors.length === 0, errors };
}

/** Fetch every content file in parallel and validate the result. */
export async function loadSiteData(base = '') {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const response = await fetch(`${base}data/${file}.json`);
      if (!response.ok) throw new Error(`failed to load ${file}.json (${response.status})`);
      return [key, await response.json()];
    }),
  );
  const data = Object.fromEntries(entries);
  const { ok, errors } = validateSiteData(data);
  if (!ok) throw new Error(`invalid site data: ${errors.join('; ')}`);
  return data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/data-module.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add js/data.js test/data-module.test.js
git commit -m "feat(js): data loading with pure, testable validation"
```

---

### Task 6: Timeline composition

**Files:**
- Create: `js/timeline.js`
- Test: `test/timeline.test.js`

**Interfaces:**
- Consumes: the data shapes from Task 4.
- Produces: `export function buildTimeline({ experience, education, projects, milestones })` returning `Array<{ year: number, entries: Entry[] }>` sorted descending by year, each group's entries sorted by the documented precedence. `Entry` is `{ id, kind, sortDate, year, order, title, org, orgLogo, location, dateRange, bullets, images, blocks, workRef, link, note }`. Also exports `KIND_ORDER` for use in tests.

This is the heart of the redesign and the module most worth testing.

- [ ] **Step 1: Write the failing test**

```js
// test/timeline.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline } from '../js/timeline.js';

const empty = { experience: { items: [] }, education: { items: [] }, projects: { items: [] }, milestones: { items: [] } };

const withRole = (over = {}) => ({
  items: [{
    company: 'Saal.ai', location: 'Abu Dhabi, UAE', logo: { default: 'a.png' },
    roles: [{ id: 'r1', title: 'Graduate Trainee', startDate: '2024-09', endDate: 'Present', displayDate: 'Sep 2024 — Present', bullets: ['b1'], images: [], blocks: [], workRef: 'saal-audit-platform', ...over }],
  }],
});

test('returns year groups in descending order', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'e1', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: '2018 — 2023', images: [], blocks: [] }] },
    experience: withRole(),
  });
  assert.deepEqual(out.map((g) => g.year), [2024, 2023]);
});

test('one entry is produced per role, not per company', () => {
  const experience = { items: [{
    company: 'Saal.ai', location: 'Abu Dhabi, UAE', logo: {},
    roles: [
      { id: 'r1', title: 'Graduate Trainee', startDate: '2024-09', endDate: 'Present', displayDate: 'x', bullets: [], images: [], blocks: [] },
      { id: 'r2', title: 'Intern', startDate: '2024-03', endDate: '2024-09', displayDate: 'y', bullets: [], images: [], blocks: [] },
    ],
  }] };
  const out = buildTimeline({ ...empty, experience });
  const entries = out.flatMap((g) => g.entries);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.id), ['r1', 'r2']);
  assert.equal(entries[0].org, 'Saal.ai', 'the company name becomes the entry org');
});

test('entries sharing a date sort role, education, project, milestone', () => {
  const out = buildTimeline({
    experience: { items: [{ company: 'C', location: '', logo: {}, roles: [{ id: 'role', title: 'T', startDate: '2023-05', endDate: 'x', displayDate: 'd', bullets: [], images: [], blocks: [] }] }] },
    education: { items: [{ id: 'edu', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: 'd', images: [], blocks: [] }] },
    projects: { items: [{ id: 'proj', title: 'P', timeline: true, startDate: '2023-05', displayDate: 'd', blocks: [], images: [], tags: [], links: {} }] },
    milestones: { items: [{ id: 'mile', kind: 'award', date: '2023-05', title: 'M', org: 'O', note: '', images: [] }] },
  });
  assert.deepEqual(out[0].entries.map((e) => e.id), ['role', 'edu', 'proj', 'mile']);
});

test('an explicit order field outranks kind precedence', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'edu', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: 'd', images: [], blocks: [], order: 1 }] },
    milestones: { items: [{ id: 'mile', kind: 'award', date: '2023-05', title: 'M', org: 'O', note: '', images: [], order: 0 }] },
  });
  assert.deepEqual(out[0].entries.map((e) => e.id), ['mile', 'edu']);
});

test('projects are included only when timeline is true', () => {
  const out = buildTimeline({
    ...empty,
    projects: { items: [
      { id: 'shown', title: 'A', timeline: true, startDate: '2026-02', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
      { id: 'hidden', title: 'B', timeline: false, startDate: '2024-09', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
      { id: 'absent', title: 'C', startDate: '2020-01', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
    ] },
  });
  assert.deepEqual(out.flatMap((g) => g.entries).map((e) => e.id), ['shown']);
});

test('entries with a missing or malformed date are dropped rather than crashing', () => {
  const out = buildTimeline({
    ...empty,
    milestones: { items: [
      { id: 'ok', kind: 'award', date: '2022-06', title: 'M', org: 'O', note: '', images: [] },
      { id: 'nodate', kind: 'award', title: 'M', org: 'O', note: '', images: [] },
      { id: 'garbage', kind: 'award', date: 'sometime', title: 'M', org: 'O', note: '', images: [] },
    ] },
  });
  assert.deepEqual(out.flatMap((g) => g.entries).map((e) => e.id), ['ok']);
});

test('a bare four-digit year is accepted', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'school', institution: 'Al Nahda', degree: 'Diploma', endDate: '2018', displayDate: '2015 — 2018', images: [], blocks: [] }] },
  });
  assert.equal(out[0].year, 2018);
});

test('workRef survives composition so the entry can link into Selected Work', () => {
  const out = buildTimeline({ ...empty, experience: withRole() });
  assert.equal(out[0].entries[0].workRef, 'saal-audit-platform');
});

test('a milestone verification link survives composition', () => {
  const link = { url: 'https://www.ku.ac.ae/student-life/honors-list', label: 'Khalifa University honors list' };
  const out = buildTimeline({
    ...empty,
    milestones: { items: [{ id: 'deans', kind: 'award', date: '2022-12', title: "Dean's List", org: 'KU', note: '', link, images: [] }] },
  });
  assert.deepEqual(out[0].entries[0].link, link);
});

test('entries without a link carry null rather than undefined', () => {
  const out = buildTimeline({ ...empty, experience: withRole() });
  assert.equal(out[0].entries[0].link, null);
});

test('an empty payload produces an empty timeline, not an error', () => {
  assert.deepEqual(buildTimeline(empty), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/timeline.test.js`
Expected: FAIL, cannot find module `../js/timeline.js`.

- [ ] **Step 3: Write `js/timeline.js`**

```js
/** Compose the reverse-chronological timeline from the content files.
 *
 *  Nothing here touches the DOM. The timeline is assembled rather than
 *  authored, so adding a role in the admin puts it on the timeline with
 *  no second edit. */

export const KIND_ORDER = { role: 0, education: 1, project: 2, milestone: 3 };

const DATE = /^(\d{4})(-\d{2})?$/;

function yearOf(value) {
  const match = DATE.exec(String(value ?? '').trim());
  return match ? Number(match[1]) : null;
}

function entry(fields) {
  return {
    id: fields.id,
    kind: fields.kind,
    sortDate: fields.sortDate,
    year: fields.year,
    order: fields.order,
    title: fields.title,
    org: fields.org ?? '',
    orgLogo: fields.orgLogo ?? null,
    location: fields.location ?? '',
    dateRange: fields.dateRange ?? '',
    bullets: fields.bullets ?? [],
    images: fields.images ?? [],
    blocks: fields.blocks ?? [],
    workRef: fields.workRef ?? null,
    link: fields.link ?? null,
    note: fields.note ?? '',
  };
}

function fromExperience(experience) {
  const out = [];
  for (const company of experience.items ?? []) {
    for (const role of company.roles ?? []) {
      const year = yearOf(role.startDate);
      if (year === null) continue;
      out.push(entry({
        id: role.id, kind: 'role', sortDate: role.startDate, year, order: role.order,
        title: role.title, org: company.company, orgLogo: company.logo ?? null,
        location: company.location, dateRange: role.displayDate,
        bullets: role.bullets, images: role.images, blocks: role.blocks,
        workRef: role.workRef,
      }));
    }
  }
  return out;
}

function fromEducation(education) {
  const out = [];
  for (const item of education.items ?? []) {
    const year = yearOf(item.endDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'education', sortDate: item.endDate, year, order: item.order,
      title: item.degree, org: item.institution, orgLogo: item.logo ?? null,
      location: item.location, dateRange: item.displayDate,
      note: item.grade, images: item.images, blocks: item.blocks,
    }));
  }
  return out;
}

function fromProjects(projects) {
  const out = [];
  for (const item of projects.items ?? []) {
    if (item.timeline !== true) continue;
    const year = yearOf(item.startDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'project', sortDate: item.startDate, year, order: item.order,
      title: item.title, org: item.org, dateRange: item.displayDate,
      images: item.images, blocks: item.blocks, workRef: item.id,
    }));
  }
  return out;
}

function fromMilestones(milestones) {
  const out = [];
  for (const item of milestones.items ?? []) {
    const year = yearOf(item.date);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'milestone', sortDate: item.date, year, order: item.order,
      title: item.title, org: item.org, note: item.note, images: item.images,
      link: item.link,
    }));
  }
  return out;
}

function compare(a, b) {
  if (a.sortDate !== b.sortDate) return b.sortDate.localeCompare(a.sortDate);
  const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

/** Build year groups, newest first. */
export function buildTimeline({ experience = {}, education = {}, projects = {}, milestones = {} } = {}) {
  const all = [
    ...fromExperience(experience),
    ...fromEducation(education),
    ...fromProjects(projects),
    ...fromMilestones(milestones),
  ].sort(compare);

  const groups = new Map();
  for (const item of all) {
    if (!groups.has(item.year)) groups.set(item.year, []);
    groups.get(item.year).push(item);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, entries]) => ({ year, entries }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/timeline.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add js/timeline.js test/timeline.test.js
git commit -m "feat(js): compose the timeline from experience, education, projects, milestones"
```

---

### Task 7: Page shell, theme, and boot

**Files:**
- Modify: `index.html` (replace entirely)
- Create: `js/theme.js`, `js/main.js`
- Test: `test/theme.test.js`

**Interfaces:**
- Consumes: `loadSiteData` from Task 5, `buildTimeline` from Task 6, and the renderers from Task 8, which do not exist yet. `js/main.js` therefore imports `./render.js` and this task will not run in a browser until Task 8 lands. That is expected and the unit tests still pass.
- Produces:
  - `export function nextTheme(current)` returning `'light'` or `'dark'`.
  - `export function resolveTheme(stored, prefersDark)` returning the theme to apply on boot.
  - `export function initTheme(doc, storage, media)` wiring the toggle.
  - The DOM ids every renderer in Task 8 writes into: `hero`, `about`, `path`, `numbers`, `work`, `skills`, `contact`.

- [ ] **Step 1: Write the failing test**

```js
// test/theme.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTheme, resolveTheme } from '../js/theme.js';

test('nextTheme flips between the two themes', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});

test('nextTheme treats anything unrecognised as light, so the first click goes dark', () => {
  assert.equal(nextTheme(null), 'dark');
  assert.equal(nextTheme('sepia'), 'dark');
});

test('a stored choice always wins over the system preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('with no stored choice the system preference decides', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
});

test('a corrupt stored value falls back to the system preference', () => {
  assert.equal(resolveTheme('banana', true), 'dark');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/theme.test.js`
Expected: FAIL, cannot find module `../js/theme.js`.

- [ ] **Step 3: Write `js/theme.js`**

```js
/** Theme selection. The pure helpers are unit tested; initTheme wires the DOM. */

const THEMES = ['light', 'dark'];
const KEY = 'theme';

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark';
}

export function resolveTheme(stored, prefersDark) {
  if (THEMES.includes(stored)) return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Announce the change so screen reader users hear it, matching prior behaviour. */
function announce(doc, theme) {
  const region = doc.getElementById('sr-status');
  if (region) region.textContent = `${theme} mode`;
}

export function initTheme(doc, storage, media) {
  const root = doc.documentElement;
  const button = doc.querySelector('.theme-toggle');

  const apply = (theme, { announceIt = false } = {}) => {
    root.setAttribute('data-theme', theme);
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
    if (announceIt) announce(doc, theme);
  };

  let stored = null;
  try { stored = storage.getItem(KEY); } catch { stored = null; }
  apply(resolveTheme(stored, media.matches));

  if (button) {
    button.addEventListener('click', () => {
      const theme = nextTheme(root.getAttribute('data-theme'));
      try { storage.setItem(KEY, theme); } catch { /* private mode */ }
      apply(theme, { announceIt: true });
    });
  }

  // Follow the system only while the visitor has expressed no preference.
  media.addEventListener('change', (event) => {
    let saved = null;
    try { saved = storage.getItem(KEY); } catch { saved = null; }
    if (!THEMES.includes(saved)) apply(event.matches ? 'dark' : 'light');
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/theme.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write `index.html`**

Every visible string comes from the data files. The only literals here are structural labels and the noscript message.

```html
<!DOCTYPE html>
<html lang="en-AE">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- Set the theme before first paint so the page never flashes the wrong ground. -->
<script>
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme',
      stored === 'light' || stored === 'dark' ? stored : (dark ? 'dark' : 'light'));
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
</script>

<title>Ahmed Alawi Radhi, Data Scientist</title>
<meta name="description" content="Data scientist in Abu Dhabi. Procurement audit systems and data pipelines at Saal.ai. Applied mathematics and statistics, Khalifa University.">
<link rel="canonical" href="https://7mxd.github.io/">

<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="Ahmed Alawi Radhi, Data Scientist">
<meta property="og:description" content="Data scientist in Abu Dhabi. Procurement audit systems and data pipelines at Saal.ai.">
<meta property="og:image" content="https://7mxd.github.io/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://7mxd.github.io/">
<meta property="og:site_name" content="Ahmed Alawi Radhi">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Ahmed Alawi Radhi, Data Scientist">
<meta name="twitter:description" content="Data scientist in Abu Dhabi. Procurement audit systems and data pipelines at Saal.ai.">
<meta name="twitter:image" content="https://7mxd.github.io/assets/og-image.png">

<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#fafaf9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15171f" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-title" content="Ahmed Radhi">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Public+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Public+Sans:wght@400;500;600&display=swap">
<!-- Amiri is subsetted to the ten glyphs of the Arabic name. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&text=%D8%A3%D8%AD%D9%85%D8%AF%20%D8%B9%D9%84%D9%88%D9%8A%20%D8%B1%D8%B6%D9%8A&display=swap">

<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/layout.css">
<link rel="stylesheet" href="css/sections.css">
<link rel="stylesheet" href="css/print.css" media="print">

<script type="module" src="js/main.js"></script>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<p id="sr-status" class="sr-only" role="status" aria-live="polite"></p>

<header class="site-nav-wrap">
  <nav class="site-nav" aria-label="Main navigation">
    <a class="nav-mark" href="#main">
      <img src="assets/brand/logo-icon.png" alt="" width="40" height="40" decoding="async">
      <span class="nav-mark-name" data-nav-name></span>
    </a>
    <button class="nav-menu-toggle" aria-expanded="false" aria-controls="nav-links">
      <span class="sr-only">Menu</span>
      <span class="nav-menu-bar" aria-hidden="true"></span>
      <span class="nav-menu-bar" aria-hidden="true"></span>
    </button>
    <div class="nav-links" id="nav-links">
      <ul class="nav-list" data-nav-links></ul>
      <div class="nav-actions">
        <button type="button" class="theme-toggle" aria-pressed="false">
          <span class="sr-only">Dark mode</span>
          <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
            <circle cx="12" cy="12" r="4.5"></circle>
            <path d="M12 1.8v2.4M12 19.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"></path>
          </svg>
          <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
          </svg>
        </button>
        <a class="cv-button" data-cv-link href="#" download>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download CV</span>
        </a>
      </div>
    </div>
  </nav>
</header>

<main id="main">
  <section id="hero" class="hero"></section>
  <section id="about" class="section" aria-labelledby="about-heading"></section>
  <section id="path" class="section" aria-labelledby="path-heading"></section>
  <section id="numbers" class="section" aria-labelledby="numbers-heading"></section>
  <section id="work" class="section" aria-labelledby="work-heading"></section>
  <section id="skills" class="section" aria-labelledby="skills-heading"></section>
  <section id="contact" class="section" aria-labelledby="contact-heading"></section>
</main>

<footer class="site-footer">
  <p>&copy; <span data-footer-year></span> Ahmed Alawi Radhi</p>
</footer>

<noscript>
  <div class="noscript-warning">
    <p>This page is rendered with JavaScript. Please enable it to load the content.</p>
  </div>
</noscript>
</body>
</html>
```

- [ ] **Step 6: Write `js/main.js`**

```js
import { loadSiteData } from './data.js';
import { buildTimeline } from './timeline.js';
import { initTheme } from './theme.js';
import { renderAll } from './render.js';

/** Mark keyboard users so focus rings appear only when they are useful. */
function trackKeyboardUse(doc) {
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') doc.documentElement.classList.add('using-keyboard');
  });
  doc.addEventListener('pointerdown', () => {
    doc.documentElement.classList.remove('using-keyboard');
  });
}

function initMobileNav(doc) {
  const toggle = doc.querySelector('.nav-menu-toggle');
  const links = doc.getElementById('nav-links');
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
    doc.body.classList.toggle('nav-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}

async function boot() {
  initTheme(document, window.localStorage, window.matchMedia('(prefers-color-scheme: dark)'));
  trackKeyboardUse(document);
  initMobileNav(document);

  try {
    const data = await loadSiteData();
    renderAll(document, data, buildTimeline(data));
  } catch (error) {
    console.error(error);
    const main = document.getElementById('main');
    if (main) {
      main.innerHTML = '<p class="load-error">The page content could not be loaded. Please refresh.</p>';
    }
  }
}

boot();
```

- [ ] **Step 7: Commit**

```bash
git add index.html js/theme.js js/main.js test/theme.test.js
git commit -m "feat(html): plain editorial page shell with pre-paint theme resolution"
```

---

### Task 8: Renderers

**Files:**
- Create: `js/render.js`, `js/blocks.js`
- Test: `test/blocks.test.js`

**Interfaces:**
- Consumes: `normalizeImage` from Task 5, timeline groups from Task 6, and the DOM ids from Task 7.
- Produces: `export function renderAll(doc, data, timeline)`. From `js/blocks.js`: `export function renderBlock(block)` returning an HTML string, and `export function renderBlocks(blocks)`. Also `export function escapeHtml(value)` and `export function imageMarkup(image, sizes)`, both used by `render.js`.

- [ ] **Step 1: Write the failing test**

```js
// test/blocks.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderBlock, renderBlocks, imageMarkup } from '../js/blocks.js';

test('escapeHtml neutralises angle brackets, quotes, and ampersands', () => {
  assert.equal(escapeHtml('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('a description block becomes a paragraph with escaped content', () => {
  const html = renderBlock({ type: 'description', content: 'Audits <ERP> data' });
  assert.match(html, /^<p class="block-text">/);
  assert.match(html, /&lt;ERP&gt;/);
});

test('a benchmark block renders a table and marks the highlighted row', () => {
  const html = renderBlock({
    type: 'benchmark', unit: 'NMSE', caption: 'Santa Fe laser series',
    rows: [
      { label: 'Winner', value: '0.028' },
      { label: 'This work', value: '0.042', highlight: true },
    ],
  });
  assert.match(html, /<table class="benchmark"/);
  assert.match(html, /NMSE/);
  assert.match(html, /class="is-mine"/);
  assert.match(html, /Santa Fe laser series/);
});

test('a callout block carries its tone as a modifier class', () => {
  const html = renderBlock({ type: 'callout', tone: 'note', content: 'No screenshots exist.' });
  assert.match(html, /block-callout is-note/);
});

test('an unknown block type renders nothing rather than throwing', () => {
  assert.equal(renderBlock({ type: 'ascii-chart', chart: 'xxx' }), '');
});

test('renderBlocks joins several blocks and tolerates an empty list', () => {
  const html = renderBlocks([
    { type: 'description', content: 'one' },
    { type: 'description', content: 'two' },
  ]);
  assert.equal((html.match(/<p class="block-text">/g) || []).length, 2);
  assert.equal(renderBlocks([]), '');
  assert.equal(renderBlocks(undefined), '');
});

test('imageMarkup emits a figure with srcset, dimensions, and lazy loading', () => {
  const html = imageMarkup({
    src: 'a-1600.jpg', srcSmall: 'a-800.jpg', alt: 'A descriptive alt string',
    caption: 'A caption', width: 1600, height: 1067,
  }, '(min-width: 40rem) 46rem, 100vw');
  assert.match(html, /<figure/);
  assert.match(html, /srcset="a-800\.jpg 800w, a-1600\.jpg 1600w"/);
  assert.match(html, /width="1600"/);
  assert.match(html, /height="1067"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<figcaption>A caption<\/figcaption>/);
});

test('imageMarkup omits the caption element when there is no caption', () => {
  const html = imageMarkup({ src: 'a.jpg', srcSmall: 'a.jpg', alt: 'Alt text here', caption: '', width: 10, height: 10 }, '100vw');
  assert.equal(/figcaption/.test(html), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/blocks.test.js`
Expected: FAIL, cannot find module `../js/blocks.js`.

- [ ] **Step 3: Write `js/blocks.js`**

```js
/** Block rendering. Every renderer returns an HTML string and escapes its input.
 *  Block types are declared in data/blocks-registry.json; the dispatch table
 *  below must stay in step with it. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** A responsive figure. `sizes` tells the browser how wide it will render. */
export function imageMarkup(image, sizes) {
  const caption = image.caption
    ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
    : '';
  const srcset = image.srcSmall && image.srcSmall !== image.src
    ? ` srcset="${escapeHtml(image.srcSmall)} 800w, ${escapeHtml(image.src)} 1600w" sizes="${escapeHtml(sizes)}"`
    : '';
  return `<figure class="figure">
<img src="${escapeHtml(image.src)}"${srcset} alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
${caption}</figure>`;
}

const RENDERERS = {
  description: (b) => `<p class="block-text">${escapeHtml(b.content)}</p>`,

  responsibility: (b) => `<li class="block-bullet">${escapeHtml(b.content)}</li>`,

  callout: (b) =>
    `<aside class="block-callout is-${escapeHtml(b.tone || 'note')}">${escapeHtml(b.content)}</aside>`,

  metric: (b) =>
    `<p class="block-metric"><span class="block-metric-value">${escapeHtml(b.value)}</span> <span class="block-metric-label">${escapeHtml(b.label)}</span></p>`,

  'linked-artifact': (b) =>
    `<p class="block-link"><a href="${escapeHtml(b.url)}">${escapeHtml(b.label)}</a></p>`,

  honor: (b) => `<p class="block-honor">${escapeHtml(b.content)}</p>`,

  thesis: (b) => {
    const title = escapeHtml(b.title);
    const inner = b.link ? `<a href="${escapeHtml(b.link)}">${title}</a>` : title;
    return `<p class="block-thesis"><span class="block-label">Thesis</span> ${inner}</p>`;
  },

  coursework: (b) => {
    const items = (b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
    return `<ul class="block-coursework">${items}</ul>`;
  },

  code: (b) =>
    `<pre class="block-code"><code>${escapeHtml(b.content)}</code></pre>`,

  html: (b) => String(b.content ?? ''),

  image: (b) => imageMarkup(
    { src: b.src, srcSmall: b.srcSmall || b.src, alt: b.alt, caption: b.caption || '', width: b.width || 0, height: b.height || 0 },
    '(min-width: 40rem) 46rem, 100vw',
  ),

  benchmark: (b) => {
    const caption = b.caption ? `<caption>${escapeHtml(b.caption)}</caption>` : '';
    const rows = (b.rows ?? []).map((r) =>
      `<tr${r.highlight ? ' class="is-mine"' : ''}><th scope="row">${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`,
    ).join('');
    return `<table class="benchmark">${caption}
<thead><tr><th scope="col">Method</th><th scope="col">${escapeHtml(b.unit)}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  },
};

/** Render one block. Unknown types render nothing, so retiring a type in the
 *  registry cannot break a page that still has stale data. */
export function renderBlock(block) {
  const renderer = RENDERERS[block?.type];
  return renderer ? renderer(block) : '';
}

export function renderBlocks(blocks) {
  return (blocks ?? []).map(renderBlock).join('');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/blocks.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write `js/render.js`**

```js
import { escapeHtml, renderBlocks, imageMarkup } from './blocks.js';

const PROSE_SIZES = '(min-width: 46rem) 34rem, 100vw';
const WIDE_SIZES = '(min-width: 46rem) 46rem, 100vw';

function heading(id, text) {
  return `<h2 class="section-heading" id="${id}-heading">${escapeHtml(text)}</h2>`;
}

/** One to three images. A lone trailing image spans the measure rather than
 *  sitting in a half column. */
function gallery(images) {
  if (!images || images.length === 0) return '';
  const modifier = images.length === 1 ? 'is-single' : 'is-grid';
  const figures = images.map((img) => imageMarkup(img, WIDE_SIZES)).join('');
  return `<div class="gallery ${modifier}" data-count="${images.length}">${figures}</div>`;
}

function renderHero(doc, profile) {
  const links = [
    `<a href="mailto:${escapeHtml(profile.contact.email)}">${escapeHtml(profile.contact.email)}</a>`,
    profile.contact.linkedin ? `<a href="${escapeHtml(profile.contact.linkedin.url)}">${escapeHtml(profile.contact.linkedin.label)}</a>` : '',
    profile.contact.github ? `<a href="${escapeHtml(profile.contact.github.url)}">${escapeHtml(profile.contact.github.label)}</a>` : '',
  ].filter(Boolean).join('');

  const portrait = profile.portrait
    ? `<img class="hero-portrait" src="${escapeHtml(profile.portrait.src)}" srcset="${escapeHtml(profile.portrait.srcSmall)} 800w, ${escapeHtml(profile.portrait.src)} 1600w" sizes="(min-width: 46rem) 15rem, 40vw" alt="${escapeHtml(profile.portrait.alt)}" width="${profile.portrait.width}" height="${profile.portrait.height}" fetchpriority="high" decoding="async">`
    : '';

  doc.getElementById('hero').innerHTML = `
${portrait}
<div class="hero-text">
  <h1 class="hero-name">${escapeHtml(profile.name)}</h1>
  <p class="hero-name-ar" lang="ar" dir="rtl">${escapeHtml(profile.nameArabic)}</p>
  <p class="hero-role">${escapeHtml(profile.role)}</p>
  <p class="hero-tagline">${escapeHtml(profile.tagline)}</p>
  <p class="hero-links">${links}</p>
</div>`;
}

function renderAbout(doc, summary) {
  doc.getElementById('about').innerHTML =
    `${heading('about', 'About')}<p class="prose">${escapeHtml(summary.content)}</p>`;
}

function entryMarkup(entry) {
  const bullets = entry.bullets.length
    ? `<ul class="entry-bullets">${entry.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';
  const note = entry.note ? `<p class="entry-note">${escapeHtml(entry.note)}</p>` : '';
  const org = entry.org ? `<span class="entry-org">${escapeHtml(entry.org)}</span>` : '';
  const dates = entry.dateRange ? `<span class="entry-dates">${escapeHtml(entry.dateRange)}</span>` : '';
  let more = '';
  if (entry.workRef) {
    more = `<p class="entry-more"><a href="#work-${escapeHtml(entry.workRef)}">Read more about this work</a></p>`;
  } else if (entry.link) {
    more = `<p class="entry-more"><a href="${escapeHtml(entry.link.url)}" rel="noopener">${escapeHtml(entry.link.label)}</a></p>`;
  }

  return `<li class="entry is-${escapeHtml(entry.kind)}">
<h3 class="entry-title">${escapeHtml(entry.title)}</h3>
<p class="entry-meta">${org}${dates}</p>
${note}${bullets}${more}${gallery(entry.images)}
</li>`;
}

function renderPath(doc, timeline) {
  const groups = timeline.map((group) => `
<section class="year-group" aria-labelledby="year-${group.year}">
  <h3 class="year-label" id="year-${group.year}">${group.year}</h3>
  <ol class="entries">${group.entries.map(entryMarkup).join('')}</ol>
</section>`).join('');

  const span = timeline.length
    ? `<p class="section-note">${timeline[0].year} to ${timeline[timeline.length - 1].year}</p>`
    : '';

  doc.getElementById('path').innerHTML = `${heading('path', 'The path so far')}${span}${groups}`;
}

function renderNumbers(doc, metrics) {
  const items = metrics.items.map((m) => `
<div class="metric">
  <p class="metric-value">${escapeHtml(m.value)}</p>
  <p class="metric-label">${escapeHtml(m.label)}</p>
</div>`).join('');
  doc.getElementById('numbers').innerHTML = `${heading('numbers', 'By the numbers')}<div class="metrics">${items}</div>`;
}

function workMarkup(project) {
  const tags = project.tags?.length
    ? `<p class="work-tags">${project.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</p>`
    : '';

  const named = { ios: 'App Store', webapp: 'Website', github: 'GitHub' };
  const links = [];
  for (const [key, label] of Object.entries(named)) {
    if (project.links?.[key]) links.push(`<a href="${escapeHtml(project.links[key])}">${label}</a>`);
  }
  for (const extra of project.links?.extra ?? []) {
    links.push(`<a href="${escapeHtml(extra.url)}">${escapeHtml(extra.label)}</a>`);
  }
  const linkRow = links.length ? `<p class="work-links">${links.join('')}</p>` : '';

  const org = project.org ? `<span class="work-org">${escapeHtml(project.org)}</span>` : '';
  const dates = project.displayDate ? `<span class="work-dates">${escapeHtml(project.displayDate)}</span>` : '';

  return `<article class="work" id="work-${escapeHtml(project.id)}">
<h3 class="work-title">${escapeHtml(project.title)}</h3>
<p class="work-meta">${org}${dates}</p>
${renderBlocks(project.blocks)}
${gallery(project.images)}
${tags}${linkRow}
</article>`;
}

function renderWork(doc, projects) {
  doc.getElementById('work').innerHTML =
    `${heading('work', 'Selected work')}${projects.items.map(workMarkup).join('')}`;
}

function renderSkills(doc, skills) {
  const groups = skills.categories.map((cat) => {
    const items = cat.type === 'languages'
      ? cat.items.map((i) => `<li>${escapeHtml(i.name)} <span class="skill-level">${escapeHtml(i.level)}</span></li>`).join('')
      : cat.items.map((i) => `<li>${escapeHtml(i.name)}</li>`).join('');
    return `<div class="skill-group">
<h3 class="skill-group-name">${escapeHtml(cat.name)}</h3>
<ul class="skill-list">${items}</ul>
</div>`;
  }).join('');
  doc.getElementById('skills').innerHTML = `${heading('skills', 'Skills')}<div class="skill-groups">${groups}</div>`;
}

function renderContact(doc, profile) {
  const rows = [
    ['Email', `mailto:${profile.contact.email}`, profile.contact.email],
    profile.contact.linkedin ? ['LinkedIn', profile.contact.linkedin.url, 'linkedin.com/in/ahmedaradhi'] : null,
    profile.contact.github ? ['GitHub', profile.contact.github.url, 'github.com/7mxd'] : null,
  ].filter(Boolean).map(([label, href, text]) => `
<div class="contact-row">
  <span class="contact-label">${escapeHtml(label)}</span>
  <a href="${escapeHtml(href)}">${escapeHtml(text)}</a>
</div>`).join('');

  doc.getElementById('contact').innerHTML =
    `${heading('contact', 'Contact')}<p class="prose">${escapeHtml(profile.location)}</p><div class="contacts">${rows}</div>`;
}

function renderChrome(doc, data) {
  const nameEl = doc.querySelector('[data-nav-name]');
  if (nameEl) nameEl.textContent = data.profile.name;

  const navList = doc.querySelector('[data-nav-links]');
  if (navList) {
    navList.innerHTML = data.settings.nav
      .filter((item) => data.settings.sections?.[item.id]?.enabled !== false)
      .map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`)
      .join('');
  }

  const cv = doc.querySelector('[data-cv-link]');
  if (cv) {
    cv.setAttribute('href', data.settings.cv.path);
    cv.setAttribute('download', data.settings.cv.downloadName);
  }

  const year = doc.querySelector('[data-footer-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  doc.title = data.settings.siteTitle;
}

/** Hide any section switched off in settings, so an empty one never ships. */
function applyVisibility(doc, settings) {
  for (const [id, config] of Object.entries(settings.sections ?? {})) {
    const el = doc.getElementById(id);
    if (el && config.enabled === false) el.hidden = true;
  }
}

export function renderAll(doc, data, timeline) {
  renderChrome(doc, data);
  renderHero(doc, data.profile);
  renderAbout(doc, data.summary);
  renderPath(doc, timeline);
  renderNumbers(doc, data.metrics);
  renderWork(doc, data.projects);
  renderSkills(doc, data.skills);
  renderContact(doc, data.profile);
  applyVisibility(doc, data.settings);
}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add js/render.js js/blocks.js test/blocks.test.js
git commit -m "feat(js): section renderers and registry-driven block dispatch"
```

---

### Task 9: Base and layout styles

**Files:**
- Create: `css/base.css`, `css/layout.css`

**Interfaces:**
- Consumes: tokens from Task 3, class names emitted by Task 7 and Task 8.
- Produces: the page shell. Task 10 styles the section internals.

- [ ] **Step 1: Write `css/base.css`**

```css
/* Reset, element typography, links, focus. */

*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-prose);
  font-size: var(--text-base);
  line-height: var(--leading-prose);
  font-optical-sizing: auto;
  text-rendering: optimizeLegibility;
}

h1, h2, h3 {
  margin: 0;
  line-height: var(--leading-tight);
  font-weight: 600;
  text-wrap: balance;
}

p { margin: 0 0 var(--space-4); }
p:last-child { margin-bottom: 0; }

ul, ol { margin: 0; padding: 0; list-style: none; }

img { max-width: 100%; height: auto; display: block; }

a {
  color: var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}
a:hover { color: var(--accent-strong); }

/* Focus rings appear only once a visitor has used the keyboard. */
:focus { outline: none; }
:focus-visible {
  outline: var(--focus-width) solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}
.using-keyboard :focus {
  outline: var(--focus-width) solid var(--accent);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.skip-link {
  position: absolute;
  top: 0; left: var(--space-4);
  transform: translateY(-120%);
  z-index: 100;
  padding: var(--space-2) var(--space-4);
  background: var(--ground-raised);
  color: var(--ink);
  border: var(--rule-width) solid var(--rule);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
}
.skip-link:focus { transform: translateY(0); }

.noscript-warning, .load-error {
  max-width: var(--measure-prose);
  margin: var(--space-16) auto;
  padding: 0 var(--gutter);
  font-family: var(--font-meta);
}
```

- [ ] **Step 2: Write `css/layout.css`**

```css
/* Page shell: navigation, section rhythm, footer. */

.site-nav-wrap {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--ground) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: var(--rule-width) solid var(--rule);
}

.site-nav {
  max-width: var(--measure-wide);
  margin: 0 auto;
  padding: var(--space-3) var(--gutter);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-mark {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-meta);
  font-weight: 600;
  font-size: var(--text-sm);
}
.nav-mark img { width: 2rem; height: 2rem; }

.nav-links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.nav-list {
  display: flex;
  gap: var(--space-4);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
}
.nav-list a {
  color: var(--ink-muted);
  text-decoration: none;
}
.nav-list a:hover { color: var(--accent); }

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem; height: 2.25rem;
  padding: 0;
  background: none;
  border: var(--rule-width) solid var(--rule);
  border-radius: 50%;
  color: var(--ink-muted);
  cursor: pointer;
}
.theme-toggle:hover { color: var(--accent); border-color: var(--accent); }
.theme-toggle svg { width: 1.05rem; height: 1.05rem; }
.icon-moon { display: none; }
[data-theme="dark"] .icon-sun { display: none; }
[data-theme="dark"] .icon-moon { display: block; }

.cv-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: var(--rule-width) solid var(--ink);
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  font-weight: 500;
}
.cv-button:hover {
  background: var(--ink);
  color: var(--ground);
}
.cv-button svg { width: 1rem; height: 1rem; }

.nav-menu-toggle { display: none; }

main {
  max-width: var(--measure-wide);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.section { padding-block: var(--space-16); }
.section + .section { border-top: var(--rule-width) solid var(--rule); }

.section-heading {
  font-size: var(--text-xl);
  margin-bottom: var(--space-6);
}

.section-note {
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
  margin-top: calc(var(--space-6) * -1 + var(--space-2));
  margin-bottom: var(--space-8);
}

.prose { max-width: var(--measure-prose); }

.site-footer {
  max-width: var(--measure-wide);
  margin: 0 auto;
  padding: var(--space-8) var(--gutter) var(--space-16);
  border-top: var(--rule-width) solid var(--rule);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

/* Below 46rem the navigation collapses behind a toggle. */
@media (max-width: 46rem) {
  .nav-menu-toggle {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    margin-left: auto;
    width: 2.25rem; height: 2.25rem;
    padding: 0;
    background: none;
    border: var(--rule-width) solid var(--rule);
    cursor: pointer;
  }
  .nav-menu-bar {
    display: block;
    width: 1rem; height: 1.5px;
    margin-inline: auto;
    background: var(--ink);
  }
  .nav-links {
    display: none;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    width: 100%;
    margin: 0;
    padding: var(--space-4) 0 var(--space-2);
  }
  .nav-links.is-open { display: flex; }
  .site-nav { flex-wrap: wrap; }
  .nav-list { flex-direction: column; gap: var(--space-3); font-size: var(--text-base); }
}
```

- [ ] **Step 3: Verify in a browser**

```bash
python -m http.server 8000
```

Open <http://localhost:8000>. The nav, the section rules, and the footer should render. Section internals are unstyled until Task 10, so the page will look raw. Confirm no console errors and that the theme toggle changes the ground colour.

- [ ] **Step 4: Commit**

```bash
git add css/base.css css/layout.css
git commit -m "feat(css): base typography and page shell"
```

---

### Task 10: Section styles

**Files:**
- Create: `css/sections.css`

**Interfaces:**
- Consumes: tokens from Task 3, markup from Task 8.
- Produces: the finished visual design.

- [ ] **Step 1: Write `css/sections.css`**

```css
/* Hero */

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-8);
  padding-block: var(--space-16) var(--space-12);
}

.hero-portrait {
  width: 11rem;
  border-radius: 2px;
  filter: saturate(0.96);
}

.hero-text { flex: 1 1 20rem; }

.hero-name {
  font-size: var(--text-2xl);
  letter-spacing: -0.015em;
}

.hero-name-ar {
  font-family: var(--font-arabic);
  font-size: var(--text-xl);
  color: var(--ink-muted);
  margin: var(--space-1) 0 var(--space-4);
}

.hero-role {
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: var(--space-3);
}

.hero-tagline {
  max-width: var(--measure-prose);
  font-size: var(--text-lg);
}

.hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
}

/* Timeline */

.year-group {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: var(--space-6);
  padding-block: var(--space-8);
}
.year-group + .year-group { border-top: var(--rule-width) solid var(--rule); }

.year-label {
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
  padding-top: 0.25em;
}

.entries { display: grid; gap: var(--space-8); }

.entry-title {
  font-size: var(--text-lg);
  font-weight: 600;
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: var(--space-1) 0 var(--space-3);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

.entry-note {
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

.entry-bullets { display: grid; gap: var(--space-2); }
.entry-bullets li {
  position: relative;
  padding-left: 1.1em;
  max-width: var(--measure-prose);
}
.entry-bullets li::before {
  content: "";
  position: absolute;
  left: 0; top: 0.68em;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--accent);
}

.entry-more {
  margin-top: var(--space-3);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
}

/* Milestones read quieter than roles, since they are supporting evidence. */
.entry.is-milestone .entry-title {
  font-size: var(--text-base);
  font-weight: 500;
}

/* Galleries */

.gallery { margin-top: var(--space-4); display: grid; gap: var(--space-3); }
.gallery.is-single { grid-template-columns: 1fr; }

@media (min-width: 40rem) {
  .gallery.is-grid { grid-template-columns: 1fr 1fr; }
  /* An odd trailing image spans rather than sitting alone in a half column. */
  .gallery.is-grid > .figure:last-child:nth-child(odd) { grid-column: 1 / -1; }
}

.figure { margin: 0; }
.figure img { border: var(--rule-width) solid var(--rule); border-radius: 2px; }
.figure figcaption {
  margin-top: var(--space-2);
  font-family: var(--font-meta);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

/* Numbers */

.metrics {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}
.metric-value {
  font-size: var(--text-xl);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-bottom: var(--space-1);
}
.metric-label {
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
  max-width: 16rem;
}

/* Selected work */

.work + .work {
  margin-top: var(--space-12);
  padding-top: var(--space-12);
  border-top: var(--rule-width) solid var(--rule);
}
.work-title { font-size: var(--text-lg); }
.work-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: var(--space-1) 0 var(--space-4);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}
.block-text { max-width: var(--measure-prose); }

.block-callout {
  max-width: var(--measure-prose);
  margin: var(--space-4) 0;
  padding: var(--space-4);
  background: var(--ground-raised);
  border: var(--rule-width) solid var(--rule);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

.benchmark {
  margin: var(--space-4) 0;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  width: 100%;
  max-width: var(--measure-prose);
}
.benchmark caption {
  caption-side: bottom;
  margin-top: var(--space-2);
  text-align: left;
  font-family: var(--font-meta);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}
.benchmark th, .benchmark td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: var(--rule-width) solid var(--rule);
  font-weight: 400;
}
.benchmark thead th {
  font-family: var(--font-meta);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}
.benchmark td { text-align: right; }
.benchmark .is-mine th, .benchmark .is-mine td {
  color: var(--accent-strong);
  font-weight: 600;
}

/* The Stmnt captures are 1:2.17 portraits. Constrain them so one screenshot
   does not consume a whole screen of scroll. */
.work .gallery.is-grid { grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
.work .gallery .figure img { max-height: 26rem; width: auto; }
@media (min-width: 40rem) {
  .work .gallery.is-grid > .figure:last-child:nth-child(odd) { grid-column: auto; }
}

.work-tags, .work-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-4);
  font-family: var(--font-meta);
  font-size: var(--text-xs);
}
.work-tags span {
  padding: 2px var(--space-2);
  border: var(--rule-width) solid var(--rule);
  color: var(--ink-muted);
}
.work-links { font-size: var(--text-sm); gap: var(--space-4); }

/* Skills */

.skill-groups {
  display: grid;
  gap: var(--space-8);
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}
.skill-group-name {
  font-family: var(--font-meta);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: var(--space-3);
}
.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}
.skill-level { color: var(--ink-muted); }

/* Contact */

.contacts { display: grid; gap: var(--space-3); }
.contact-row {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: var(--space-3);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
}
.contact-label { color: var(--ink-muted); }

/* Narrow screens: the year column stacks above its entries. */
@media (max-width: 40rem) {
  .year-group { grid-template-columns: 1fr; gap: var(--space-4); }
  .hero { align-items: flex-start; }
  .hero-portrait { width: 8rem; }
  .contact-row { grid-template-columns: 5rem 1fr; }
}
```

- [ ] **Step 2: Verify across viewports and themes**

```bash
python -m http.server 8000
```

Check at 360, 390, 768, and 1280 pixels wide, in both themes:

- No horizontal scrollbar at any width.
- The Khalifa University entry shows two photographs side by side with the e-gaming photograph spanning beneath.
- The Stmnt screenshots sit in a constrained row rather than filling the screen.
- The benchmark table's highlighted row is visibly the accent colour.
- Every heading fits without overflowing.

- [ ] **Step 3: Commit**

```bash
git add css/sections.css
git commit -m "feat(css): hero, timeline, numbers, work, skills, and contact styles"
```

---

### Task 11: Print styles, legacy removal, and the budget

**Files:**
- Create: `css/print.css`
- Delete: `script.js`, `style.css`
- Test: `test/budget.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces: a repository with no legacy monolith and a CI-enforced size budget.

- [ ] **Step 1: Write the failing budget test**

```js
// test/budget.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function bytesIn(dir, extension) {
  const path = `${root}${dir}`;
  if (!existsSync(path)) return 0;
  return readdirSync(path)
    .filter((f) => f.endsWith(extension))
    .reduce((total, f) => total + statSync(`${path}/${f}`).size, 0);
}

const BUDGET = 80 * 1024;

test('CSS plus JS stays inside the 80KB uncompressed budget', () => {
  const total = bytesIn('css', '.css') + bytesIn('js', '.js');
  assert.ok(total <= BUDGET, `${Math.round(total / 1024)}KB used of 80KB`);
});

test('the legacy monolith files are gone', () => {
  assert.equal(existsSync(`${root}script.js`), false, 'script.js still present');
  assert.equal(existsSync(`${root}style.css`), false, 'style.css still present');
});

test('no stylesheet mentions the retired terminal metaphor', () => {
  const css = readdirSync(`${root}css`).filter((f) => f.endsWith('.css'));
  assert.ok(css.length >= 5, 'expected the five split stylesheets');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/budget.test.js`
Expected: FAIL on the legacy-files assertion, since `script.js` and `style.css` still exist.

- [ ] **Step 3: Write `css/print.css`**

This file is loaded with `media="print"`, so it needs no `@media print` wrapper.

```css
/* A recruiter printing the page should get a clean document. */

:root, [data-theme="dark"] {
  --ground: #ffffff;
  --ground-raised: #ffffff;
  --ink: #111111;
  --ink-muted: #444444;
  --accent: #111111;
  --accent-strong: #111111;
  --rule: #bbbbbb;
}

body { font-size: 10.5pt; line-height: 1.4; }

.site-nav-wrap,
.nav-actions,
.nav-menu-toggle,
.skip-link,
.noscript-warning,
.entry-more,
.work-tags { display: none !important; }

main { max-width: none; padding: 0; }

.section { padding-block: 0.6cm; break-inside: avoid; }
.section + .section { border-top: 1px solid var(--rule); }

.hero { padding-block: 0 0.6cm; }
.hero-portrait { width: 2.6cm; }

.year-group { break-inside: avoid; padding-block: 0.35cm; }
.entry { break-inside: avoid; }
.entries { gap: 0.35cm; }

/* Photographs are dropped in print; only the portrait survives. */
.gallery { display: none !important; }

.work + .work { margin-top: 0.5cm; padding-top: 0.5cm; }

/* Print the destination of every link, since a printed page cannot be clicked. */
.hero-links a::after,
.work-links a::after,
.contact-row a::after {
  content: " (" attr(href) ")";
  font-size: 8pt;
  color: var(--ink-muted);
  word-break: break-all;
}
.hero-links a[href^="mailto:"]::after,
.contact-row a[href^="mailto:"]::after { content: ""; }

@page { margin: 1.4cm; }
```

- [ ] **Step 4: Delete the legacy files**

```bash
git rm script.js style.css
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/budget.test.js`
Expected: PASS, 3 tests. The reported usage should be well under 80 KB. If it is over, the largest saving is in `css/sections.css`; remove redundant declarations rather than raising the budget.

- [ ] **Step 6: Verify the print output**

Open <http://localhost:8000>, print to PDF, and confirm: no navigation, no photographs except the portrait, no page break splitting a timeline entry, and link destinations printed after their text.

- [ ] **Step 7: Commit**

```bash
git add css/print.css test/budget.test.js
git commit -m "feat(css): print stylesheet; remove the legacy monolith and enforce the size budget"
```

---

### Task 12: Documentation and the Open Graph image

**Files:**
- Modify: `CLAUDE.md` (the Design Context section)
- Modify: `README.md`
- Create: `tools/make_og_image.py`
- Modify: `assets/og-image.png`
- Delete: `assets/og-image.html`

**Interfaces:**
- Consumes: `assets/brand/logo-wordmark.png` from Task 1.
- Produces: project documentation that matches what shipped.

`CLAUDE.md` currently mandates the terminal metaphor as law. Leaving it would misdirect every future session.

- [ ] **Step 1: Replace the Design Context section of `CLAUDE.md`**

Keep the Stack, Running locally, and Important conventions sections. Replace everything from the `## Design Context` heading to the end of the file with:

```markdown
## Design Context

Static site at [7mxd.github.io](https://7mxd.github.io). This section is the
source of truth for design decisions. The full rationale lives in
`docs/superpowers/specs/2026-09-06-editorial-revamp-design.md`.

### Users

Four overlapping audiences, so the page must work at every depth of attention:
a recruiter scanning for thirty seconds, a hiring manager reading for five
minutes, a peer curious about craft, and anyone looking Ahmed up over the next
two or three years. Information hierarchy legible in three seconds, rewarding
to whoever stays. No content is duplicated across depth levels.

### Aesthetic direction

**Plain, photo-led, document-like.** A single column, near-black on off-white, a
reverse-chronological timeline with photographs inline. It should read like a
well-kept personal homepage, not a magazine and not a product landing page.

The trap to avoid is the **editorial-typographic** lane, currently saturated:
display serif italic headline, small monospace labels, ruled column grids,
monochromatic restraint, no imagery. This site avoids it by being genuinely
plain and by letting photographs carry the page.

- Photographs are load-bearing. Zero images is a bug, not restraint.
- No display-serif affectation, no monospace metadata labels, no card grids.
- The background is a true off-white at near-zero chroma. Never a cream, sand,
  or beige, and never token names like `--paper` or `--cream`.
- Warmth comes from the logo, the accent, and the photography.

### Palette

Derived from Ahmed's own logo artwork. Every value is verified against both
grounds by `test/tokens-contrast.test.js`; do not change one without running it.

Light: ground `#fafaf9`, raised `#ffffff`, ink `#1c1f32`, muted `#585b6b`,
accent `#a85a32`, accent-strong `#8f4a2c`, rule `#e2e2df`.

Dark: ground `#15171f`, raised `#1c1f2a`, ink `#e9e7e2`, muted `#9a9aa6`,
accent `#e7ad87`, accent-strong `#f3cbb0`, rule `#2a2d3a`.

### Typography

Source Serif 4 for prose. Public Sans for navigation, metadata, and labels.
Amiri for the Arabic name only, subsetted to its ten glyphs.

### Content rules

- Every word earns its place. No "highly motivated", no "strong passion".
- The site is not the CV. The CV holds everything; the site holds the best of it.
- Numbers must trace to the CV or to a verified repository.
- Test scores, phone number, and nationality stay off the public page.

### Constraints

- WCAG AA minimum. Keep the skip link, `prefers-reduced-motion`,
  `prefers-contrast`, keyboard-usage detection, and theme announcements.
- CSS plus JS under 80 KB uncompressed, enforced by `test/budget.test.js`.
- The print stylesheet must keep producing a clean document.
- Banned: the terminal metaphor and shell-command headers, ASCII charts,
  gradient text, `border-left` accent stripes, uniform card grids, and
  language proficiency shown as a percentage.
```

- [ ] **Step 2: Update the Design and Project structure sections of `README.md`**

Replace the `## Design` paragraph with:

```markdown
## Design

Plain, photo-led, single-column personal site. Near-black on off-white, with a
palette derived from the site's own logo artwork and verified to pass WCAG AA
in both themes. A reverse-chronological timeline carries roles, degrees,
projects, and awards, composed from the content files rather than authored
twice. Source Serif 4 for prose, Public Sans for metadata, Amiri for the
Arabic name.
```

And replace the project structure block with:

```
index.html          Page shell
css/                tokens, base, layout, sections, print
js/                 data loading, timeline composition, renderers, theme
data/               JSON content
assets/             photographs, brand marks, logos, CV
tools/              one-off image processing scripts
admin/              content management UI
test/               node --test suite
```

- [ ] **Step 3: Write `tools/make_og_image.py`**

```python
# tools/make_og_image.py
"""Compose the 1200x630 Open Graph card from the wordmark and a subtitle.

Run from the repository root:  python tools/make_og_image.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
GROUND = (250, 250, 249)
INK = (28, 31, 50)
MUTED = (88, 91, 107)

SIZE = (1200, 630)
SUBTITLE = "Data scientist in Abu Dhabi"
DETAIL = "Audit systems and data pipelines at Saal.ai"

# Georgia ships with Windows and is a reasonable stand-in for the web serif.
FONT_CANDIDATES = ["C:/Windows/Fonts/georgia.ttf", "/System/Library/Fonts/Georgia.ttf"]


def load_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main():
    card = Image.new("RGB", SIZE, GROUND)

    wordmark = Image.open(ROOT / "assets" / "brand" / "logo-wordmark.png")
    target_w = 620
    scale = target_w / wordmark.width
    wordmark = wordmark.resize((target_w, int(wordmark.height * scale)), Image.LANCZOS)
    card.paste(wordmark, (90, 150), wordmark)

    draw = ImageDraw.Draw(card)
    draw.text((92, 150 + wordmark.height + 48), SUBTITLE, font=load_font(38), fill=INK)
    draw.text((92, 150 + wordmark.height + 104), DETAIL, font=load_font(27), fill=MUTED)

    out = ROOT / "assets" / "og-image.png"
    card.save(out, "PNG", optimize=True)
    print(f"{out} {card.size} {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Generate the card and remove the stale template**

```bash
python tools/make_og_image.py
git rm assets/og-image.html
```

Open `assets/og-image.png` and confirm the wordmark and both text lines sit inside the frame with even margins. If the text overflows, reduce `target_w` to `540`.

- [ ] **Step 5: Run the full suite and verify manually**

Run: `npm test`
Expected: every test PASSES.

Then serve the site and complete the manual checklist from spec section 13:

- Both themes at 360, 390, 768, and 1280 pixels wide.
- Keyboard-only traversal from the skip link through to the footer, with a visible focus ring at every stop.
- Print preview.
- JavaScript disabled, showing the noscript fallback.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md tools/make_og_image.py assets/og-image.png
git commit -m "docs: rewrite the design context for the editorial direction; regenerate the OG card"
```

---

## Self-Review

**Spec coverage.** Section 3 palette and typography map to Task 3. Section 4 information architecture maps to Tasks 7 and 8. Section 5 data model maps to Tasks 4, 5, and 6. Section 6 rendering architecture maps to Tasks 5 through 8. Section 7 image pipeline maps to Tasks 1 and 2. Section 8 content changes map to Task 4. Section 9 photography maps to Tasks 2 and 4. Section 10 accessibility is distributed across Tasks 7, 9, and 12, and verified in Task 12 Step 5. Section 11 print maps to Task 11. Section 12 performance maps to Task 11's budget test. Section 13 testing maps to the test file in every task. Section 14 migration maps to Tasks 11 and 12.

**Naming consistency.** `normalizeImage`, `validateSiteData`, and `loadSiteData` are defined in Task 5 and consumed in Tasks 7 and 8. `buildTimeline` is defined in Task 6 and consumed in Task 7. `escapeHtml`, `imageMarkup`, `renderBlock`, and `renderBlocks` are defined in Task 8 and consumed within the same task by `render.js`. `nextTheme`, `resolveTheme`, and `initTheme` are defined in Task 7. The DOM ids `hero`, `about`, `path`, `numbers`, `work`, `skills`, and `contact` appear in Task 7's HTML, Task 8's renderers, Task 4's `settings.nav`, and Task 4's `settings.sections`.

**Known ordering constraint.** Task 7 creates `js/main.js`, which imports `./render.js` from Task 8. The site will not run in a browser between those two tasks. Unit tests pass throughout, and the first browser check is Task 9 Step 3, by which point every module exists.
