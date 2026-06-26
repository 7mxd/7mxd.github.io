import { deriveGraph } from '../graph-model.js';
import { computeLayout } from './layout.js';

export async function createWorld(canvas, model, { reducedMotion = false, lowPower = false, onSelectEntity } = {}) {
  const THREE = await import('https://esm.sh/three@0.160.0');
  const { createEngine } = await import('./engine.js');
  const { buildNodes } = await import('./nodes.js');
  const { buildEdges } = await import('./edges.js');
  const { createInteraction } = await import('./interaction.js');

  const graph = deriveGraph(model);
  const layout = computeLayout(graph, { seed: 7 });
  const palette = model.settings?.graph?.clusters
    ? { math: model.settings.graph.clusters.math.color, data: model.settings.graph.clusters.data.color, engineering: model.settings.graph.clusters.engineering.color }
    : { math:'#6c5ce7', data:'#d68a1e', engineering:'#1d9bb8' };

  const engine = createEngine(canvas, { reducedMotion });
  const nodes = buildNodes(THREE, engine, graph, layout, palette);
  const edges = buildEdges(THREE, engine, graph, layout, { reducedMotion });
  const interaction = createInteraction(THREE, engine, nodes, graph, { onSelectEntity });
  engine.addFrame((t) => { nodes.update(t); edges.update(t); });
  engine.start();

  function focusEntity(id) { const e = nodes.byId.get(id); if (e) engine.focusOn(e.position, 90); }
  return {
    focusEntity, resetView: () => engine.resetView(),
    start: () => engine.start(), stop: () => engine.stop(),
    dispose() { interaction.dispose(); engine.dispose(); }
  };
}
