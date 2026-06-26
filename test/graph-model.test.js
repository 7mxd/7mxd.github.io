import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveGraph } from '../js/graph-model.js';

const model = {
  experience: [ { company:'Saal', cluster:'data', tags:['Python','Docker'], roles:[] } ],
  projects:   [ { title:'Stmnt', cluster:'engineering', tags:['Supabase','Docker'], blocks:[] } ],
  education:  [ { institution:'KU', cluster:'math', blocks:[] } ],
  skills:     { categories:[ { name:'lang', type:'tags', items:[{name:'Python'}] } ] }
};

test('entity nodes are created for each project/experience/education item', () => {
  const g = deriveGraph(model);
  const ids = g.nodes.filter(n => n.kind==='entity').map(n => n.id).sort();
  assert.deepEqual(ids, ['edu:0','exp:0','proj:0']);
});
test('tool nodes are de-duplicated across sources', () => {
  const g = deriveGraph(model);
  const tools = g.nodes.filter(n => n.kind==='tool').map(n => n.label).sort();
  assert.deepEqual(tools, ['Docker','Python','Supabase']);
});
test('shared tool becomes a cross-cluster bridge edge set', () => {
  const g = deriveGraph(model);
  const docker = g.nodes.find(n => n.label==='Docker');
  const touching = g.edges.filter(e => e.source===docker.id || e.target===docker.id).length;
  assert.equal(touching, 2); // Saal + Stmnt
});
test('toolUsage counts entities per tool', () => {
  const g = deriveGraph(model);
  const docker = g.nodes.find(n => n.label==='Docker');
  assert.equal(g.toolUsage[docker.id], 2);
});
test('entity ref points to section + index for scroll', () => {
  const g = deriveGraph(model);
  const stmnt = g.nodes.find(n => n.id==='proj:0');
  assert.deepEqual(stmnt.ref, { section:'projects', index:0 });
});
