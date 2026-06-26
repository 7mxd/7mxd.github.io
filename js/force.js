export function createSimulation(nodes, edges, config = {}) {
  const cfg = {
    repulsion: 1400, springLength: 60, springK: 0.1, damping: 0.85,
    centerGravity: 0.002, clusterGravity: 0.01, clusterCenters: {},
    width: 800, height: 600, ...config
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cx = cfg.width / 2, cy = cfg.height / 2;

  function step() {
    // repulsion (O(n^2) — fine for our node counts)
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx*dx + dy*dy || 0.01;
        const f = cfg.repulsion / d2;
        const d = Math.sqrt(d2);
        const fx = (dx/d)*f, fy = (dy/d)*f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    // springs along edges
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d - cfg.springLength) * cfg.springK;
      const fx = (dx/d)*f, fy = (dy/d)*f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    // gravity toward center and cluster centroid
    let energy = 0;
    for (const n of nodes) {
      n.vx += (cx - n.x) * cfg.centerGravity;
      n.vy += (cy - n.y) * cfg.centerGravity;
      const cc = n.cluster && cfg.clusterCenters[n.cluster];
      if (cc) {
        n.vx += (cc.x - n.x) * cfg.clusterGravity;
        n.vy += (cc.y - n.y) * cfg.clusterGravity;
      }
      n.vx *= cfg.damping; n.vy *= cfg.damping;
      n.x += n.vx; n.y += n.vy;
      energy += n.vx*n.vx + n.vy*n.vy;
    }
    return energy;
  }
  return { step };
}
