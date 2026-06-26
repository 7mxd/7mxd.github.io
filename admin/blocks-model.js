export function blockTypesForScope(registry, scope) {
  return Object.entries(registry)
    .filter(([k, v]) => k !== '_comment' && Array.isArray(v.scope) && v.scope.includes(scope))
    .map(([type, v]) => ({ type, label: v.label || type }));
}

export function fieldsForBlock(registry, type) {
  const entry = registry[type];
  return entry && Array.isArray(entry.fields) ? entry.fields : [];
}

export function newBlock(registry, type) {
  const block = { type };
  for (const f of fieldsForBlock(registry, type)) {
    block[f.name] = f.type === 'list' ? [] : '';
  }
  return block;
}
