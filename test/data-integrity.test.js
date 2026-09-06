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
  if (profile.portrait) out.push(profile.portrait);
  for (const c of experience.items) for (const r of c.roles) out.push(...(r.images ?? []));
  for (const e of education.items) out.push(...(e.images ?? []));
  for (const p of projects.items) out.push(...(p.images ?? []));
  for (const m of milestones.items) out.push(...(m.images ?? []));
  return out;
}

// Walk JPEG segment markers to read the SOF frame dimensions. Same approach
// as test/assets-photos.test.js:21 — reused rather than reinvented, so both
// tests agree on how a JPEG's real dimensions are read.
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

test('declared dimensions match the real file, so Task 8 does not lay out a lie', () => {
  for (const img of everyImage()) {
    // Every image in the data is a JPEG derivative from tools/process_photos.py.
    // Assert that rather than assume it, so a future PNG entry fails loudly
    // here instead of silently skipping dimension verification.
    assert.match(img.src, /\.jpe?g$/i, `expected a JPEG derivative, got ${img.src}`);
    const { width, height } = jpegSize(readFileSync(repoFile(img.src)));
    assert.equal(img.width, width, `declared width ${img.width} does not match actual ${width} for ${img.src}`);
    assert.equal(img.height, height, `declared height ${img.height} does not match actual ${height} for ${img.src}`);
  }
});

// The srcset `w` descriptor is the browser's only measure of how much
// resolution a candidate actually has. tools/process_photos.py caps the LONG
// edge, so six of the nine photographs have a small variant far narrower than
// the 800 in its filename — 369 for the Stmnt captures, 478 for the volunteer
// photograph, 622 for the portrait. Declaring 800 for all of them told the
// browser they were higher-resolution than they are.
test('every image declares widthSmall, and it matches the small file on disk', () => {
  for (const img of everyImage()) {
    assert.equal(typeof img.widthSmall, 'number', `widthSmall missing for ${img.src}`);
    const { width } = jpegSize(readFileSync(repoFile(img.srcSmall)));
    assert.equal(img.widthSmall, width, `declared widthSmall ${img.widthSmall} is not ${width} for ${img.srcSmall}`);
    assert.ok(img.widthSmall < img.width, `${img.srcSmall} is not smaller than ${img.src}`);
  }
});

test('the CV path in settings resolves, and the superseded CV is gone', () => {
  assert.ok(existsSync(repoFile(settings.cv.path)), `missing ${settings.cv.path}`);
  assert.match(settings.cv.path, /2026/, 'settings still points at the old CV');
  // Spec section 14: the 2025 CV is replaced, not kept alongside. Leaving it
  // committed ships an unreferenced, stale copy of Ahmed's CV to the public web.
  assert.equal(existsSync(repoFile('assets/ahmed_radhi_cv_2025.pdf')), false, 'the 2025 CV is still committed');
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

// Spec section 4: the numbers strip carries "quantities that appear nowhere
// else on the page". All four shipped in the prose as well — 28/38 twice more,
// the six Delegation of Authority controls in Selected Work, 35+ currencies in
// the Stmnt description, nine freshmen in the mentoring milestone — which is
// the no-duplication rule regressing inside the section built to honour it.
test('the numbers strip owns its figures: none appears anywhere else in the data', () => {
  const elsewhere = JSON.stringify([profile, load('summary'), experience, education, projects, milestones]);
  const inStrip = JSON.stringify(metrics);
  const figures = [
    { metric: '28 / 38 exception checks', elsewhere: /\b(28|38|twenty-eight|thirty-eight)\b/i, strip: /28 \/ 38/ },
    { metric: '6 Delegation of Authority controls', elsewhere: /\bsix\b/i, strip: /Delegation of Authority/ },
    { metric: '35+ currencies', elsewhere: /\b(35|thirty-five)\b/i, strip: /35\+/ },
    { metric: '9 freshmen mentored', elsewhere: /\bnine\b/i, strip: /freshmen/ },
  ];
  for (const f of figures) {
    assert.match(inStrip, f.strip, `${f.metric} is not in metrics.json — the strip lost a figure`);
    const hit = elsewhere.match(f.elsewhere);
    assert.equal(hit, null, `"${hit && hit[0]}" from the ${f.metric} metric also appears in the prose`);
  }
});

test('by-the-numbers metrics each carry a value and a label', () => {
  assert.ok(metrics.items.length >= 3);
  for (const m of metrics.items) {
    assert.ok(m.value && m.label, `incomplete metric: ${JSON.stringify(m)}`);
  }
});
