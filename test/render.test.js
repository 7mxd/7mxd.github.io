import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProjects, renderSkills, renderExperience } from '../js/render.js';

const model = {
  settings: { sections:{ projects:{enabled:true}, skills:{enabled:true}, experience:{enabled:true} },
              statuses:{ shipped:{label:'shipped',glyph:'✓',tone:'neutral'} } },
  projects: [ { title:'Stmnt', status:'shipped', tags:['Flutter'], links:{ios:'x'}, blocks:[{type:'description',content:'desc'}] } ],
  skills: { categories:[ { name:'langs', type:'languages', items:[{name:'Arabic',level:'native'}] },
                         { name:'tools', type:'tags', items:[{name:'Python'}] } ] },
  experience: [ { company:'Saal', location:'AD', cluster:'data', tags:[], roles:[
                  { title:'Trainee', displayDate:'2024-now', blocks:[{type:'responsibility',content:'did x'}] } ] } ]
};

test('renderProjects includes title, status label, tag, and block content', () => {
  const h = renderProjects(model);
  assert.ok(h.includes('Stmnt'));
  assert.ok(h.includes('shipped'));
  assert.ok(h.includes('Flutter'));
  assert.ok(h.includes('desc'));
});
test('renderSkills renders language level and a tag', () => {
  const h = renderSkills(model);
  assert.ok(h.includes('Arabic'));
  assert.ok(h.includes('native'));
  assert.ok(h.includes('Python'));
});
test('renderExperience includes company, role and responsibility', () => {
  const h = renderExperience(model);
  assert.ok(h.includes('Saal') && h.includes('Trainee') && h.includes('did x'));
});
test('disabled section returns empty string', () => {
  const m = structuredClone(model); m.settings.sections.projects.enabled = false;
  assert.equal(renderProjects(m), '');
});
