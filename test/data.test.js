import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../js/data.js';

const raw = {
  profile: { name:'A', title:'t', contact:{ email:'e', phone:'p', location:'l',
             linkedin:{url:'u',label:'LinkedIn'}, github:{url:'g',label:'GitHub'} } },
  summary: { content:'s' },
  experience: { items:[ { company:'Saal', location:'AD', roles:[
                 { title:'r', displayDate:'d', blocks:[] } ] } ] },
  projects: { items:[ { title:'P', status:'shipped', tags:['Python'], links:{}, blocks:[] } ] },
  skills: { categories:[ { name:'langs', type:'languages', items:[{name:'Arabic',level:'native'}] } ] },
  education: { items:[ { institution:'KU', degree:'BSc', displayDate:'x', grade:'3.3', blocks:[] } ] },
  settings: { cv:{path:'c',downloadName:'cv'}, siteTitle:'st', navLogo:'AR',
              meta:{}, sections:{}, statuses:{} }
};

test('normalizeData fills cluster defaults', () => {
  const m = normalizeData(raw);
  assert.equal(m.experience[0].cluster, 'data');
  assert.equal(m.education[0].cluster, 'math');
  assert.equal(m.projects[0].cluster, 'engineering');
});
test('normalizeData guarantees tags arrays', () => {
  const m = normalizeData(raw);
  assert.deepEqual(m.experience[0].tags, []);
  assert.deepEqual(m.projects[0].tags, ['Python']);
});
test('normalizeData guarantees graph.clusters with three keys', () => {
  const m = normalizeData(raw);
  assert.deepEqual(Object.keys(m.settings.graph.clusters).sort(),
    ['data','engineering','math']);
});
test('explicit cluster is preserved', () => {
  const r = structuredClone(raw); r.projects.items[0].cluster = 'math';
  assert.equal(normalizeData(r).projects[0].cluster, 'math');
});
