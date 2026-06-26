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
    const radius = isEntity ? 6 + Math.min(n.weight || 1, 8) : 2.4;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: isEntity ? 0.8 : 0.35,
      roughness: 0.4, metalness: 0.1, transparent: true, opacity: isEntity ? 1 : 0.85
    });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(p.x, p.y, p.z); mesh.scale.setScalar(radius);
    mesh.userData = { id: n.id, node: n, baseEmissive: mat.emissiveIntensity, radius };
    group.add(mesh); meshes.push(mesh);
    byId.set(n.id, { mesh, position: mesh.position.clone(), node: n });
  }
  engine.scene.add(group);

  function update(t) {
    for (const m of meshes) {
      const e = m.userData; if (e.node.kind !== 'entity') continue;
      m.material.emissiveIntensity = e.baseEmissive + Math.sin(t * 1.3 + e.radius) * 0.15; // breathing
    }
  }
  return { group, byId, meshes, update };
}
