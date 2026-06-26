export function buildEdges(THREE, engine, graph, layout, { reducedMotion = false } = {}) {
  const group = new THREE.Group();
  const positions = [];
  const segments = []; // {a,b} for pulses
  for (const e of graph.edges) {
    const a = layout.get(e.source), b = layout.get(e.target);
    if (!a || !b) continue;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    segments.push({ a: new THREE.Vector3(a.x,a.y,a.z), b: new THREE.Vector3(b.x,b.y,b.z) });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6a7079, transparent: true, opacity: 0.22 }));
  group.add(lines);

  // flowing pulses: one small glowing point per edge travelling a->b repeatedly
  const pulseGeo = new THREE.BufferGeometry();
  const pulsePos = new Float32Array(segments.length * 3);
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulses = new THREE.Points(pulseGeo, new THREE.PointsMaterial({ color: 0xbfe9f5, size: 4.5, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  group.add(pulses);
  engine.scene.add(group);

  const speed = reducedMotion ? 0 : 0.25;
  const phase = segments.map((_, i) => (i * 0.137) % 1);
  function update(t) {
    const attr = pulseGeo.getAttribute('position');
    for (let i = 0; i < segments.length; i++) {
      const f = speed === 0 ? 0.5 : ((t * speed + phase[i]) % 1);
      const s = segments[i];
      attr.array[i*3]   = s.a.x + (s.b.x - s.a.x) * f;
      attr.array[i*3+1] = s.a.y + (s.b.y - s.a.y) * f;
      attr.array[i*3+2] = s.a.z + (s.b.z - s.a.z) * f;
    }
    attr.needsUpdate = true;
  }
  update(0);
  return { group, update };
}
