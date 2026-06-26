export function createInteraction(THREE, engine, nodesApi, graph, { onSelectEntity, onSelectTool, onHover } = {}) {
  const canvas = engine.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, engine.camera);
    const hits = raycaster.intersectObjects(nodesApi.meshes, false);
    return hits.length ? hits[0].object : null;
  }
  function setHover(mesh) {
    if (hovered === mesh) return;
    if (hovered) hovered.material.emissiveIntensity = hovered.userData.baseEmissive;
    hovered = mesh;
    if (hovered) hovered.material.emissiveIntensity = hovered.userData.baseEmissive + 0.8;
    canvas.style.cursor = mesh ? 'pointer' : 'default';
    onHover && onHover(mesh ? mesh.userData.node : null);
  }
  function onMove(ev) { setHover(pick(ev)); }
  function onClick(ev) {
    const mesh = pick(ev); if (!mesh) return;
    const node = mesh.userData.node;
    engine.focusOn(mesh.position, Math.max(70, mesh.userData.radius * 8));
    if (node.kind === 'entity') onSelectEntity && onSelectEntity(node);
    else onSelectTool && onSelectTool(node);
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);
  return { dispose() { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); } };
}
