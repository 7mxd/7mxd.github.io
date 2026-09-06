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
