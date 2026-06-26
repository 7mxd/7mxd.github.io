function defaultFor(field) {
  switch (field.type) {
    case 'boolean': return false;
    case 'list': return [];
    case 'blocks': return [];
    case 'object': return buildObject(field.fields, {});
    default: return '';
  }
}
function buildObject(fields, data) {
  const out = {};
  for (const f of fields) {
    const v = data ? data[f.name] : undefined;
    if (f.type === 'object') out[f.name] = buildObject(f.fields, v || {});
    else if (f.type === 'list') out[f.name] = Array.isArray(v) ? v.map(it => itemModel(f, it)) : [];
    else if (f.type === 'blocks') out[f.name] = Array.isArray(v) ? v : [];
    else out[f.name] = v ?? defaultFor(f);
  }
  return out;
}
function itemModel(listField, item) {
  if (listField.itemField) return item; // primitive list (e.g. tags) — raw value
  return buildObject(listField.fields, item || {});
}
export function buildFormModel(collection, data) {
  if (collection.kind === 'single') return buildObject(collection.fields, data || {});
  const arr = Array.isArray(data?.[collection.listKey]) ? data[collection.listKey] : [];
  return { [collection.listKey]: arr.map(it => buildObject(collection.itemFields, it)) };
}

function cleanObject(fields, model) {
  const out = {};
  for (const f of fields) {
    const v = model ? model[f.name] : undefined;
    if (f.type === 'object') { const o = cleanObject(f.fields, v || {}); if (Object.keys(o).length) out[f.name] = o; }
    else if (f.type === 'list') {
      const list = (Array.isArray(v) ? v : []).map(it => f.itemField ? it : cleanObject(f.fields, it)).filter(it => f.itemField ? (it !== '' && it != null) : Object.keys(it).length);
      if (list.length) out[f.name] = list;
    }
    else if (f.type === 'blocks') { if (Array.isArray(v) && v.length) out[f.name] = v; }
    else if (f.type === 'boolean') out[f.name] = !!v;
    else if (v !== '' && v != null) out[f.name] = v;
  }
  return out;
}
export function modelToData(collection, model) {
  if (collection.kind === 'single') return cleanObject(collection.fields, model);
  const arr = (model?.[collection.listKey] || []).map(it => cleanObject(collection.itemFields, it));
  return { [collection.listKey]: arr };
}
