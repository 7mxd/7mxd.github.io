export function buildNodes(THREE, engine, graph, layout, palette) {
  const group = new THREE.Group();
  const byId = new Map();
  const meshes = [];
  const sphere = new THREE.SphereGeometry(1, 20, 20);
  const toolColor = new THREE.Color(0x9aa1aa);

  for (const n of graph.nodes) {
    const p = layout.get(n.id); if (!p) continue;
    const isEntity = n.kind === 'entity';
    const color = isEntity ? new THREE.Color(palette[n.cluster] || '#8a8f98') : toolColor;
    const radius = isEntity ? 6 + Math.min(n.weight || 1, 8) : 2.0;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: isEntity ? 1.1 : 0.5,
      roughness: isEntity ? 0.35 : 0.4, metalness: 0, transparent: true, opacity: isEntity ? 1 : 0.85
    });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(p.x, p.y, p.z); mesh.scale.setScalar(radius);
    mesh.userData = { id: n.id, node: n, baseEmissive: mat.emissiveIntensity, radius };
    group.add(mesh); meshes.push(mesh);
    byId.set(n.id, { mesh, position: mesh.position.clone(), node: n });
  }

  const rmQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = rmQuery ? rmQuery.matches : false;
  const entranceStart = performance.now();
  const ENTRANCE_DUR = 1100;
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  if (!reducedMotion) {
    for (const m of meshes) {
      m.scale.setScalar(0);
      m.material.opacity = 0;
    }
  }

  engine.scene.add(group);

  function update(t) {
    const now = performance.now();
    const ep = easeOutCubic(Math.min(1, (now - entranceStart) / ENTRANCE_DUR));
    for (const m of meshes) {
      const e = m.userData;
      if (ep < 1) {
        m.scale.setScalar(e.radius * ep);
        m.material.opacity = (e.node.kind === 'entity' ? 1 : 0.85) * ep;
      } else {
        m.scale.setScalar(e.radius);
        m.material.opacity = e.node.kind === 'entity' ? 1 : 0.85;
      }
      if (e.node.kind !== 'entity') continue;
      m.material.emissiveIntensity = e.baseEmissive + Math.sin(t * 1.3 + e.radius) * 0.15; // breathing
    }
  }
  return { group, byId, meshes, update };
}
