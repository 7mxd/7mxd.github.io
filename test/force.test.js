import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../js/force.js';

function seed(nodes) { nodes.forEach((n,i)=>{ n.x=(i+1)*40; n.y=(i%2)*30; n.vx=0; n.vy=0; }); }

test('step returns finite energy and keeps coordinates finite', () => {
  const nodes=[{id:'a'},{id:'b'},{id:'c'}]; seed(nodes);
  const edges=[{source:'a',target:'b'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600});
  const e=sim.step();
  assert.ok(Number.isFinite(e));
  for (const n of nodes){ assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y)); }
});
test('connected nodes move closer over many steps than disconnected ones drift apart', () => {
  const nodes=[{id:'a'},{id:'b'},{id:'c'}]; seed(nodes);
  const edges=[{source:'a',target:'b'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600,springLength:30});
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  const before=dist(nodes[0],nodes[1]);
  for (let i=0;i<300;i++) sim.step();
  const after=dist(nodes[0],nodes[1]);
  assert.ok(after < before + 1, `expected spring to pull a,b together (before ${before}, after ${after})`);
});
test('energy trends toward zero (system settles)', () => {
  const nodes=Array.from({length:6},(_,i)=>({id:String(i)})); seed(nodes);
  const edges=[{source:'0',target:'1'},{source:'1',target:'2'},{source:'2',target:'3'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600});
  let last=Infinity, e;
  for (let i=0;i<1000;i++) e=sim.step();
  assert.ok(e < 5, `expected low residual energy, got ${e}`);
});
