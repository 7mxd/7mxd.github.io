const DEFAULT_CLUSTERS = {
  math:        { label: 'Mathematics',            color: '#6c5ce7' },
  data:        { label: 'Data Science',           color: '#d68a1e' },
  engineering: { label: 'Engineering & Products',  color: '#1d9bb8' }
};

export function normalizeData(raw) {
  const arr = (x) => Array.isArray(x?.items) ? x.items : (Array.isArray(x) ? x : []);
  const settings = raw.settings || {};
  const graph = settings.graph || {};
  return {
    profile: raw.profile || {},
    summary: raw.summary || { content: '' },
    experience: arr(raw.experience).map((e) => ({
      ...e, cluster: e.cluster || 'data', tags: e.tags || [], roles: e.roles || []
    })),
    projects: arr(raw.projects).map((p) => ({
      ...p, cluster: p.cluster || 'engineering', tags: p.tags || [], blocks: p.blocks || []
    })),
    skills: { categories: (raw.skills?.categories) || [] },
    education: arr(raw.education).map((d) => ({
      ...d, cluster: d.cluster || 'math', blocks: d.blocks || []
    })),
    settings: {
      ...settings,
      theme: settings.theme || 'auto',
      graph: { clusters: { ...DEFAULT_CLUSTERS, ...(graph.clusters || {}) } }
    }
  };
}

export async function loadData(fetchFn = fetch) {
  const names = ['profile','summary','experience','projects','skills','education','settings'];
  const base = 'data/';
  const entries = await Promise.all(names.map(async (n) => {
    const res = await fetchFn(`${base}${n}.json`);
    return [n, await res.json()];
  }));
  const raw = Object.fromEntries(entries);
  const reg = await (await fetchFn(`${base}blocks-registry.json`)).json();
  const model = normalizeData(raw);
  model.blocksRegistry = reg;
  return model;
}
