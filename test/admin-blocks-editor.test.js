import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlocks } from '../admin/blocks-editor.js';

/** A DOM small enough to read and faithful in the two respects this bug turns
 *  on: setting `innerHTML = ''` DETACHES the children it removes, and an event
 *  only reaches a listener if it can walk a parent chain from its target to
 *  that listener. Everything else is the minimum blocks-editor.js touches.
 *
 *  A stub can always lie, so the fix is also exercised in a real browser (see
 *  the harness in the task that added this file). What the stub buys is a
 *  guard that runs in `npm test` on a machine with no browser at all. */
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.textContent = '';
    this.type = '';
    this.value = '';
    this.hidden = false;
    this.onclick = null;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  remove() { this.parentNode?.removeChild(this); }
  contains(n) { return n === this || this.childNodes.some((c) => c.contains(n)); }
  /** The one selector drawFields uses. Anything else would be a silent lie. */
  querySelectorAll(sel) {
    assert.equal(sel, ':scope > .field', `stub does not model the selector ${sel}`);
    return this.childNodes.filter((c) => c.className === 'field');
  }
  querySelector() { return null; }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n.isRoot === true;
  }
  appendChild(c) {
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.childNodes.push(c);
    return c;
  }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  removeChild(c) {
    this.childNodes = this.childNodes.filter((x) => x !== c);
    c.parentNode = null;
    return c;
  }
  /** Assigning innerHTML replaces every child, and — the part this bug turns
   *  on — DETACHES the ones it removes. Markup in `v` is not parsed: the only
   *  non-empty assignment in blocks-editor.js is the "+ Add block…" option
   *  list, which no test here reads. Parsing it would add a lie, not fidelity. */
  set innerHTML(v) {
    this.unparsedMarkup = v;
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
  }
  get innerHTML() { return this.unparsedMarkup ?? ''; }
  addEventListener(t, fn) {
    if (!this.listeners.has(t)) this.listeners.set(t, []);
    this.listeners.get(t).push(fn);
  }
  dispatchEvent(ev) {
    // Bubbling walks the parent chain. A detached node's chain is one node
    // long, which is exactly why the old code's event reached nobody.
    let n = this;
    while (n) {
      for (const fn of n.listeners.get(ev.type) || []) fn(ev);
      n = ev.bubbles ? n.parentNode : null;
    }
    return true;
  }
  closest() { return null; }
}

function domFixture() {
  const doc = {
    createElement: (tag) => new N(tag),
    // fields.js's drawFields is handed this same fake document.
    createTextNode: (t) => Object.assign(new N('#text'), { textContent: t }),
  };
  const panel = new N('div');
  panel.isRoot = true;
  const container = panel.appendChild(new N('div'));
  return { doc, panel, container };
}

const REGISTRY = {
  note: { scope: ['project'], label: 'Note', fields: [{ name: 'content', type: 'string', label: 'Content' }] },
};

/** Click the nth button carrying `label` anywhere under `root`. */
function clickButton(root, label, nth = 0) {
  const found = [];
  (function walk(n) {
    if (n.tagName === 'BUTTON' && n.textContent === label) found.push(n);
    n.childNodes.forEach(walk);
  })(root);
  assert.ok(found[nth], `no "${label}" button at index ${nth}`);
  found[nth].onclick();
}

test('removing a block reports the edit to the panel above it', () => {
  // The defect: the strip holding the buttons was detached by the rerender
  // BEFORE it dispatched, so `input` reached nobody. Nothing marked the
  // collection dirty, the preview never updated, and pressing Save after
  // reordering blocks said "Nothing to publish" while the edit sat in memory.
  const { doc, panel, container } = domFixture();
  const blocks = [{ type: 'note', content: 'one' }, { type: 'note', content: 'two' }];
  let heard = 0;
  panel.addEventListener('input', () => { heard += 1; });

  globalThis.document = doc;
  try {
    renderBlocks(container, blocks, 'project', REGISTRY, {});
    clickButton(container, 'Remove');
  } finally {
    delete globalThis.document;
  }

  assert.equal(blocks.length, 1, 'the block was actually removed');
  assert.equal(heard, 1, 'the panel was told the record changed');
});

test('reordering blocks reports the edit to the panel above it', () => {
  const { doc, panel, container } = domFixture();
  const blocks = [{ type: 'note', content: 'one' }, { type: 'note', content: 'two' }];
  let heard = 0;
  panel.addEventListener('input', () => { heard += 1; });

  globalThis.document = doc;
  try {
    renderBlocks(container, blocks, 'project', REGISTRY, {});
    clickButton(container, '↓'); // the first row's "down"
  } finally {
    delete globalThis.document;
  }

  assert.equal(blocks[0].content, 'two', 'the blocks actually swapped');
  assert.equal(heard, 1, 'the panel was told the record changed');
});
