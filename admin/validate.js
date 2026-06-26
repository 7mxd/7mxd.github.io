function checkFields(fields, model, prefix, errs) {
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    const v = model ? model[f.name] : undefined;
    if (f.required && (v === '' || v == null)) errs.push({ path, message: `${f.label} is required` });
    if (f.type === 'object') checkFields(f.fields, v || {}, path, errs);
    if (f.type === 'list' && !f.itemField && Array.isArray(v)) v.forEach((it, i) => checkFields(f.fields, it, `${path}[${i}]`, errs));
  }
}
export function validateModel(collection, model) {
  const errs = [];
  if (collection.kind === 'single') checkFields(collection.fields, model, '', errs);
  else (model?.[collection.listKey] || []).forEach((it, i) => checkFields(collection.itemFields, it, `${collection.listKey}[${i}]`, errs));
  return errs;
}
