function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DEFAULT_CENTERS = {
  math: { x: -130, y: 0, z: 0 },
  data: { x: 130, y: 0, z: -40 },
  engineering: { x: 0, y: 10, z: 130 }
};
export function computeLayout(graph, opts = {}) {
  const seed = opts.seed ?? 1;
  const centers = opts.regionCenters || DEFAULT_CENTERS;
  const spread = opts.radius ?? 120;
  const rng = mulberry32(seed);
  const jit = (s) => (rng() - 0.5) * s;
  const pos = new Map();
  const center = { x: 0, y: 0, z: 0 };

  // entities first
  for (const n of graph.nodes) {
    if (n.kind !== 'entity') continue;
    const c = centers[n.cluster] || center;
    pos.set(n.id, { x: c.x + jit(spread * 0.6), y: c.y + jit(spread * 0.5), z: c.z + jit(spread * 0.6) });
  }
  // tools at mean of connected entity centers
  const neighborCenters = new Map(); // toolId -> [centers]
  for (const e of graph.edges) {
    const ent = pos.has(e.source) ? e.source : (pos.has(e.target) ? e.target : null);
    const tool = ent === e.source ? e.target : e.source;
    if (!ent) continue;
    const node = graph.nodes.find(n => n.id === ent);
    const c = centers[node?.cluster] || center;
    if (!neighborCenters.has(tool)) neighborCenters.set(tool, []);
    neighborCenters.get(tool).push(c);
  }
  for (const n of graph.nodes) {
    if (n.kind !== 'tool') continue;
    const cs = neighborCenters.get(n.id);
    let base = center;
    if (cs && cs.length) base = { x: cs.reduce((s,c)=>s+c.x,0)/cs.length, y: cs.reduce((s,c)=>s+c.y,0)/cs.length, z: cs.reduce((s,c)=>s+c.z,0)/cs.length };
    pos.set(n.id, { x: base.x + jit(spread), y: base.y + jit(spread * 0.8), z: base.z + jit(spread) });
  }
  return pos;
}
