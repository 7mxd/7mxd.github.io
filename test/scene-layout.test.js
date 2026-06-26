import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/scene/layout.js';

const graph = {
  nodes: [
    { id:'proj:0', kind:'entity', cluster:'engineering' },
    { id:'edu:0', kind:'entity', cluster:'math' },
    { id:'tool:python', kind:'tool', cluster:null },
  ],
  edges: [ { source:'proj:0', target:'tool:python' }, { source:'edu:0', target:'tool:python' } ]
};

test('returns finite positions for every node', () => {
  const pos = computeLayout(graph, { seed: 7 });
  for (const n of graph.nodes) { const p = pos.get(n.id);
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)); }
});
test('entity sits nearer its region center than other regions', () => {
  const centers = { math:{x:-130,y:0,z:0}, data:{x:130,y:0,z:-40}, engineering:{x:0,y:10,z:130} };
  const pos = computeLayout(graph, { seed: 1, regionCenters: centers });
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const p = pos.get('edu:0');
  assert.ok(d(p, centers.math) < d(p, centers.data));
  assert.ok(d(p, centers.math) < d(p, centers.engineering));
});
test('deterministic for a given seed', () => {
  const a = computeLayout(graph, { seed: 42 }); const b = computeLayout(graph, { seed: 42 });
  assert.deepEqual([...a.entries()], [...b.entries()]);
});
