/** Compose the reverse-chronological timeline from the content files.
 *
 *  Nothing here touches the DOM. The timeline is assembled rather than
 *  authored, so adding a role in the admin puts it on the timeline with
 *  no second edit. */

export const KIND_ORDER = { role: 0, education: 1, project: 2, milestone: 3 };

const DATE = /^(\d{4})(-\d{2})?$/;

function yearOf(value) {
  const match = DATE.exec(String(value ?? '').trim());
  return match ? Number(match[1]) : null;
}

function entry(fields) {
  return {
    id: fields.id,
    kind: fields.kind,
    sortDate: fields.sortDate,
    year: fields.year,
    order: fields.order,
    title: fields.title,
    org: fields.org ?? '',
    orgLogo: fields.orgLogo ?? null,
    location: fields.location ?? '',
    dateRange: fields.dateRange ?? '',
    bullets: fields.bullets ?? [],
    images: fields.images ?? [],
    blocks: fields.blocks ?? [],
    workRef: fields.workRef ?? null,
    link: fields.link ?? null,
    note: fields.note ?? '',
  };
}

function fromExperience(experience) {
  const out = [];
  for (const company of experience.items ?? []) {
    for (const role of company.roles ?? []) {
      const year = yearOf(role.startDate);
      if (year === null) continue;
      out.push(entry({
        id: role.id, kind: 'role', sortDate: role.startDate, year, order: role.order,
        title: role.title, org: company.company, orgLogo: company.logo ?? null,
        location: company.location, dateRange: role.displayDate,
        bullets: role.bullets, images: role.images, blocks: role.blocks,
        workRef: role.workRef,
      }));
    }
  }
  return out;
}

function fromEducation(education) {
  const out = [];
  for (const item of education.items ?? []) {
    const year = yearOf(item.endDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'education', sortDate: item.endDate, year, order: item.order,
      title: item.degree, org: item.institution, orgLogo: item.logo ?? null,
      location: item.location, dateRange: item.displayDate,
      note: item.grade, images: item.images, blocks: item.blocks,
    }));
  }
  return out;
}

function fromProjects(projects) {
  const out = [];
  for (const item of projects.items ?? []) {
    if (item.timeline !== true) continue;
    const year = yearOf(item.startDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'project', sortDate: item.startDate, year, order: item.order,
      title: item.title, org: item.org, dateRange: item.displayDate,
      images: item.images, blocks: item.blocks, workRef: item.id,
    }));
  }
  return out;
}

function fromMilestones(milestones) {
  const out = [];
  for (const item of milestones.items ?? []) {
    const year = yearOf(item.date);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'milestone', sortDate: item.date, year, order: item.order,
      title: item.title, org: item.org, note: item.note, images: item.images,
      link: item.link,
    }));
  }
  return out;
}

function compare(a, b) {
  if (a.sortDate !== b.sortDate) return b.sortDate.localeCompare(a.sortDate);
  const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

/** Build year groups, newest first. */
export function buildTimeline({ experience = {}, education = {}, projects = {}, milestones = {} } = {}) {
  const all = [
    ...fromExperience(experience),
    ...fromEducation(education),
    ...fromProjects(projects),
    ...fromMilestones(milestones),
  ].sort(compare);

  const groups = new Map();
  for (const item of all) {
    if (!groups.has(item.year)) groups.set(item.year, []);
    groups.get(item.year).push(item);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, entries]) => ({ year, entries }));
}
