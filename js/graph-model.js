import { slugify } from './util.js';

export function deriveGraph(model) {
  const nodes = [];
  const edges = [];
  const toolUsage = {};
  const toolNodes = new Map(); // slug -> node

  function ensureTool(label) {
    const id = `tool:${slugify(label)}`;
    if (!toolNodes.has(id)) {
      const node = { id, kind:'tool', label, cluster:null, ref:null, weight:0 };
      toolNodes.set(id, node);
      toolUsage[id] = 0;
    }
    return toolNodes.get(id);
  }
  function addEntity(prefix, i, label, cluster, section, tags) {
    const id = `${prefix}:${i}`;
    nodes.push({ id, kind:'entity', label, cluster, ref:{section,index:i}, weight:1 + tags.length });
    for (const t of tags) {
      const tool = ensureTool(t);
      edges.push({ source:id, target:tool.id });
      tool.weight += 1;
      toolUsage[tool.id] += 1;
    }
  }

  (model.projects || []).forEach((p, i) =>
    addEntity('proj', i, p.title, p.cluster, 'projects', p.tags || []));
  (model.experience || []).forEach((e, i) =>
    addEntity('exp', i, e.company, e.cluster, 'experience', e.tags || []));
  (model.education || []).forEach((d, i) =>
    addEntity('edu', i, d.institution, d.cluster, 'education', d.blocks ? (d.tags||[]) : []));

  // Skill-only tools (declared in skills but not on any entity) still appear as nodes.
  for (const cat of (model.skills?.categories || [])) {
    if (cat.type === 'tags' || cat.type === 'list') {
      for (const it of (cat.items || [])) ensureTool(it.name);
    }
  }

  nodes.push(...toolNodes.values());
  return { nodes, edges, toolUsage };
}
