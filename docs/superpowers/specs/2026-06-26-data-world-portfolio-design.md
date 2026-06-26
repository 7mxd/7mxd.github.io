# Project A — "Data World" Portfolio Redesign

**Date:** 2026-06-26
**Status:** Design — awaiting review
**Scope:** The public-facing site only. The custom admin is **Project B** (separate spec, built after this one against the final schema).

---

## 1. Summary

Replace the current static, terminal/printed resume with an **interactive "data world"**: a site whose hero is a living, self-assembling **network graph of Ahmed himself** — clusters of Mathematics, Data Science, and Engineering & Products, wired together by the tools and methods that connect them. The graph doubles as navigation. Below it sits a full, readable, content-complete page so no resume information is lost; a recruiter scanning for 30 seconds and a hiring manager reading for 5 minutes both get what they need.

The guiding idea: *a data scientist whose page is literally made of data.* The graph is **computed from content**, not hand-authored — shared tags/tools become edges automatically.

This is a **fresh visual identity** (the old "printed terminal / lab notebook" direction is retired). Both light and dark themes are first-class. Animation is core, but every motion respects `prefers-reduced-motion`.

---

## 2. Goals & non-goals

### Goals
- A memorable, attention-grabbing first impression that pulls visitors down the page.
- Communicate Ahmed's real arc — **math foundation → applied data science → shipping production systems**, with AI agents as the through-line method — in one glance and in depth.
- Preserve 100% of current resume substance (experience, projects, skills, education, contact, CV download).
- Keep it a **no-build, vanilla** static site on GitHub Pages, still reading from `data/*.json` and `data/blocks-registry.json`.
- Adaptive **light + dark**, both designed properly, with a toggle.
- Maintain all existing accessibility foundations and WCAG AA.

### Non-goals (this project)
- The admin/CMS — that is Project B.
- A backend or database — site stays static.
- Naming confidential products beyond what's approved (see §9).

---

## 3. Audiences (unchanged from CLAUDE.md, restated for design checks)
- **Recruiter, ~30s scan** — who, what role, one piece of evidence, fast.
- **Hiring manager, 2–5 min** — depth: methodology, tools, outcomes.
- **Peer/collaborator** — craft and personality; weird-in-a-good-way welcome.
- **Durable personal site** — should age well over 2–3 years.

**Implication:** the network is the *wow*, but the readable page below is the *substance*. The site must be fully usable and legible even if the canvas never renders (progressive enhancement).

---

## 4. The network graph (the centerpiece)

### 4.1 Model — computed, not authored
**Node types:**
- **Entity nodes** — one per project, per experience (company/role), per education institution, plus the senior research project. Each entity declares a `cluster`.
- **Tool nodes** — derived automatically from the union of all `tags` across projects, skills, and experience. A tool node is shared by every entity that lists it.

**Edges:** an entity links to each tool it lists. Because tool nodes are shared, tools used across clusters (e.g. `Python`, `Supabase`, `Docker`, `Claude / AI agents`) become the **cross-cluster bridges** — the visual proof that this is one connected person, not three resumes.

**Clusters (3):**
1. **Mathematics** — Khalifa University, senior research (KRLS → KAARMA), Leeds analysis; anchors MATLAB, kernel methods, time-series.
2. **Data Science** — Saal.ai roles, Daman; anchors Python, Pandas, MongoDB, Docker, Power BI, Dataiku.
3. **Engineering & Products** — HiSalon, Stmnt, Wafa, gcc_currency, and a single unnamed "other Join-Future systems" node; anchors TypeScript, Flutter/Dart, Supabase, PostgreSQL, AWS, MCP.

Cluster determines a node's base color and its initial layout region. Tool nodes are **unclustered** — they float and are pulled by their neighbors, so a tool shared between Math and Data physically sits between those clusters.

**Authored data is minimal:** entities get a `cluster` field; everything else (nodes, edges, positions) is derived at runtime. Cluster labels and colors live in `settings.json` so they're data-driven.

### 4.2 Rendering & simulation
- **Canvas 2D**, hand-rolled force simulation (no library): pairwise repulsion, spring attraction along edges, mild gravity toward each cluster centroid, weak centering. ~100–150 lines.
- Runs `requestAnimationFrame`; **freezes after the layout settles** (energy threshold) to stop burning CPU; pauses when tab hidden or canvas scrolled offscreen.
- Node count is capped; on small screens the graph is simplified (fewer tool nodes, larger touch targets).

### 4.3 Load animation — "signal from noise"
On load, nodes appear as scattered particles (noise) and animate into the settled network (signal). This folds in the "signal from noise" idea — a nod to KRLS prediction/denoising — as the *entrance*, not a separate hero. Under `prefers-reduced-motion`, the graph is rendered **directly in its settled state**, no animation.

### 4.4 Interaction
- **Hover/focus a node:** highlight it + its neighbors, dim the rest; show a label/tooltip.
- **Click an entity node:** smooth-scroll to that section/entry below.
- **Click a tool node:** highlight every entity that uses it (shows reach of a skill).
- **Cursor proximity:** nearby nodes drift slightly toward/away — subtle "alive" feel.
- **Drag** (desktop): nudge a node; it springs back. Disabled on touch.

### 4.5 Accessibility of the graph
The canvas is **decorative-plus**: `aria-hidden="true"`, with a visually-hidden text equivalent ("Interactive map of Ahmed's skills across three areas… ") and a real, keyboard-navigable **section nav** that does everything the graph's clicks do. **All information in the graph also exists in the DOM content below** — the graph is pure progressive enhancement. Clusters are distinguished by label and position, not color alone.

---

## 5. Page structure (content-complete, below the hero)

Every section is real, readable HTML rendered from `data/*.json` via the block renderer. "Data-world treatment" describes the styling/motion, never a reduction of content.

1. **Hero** — the network (canvas) layered with: name, one-line title, a short positioning line, and primary actions (Download CV, Contact, GitHub, LinkedIn). Scroll cue.
2. **Summary** — the existing summary prose, well-set; short and scannable.
3. **Experience** — Saal.ai (two roles), Daman. Animated vertical timeline; `responsibility` blocks as bullets; `metric` blocks animate as count-up on scroll-in. Company logos respect theme (light/dark variants already in data).
4. **Projects** — the substance section. Stmnt (status pill, tags, App Store + web links, description), KRLS research (description + the **ASCII chart that draws its bars in on scroll**, paper PDF + GitHub), HiSalon (high-level), Wafa, gcc_currency. Renders all block types: `description`, `ascii-chart`, `metric`, `code`, `image`, `callout`, `linked-artifact`.
5. **Skills** — rendered as the connective tissue: grouped tag clusters with usage counts (how many projects/roles each tool touches), plus the `languages` list with plain-word levels (native/fluent/beginner — no percentage bars, per existing convention).
6. **Education** — Khalifa University (degree, dates, CGPA), Al Nahda (high school). Logos themed.
7. **Contact / footer** — email, phone, location, LinkedIn, GitHub, CV download.

Section visibility stays controlled by `settings.json` `sections.*.enabled`.

---

## 6. Theming (light + dark, both first-class)
- CSS custom properties for all colors; a `[data-theme]` attribute on `<html>`.
- Respects `prefers-color-scheme` on first visit; user toggle persists to `localStorage`; toggle change is announced to screen readers (existing pattern preserved).
- **Cluster triad** must be distinguishable and AA-legible in both themes. Proposed starting palette (tuned live during build):
  - Mathematics — indigo/violet
  - Data Science — amber/gold
  - Engineering & Products — cyan/blue
  Plus neutral ink/paper backgrounds per theme. Exact hex values finalized during implementation against contrast checks.
- Light is not an afterthought and dark is not an afterthought — both get explicit design passes.

---

## 7. Accessibility (non-negotiable, preserved & extended)
- Keep: skip link, `prefers-reduced-motion`, `prefers-contrast: high`, `html.using-keyboard` keyboard-usage detection, SR announcements for theme/menu, focus management.
- Network canvas: `aria-hidden`, text alternative, full keyboard nav via section nav; no information exists *only* in the canvas.
- All scroll-triggered animations are enhancement; content is present and readable with JS disabled as far as static rendering allows (note: content is JS-rendered today — see §11 risk).
- Color never the sole carrier of meaning. WCAG AA contrast minimum in both themes.
- Motion: every animation gated by `prefers-reduced-motion`; reduced = settled/static, no parallax, no count-up.

---

## 8. Performance
- **No build step.** Vanilla ES2020+, served as-is.
- Budget relaxed to **< 150KB CSS+JS uncompressed total** (was 80KB); justified by the interactive hero. Stay as far under as practical.
- Lazy-load below-the-fold images. Cap and freeze the force sim. Pause animation when offscreen/hidden.
- Canvas sized to device pixel ratio but capped for cost.

---

## 9. Confidentiality (content rule)
- **HiSalon** may be named publicly: name + Ahmed's role + general stack (e.g. "salon platform, production Postgres, AWS"). **No** internal security/infra specifics, RLS details, or unreleased specifics.
- **HiPay, joinfuture.ai, joinCX** are **not named**. Represented only by a single generic node/line: *"+ other production systems at Join-Future (payments, AI platform)."*
- Everything sourced from private repos is treated as needing Ahmed's sign-off; the spec/content only includes what's approved here.

---

## 10. Data schema changes
Additive and backward-compatible where possible.

- **Add `cluster`** (enum: `math` | `data` | `engineering`) to each item in `projects.json`, `experience.json`, `education.json`. Missing → inferred by section default.
- **Add optional `tags`** to `experience.json` items (tools used), so experience joins the graph. Projects already have `tags`.
- **New content** added to data files (per §9): HiSalon project entry, Wafa, gcc_currency, the generic Join-Future node, and the "Claude / AI agents" method tool.
- **`settings.json`:** add a `graph` config block (cluster keys → label + color), a `theme` default, and keep `sections.*.enabled`, `statuses`, `meta`, `cv`.
- **`blocks-registry.json`:** unchanged in shape; possibly add an `ascii-chart` animation hint flag if needed. Block renderer stays the dispatch point.

The renderer keeps consuming `data/*.json` + `blocks-registry.json` so **Project B (admin) can be built against this exact schema**.

---

## 11. Risks & mitigations
- **JS-rendered content + SEO/no-JS:** content is rendered client-side today; a crawler or no-JS visitor sees little. Mitigation: ensure critical meta tags + a static summary in `index.html`, and consider a `<noscript>` fallback with core text. (Carried as an implementation task; full SSR is out of scope.)
- **Canvas a11y:** mitigated by DOM being the source of truth (§4.5).
- **Performance on low-end mobile:** simplified graph + frozen sim + reduced-motion path.
- **Scope creep:** minimap/command-log/easter-eggs are explicitly **stretch**, not MVP.

---

## 12. Deliverables
- Rewritten `index.html`, `style.css`, `script.js` for the data-world site.
- Updated `data/*.json` (new fields + approved new content) and `settings.json` graph/theme config.
- **Rewritten "Design Context" section of `CLAUDE.md`** to describe the new identity (the old terminal direction is retired; impeccable-family skills must read the new one).
- Updated `README.md` if run/structure notes change.

## 13. Verification (no test framework today; manual + lightweight)
- Both themes visually correct; toggle persists.
- `prefers-reduced-motion`: no animation, graph settled, content intact.
- Keyboard-only: skip link, nav, all interactive elements reachable; focus visible.
- Mobile (≤480px) and tablet layouts; touch targets adequate; simplified graph.
- Lighthouse accessibility pass (target ≥ 95) and contrast spot-checks (AA).
- Print preview: clean document, network replaced by static header.
- File-size budget check (< 150KB CSS+JS).
- Content parity check: every datum from the current site is present.

## 14. Out of scope → next
- **Project B — custom GitHub-backed admin**: own brainstorm → spec → build, against the schema this project finalizes. Reuses the existing Vercel OAuth (callback adjusted), edits `data/*.json` via the GitHub Contents API, builds forms from `blocks-registry.json`.
