// admin/timeline-edit.js
/** The bridge between a row on the rail and the record behind it.
 *
 *  buildTimeline() composes entries from four files and stamps each with
 *  source: { collection, id }. This module does the reverse. It deliberately
 *  does not re-derive the composition: one implementation of "what is on the
 *  timeline" is the whole point. */
import { TIMELINE_KINDS, getCollection } from './schema.js';
import { blankValue } from './fields.js';

/** Every editable record in a collection, flattened. Experience is the only
 *  nested case: its rows are roles inside companies. */
export function recordsIn(collection, data) {
  if (collection === 'experience') {
    return (data.experience?.items || []).flatMap((c) => c.roles || []);
  }
  return data[collection]?.items || [];
}

export function resolveEntry(entry, data) {
  const { collection, id } = entry.source || {};
  if (!collection) throw new Error(`entry ${entry.id} carries no source`);
  const record = recordsIn(collection, data).find((r) => r.id === id);
  if (!record) throw new Error(`no record ${id} in ${collection}`);
  return { collection, record };
}

export function newRecordFor(kindKey, seed = {}) {
  const kind = TIMELINE_KINDS.find((k) => k.key === kindKey);
  if (!kind) throw new Error(`unknown timeline kind ${kindKey}`);
  const collection = getCollection(kind.collection);
  const fields = kind.collection === 'experience'
    ? collection.itemFields.find((f) => f.name === 'roles').fields
    : collection.itemFields;
  const record = {};
  for (const f of fields) record[f.name] = blankValue(f);
  return { ...record, ...kind.defaults, ...seed };
}

/** Where a freshly created record for this kind lands. Every kind but 'job'
 *  pushes straight onto its collection's list; a job is a role, and Add entry
 *  has no company to offer it yet, so it starts a new one and gives the role
 *  its only slot. Mutates `data` in place. Returns `record` unchanged — the
 *  caller (app.js) already holds the reference it needs to find the record
 *  again by identity, whether it ended up at the top of a list or nested
 *  inside the company this just created. */
export function placeRecord(kindKey, record, data) {
  const kind = TIMELINE_KINDS.find((k) => k.key === kindKey);
  if (!kind) throw new Error(`unknown timeline kind ${kindKey}`);
  const collection = getCollection(kind.collection);
  if (kind.collection === 'experience') {
    const company = {};
    for (const f of collection.itemFields) company[f.name] = blankValue(f);
    company.roles = [record];
    if (!Array.isArray(data.experience.items)) data.experience.items = [];
    data.experience.items.push(company);
    return record;
  }
  if (!Array.isArray(data[kind.collection][collection.listKey])) {
    data[kind.collection][collection.listKey] = [];
  }
  data[kind.collection][collection.listKey].push(record);
  return record;
}

/** Where a record sits in its collection's data: an index into a flat list,
 *  or a company/role pair for experience's nested roles. app.js uses this to
 *  find the DOM node forms.js built for a record — document order mirrors
 *  array order at every level forms.js and fields.js render lists in — so a
 *  scroll-to-selection or focus-the-new-record never needs the record's id
 *  (a freshly added, unsaved record's id is blank, and every other unsaved
 *  add shares that same blank id). Matching by object identity instead
 *  (`===`, via indexOf) sidesteps that entirely: resolveEntry and
 *  newRecordFor both hand back the very object living inside `data`, never a
 *  copy. Returns null if the record cannot be found (already removed, or
 *  from a different collection's data than the one passed in). */
export function locate(collectionName, record, data) {
  if (collectionName === 'experience') {
    const companies = data.experience?.items || [];
    for (let i = 0; i < companies.length; i++) {
      const j = (companies[i].roles || []).indexOf(record);
      if (j !== -1) return { index: i, roleIndex: j };
    }
    return null;
  }
  const collection = getCollection(collectionName);
  const items = data[collectionName]?.[collection.listKey] || [];
  const index = items.indexOf(record);
  return index === -1 ? null : { index };
}
