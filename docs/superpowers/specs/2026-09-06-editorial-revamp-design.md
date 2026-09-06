# Design: Portfolio revamp, plain editorial

Date: 2026-09-06
Status: approved for planning
Supersedes: the Design Context section of `CLAUDE.md` (terminal metaphor)

## 1. Context

The site at 7mxd.github.io is a static, no-build portfolio. Content lives in
`data/*.json` and is rendered client-side. The current visual identity is a
terminal metaphor: shell-command section headers (`$ ls projects/`, `cat
experience.log`), warm paper palette, a hidden interactive terminal reachable
with the backtick key.

Ahmed asked for a full revamp inspired by <https://haithamalkindi.com/> and
chose a complete reset rather than a partial one. The terminal metaphor is
retired.

The reference site is a plain, photo-led personal page: single column, near-black
on white, a reverse-chronological "The path so far" timeline with inline
photographs, a short numbers strip, a skills list, and contact links. It reads
like an academic homepage, not a magazine.

### The trap this design avoids

The Impeccable skill flags **editorial-typographic** as a currently saturated
aesthetic lane: display serif (often italic), small monospace labels, ruled
separators, monochromatic restraint, no imagery. It also flags warm cream and
sand body backgrounds as the default AI reflex, and calls out token names like
`--paper` and `--cream` as tells in themselves.

The reference site is not that lane. It is plainer and it is carried by
photographs. This design commits to the plain version:

- Photographs are load-bearing, not decoration. Zero images would be a bug.
- No display-serif italic headline affectation.
- No monospace metadata labels, no rule-separated column grids.
- The body background is a true off-white at near-zero chroma, not a cream.
  Warmth comes from the logo, the accent, and the photography.

### Audiences

Unchanged from the existing brief and still governing:

1. Recruiter, 30-second scan. Who is this, what role, one piece of evidence.
2. Hiring manager, 2-5 minute read. Methodology, tools, outcomes.
3. Peer or collaborator. Craft and personality.
4. Ahmed's durable personal site for the next 2-3 years.

No content is duplicated across depth levels. The timeline entry is one line;
the Selected Work entry is the depth.

## 2. Goals and non-goals

### Goals

- Replace the terminal identity with a plain, photo-led, document-like page.
- Rebuild the content from the September 2026 CV, which the current data
  significantly undersells.
- Introduce a reverse-chronological timeline as the spine of the page.
- Keep dark mode and the CV download.
- Keep content in `data/*.json` so the admin UI continues to work.
- Get total CSS plus JS under the 80 KB uncompressed budget. It is currently
  about 101 KB.

### Non-goals

- No blog. No FAQ. The reference has both; this site does not.
- No admin UI changes in this project. The admin revamp is a separate piece of
  work that follows this one.
- No build step. Still plain HTML, CSS, and ES modules served statically.
- No framework, no bundler, no dependencies.

## 3. Visual direction

### Palette

Derived from Ahmed's own logo rather than invented. Sampled values from the
supplied artwork: ink navy `#1c1f32`, warm tan `#e7ad87`, mid-brown `#997662`.

The raw tan measures 1.87:1 against a light ground, so it cannot carry text in
light mode. It is deepened to a terracotta for light mode and used at full
strength in dark mode, where it measures 9.13:1.

Light mode, ground `#fafaf9`:

| Token | Value | Contrast |
|---|---|---|
| `--ground` | `#fafaf9` | ground |
| `--ink` | `#1c1f32` | 15.57:1 |
| `--ink-muted` | `#585b6b` | 6.44:1 |
| `--accent` | `#a85a32` | 4.82:1 |
| `--accent-strong` | `#8f4a2c` | 6.32:1 |
| `--rule` | `#e2e2df` | hairline only |

Dark mode, ground `#15171f`:

| Token | Value | Contrast |
|---|---|---|
| `--ground` | `#15171f` | ground |
| `--ink` | `#e9e7e2` | 14.47:1 |
| `--ink-muted` | `#9a9aa6` | 6.43:1 |
| `--accent` | `#e7ad87` | 9.13:1 |
| `--rule` | `#2a2d3a` | hairline only |

Every value above passes WCAG AA for body text against its own ground.
`--rule` is for hairlines only and never carries text.

Token names deliberately avoid `--paper`, `--cream`, `--sand`, and `--bone`.

### Typography

Three families, one of which is a single line of text.

| Role | Family | Notes |
|---|---|---|
| Prose, headings | Source Serif 4 | Variable, text serif built for long-form reading |
| Nav, metadata, years, labels | Public Sans | Institutional, plain, not fashionable |
| Arabic name | Amiri | Classical naskh, one line only |

None appear on the Impeccable reflex-reject list. Amiri is subsetted with the
Google Fonts `&text=` parameter to only the glyphs in `أحمد علوي رضي`, which
reduces it to a negligible download.

Loading uses `font-display: swap` with metric-compatible fallback stacks
declared via `size-adjust` to avoid layout shift. Only the regular prose weight
is preloaded.

Type scale is fluid `clamp()` for headings with a ratio of at least 1.25 and a
maximum no more than 2.5 times the minimum. Body text is a fixed rem size.
Measure stays inside 45-75 characters at every viewport.

### Layout

Single column. Content measure roughly 34rem for prose, widening to about 46rem
for timeline entries that carry photographs. Generous outer margins that grow
with the viewport. No cards. No repeated grid of equal boxes.

Photographs sit inline within timeline entries with a caption beneath in the
metadata face. A single photograph runs the full measure. Two or more sit at
most two per row above 40rem, and an odd final photograph spans the full
measure rather than sitting alone in a half column. Everything stacks below
40rem.

The Khalifa University education entry is the case that exercises this: it
carries the two graduation photographs and the e-gaming competition photograph,
so it renders as a pair followed by a full-measure image.

### Motion

Minimal by intent. No scroll-triggered reveals gating content visibility.
Content is visible by default. `prefers-reduced-motion` is honored throughout.

## 4. Information architecture

Page order, top to bottom:

1. **Nav.** Icon mark at left. Links: About, Path, Work, Skills, Contact.
   Theme toggle and Download CV at right.
2. **Hero.** Name in English and Arabic, one-line role, location, portrait,
   contact links.
3. **About.** Three or four sentences, rewritten from the 2026 CV.
4. **The path so far.** Reverse chronological, 2026 back to 2015. Grouped by
   year. Each entry has a headline, an organisation, an optional date range,
   its bullets per the rule in section 8, and optional photographs with
   captions.
5. **By the numbers.** A short honest strip of quantities that appear nowhere
   else on the page.
6. **Selected work.** Three entries with room to breathe.
7. **Skills.** Grouped lists. No proficiency percentages or bars.
8. **Contact.** Email, LinkedIn, GitHub.
9. **Footer.** Copyright and year.

### Removed

- The interactive terminal easter egg and its trigger button.
- All shell-command section headers.
- The ASCII bar chart block type.
- The separate Experience and Education sections, which are absorbed into the
  timeline.
- The cluster and graph configuration in `settings.json`, left over from the
  parked 3D redesign.

## 5. Data model

### Principle

The timeline is **composed, not duplicated**. It is assembled at render time
from the existing content files plus one new file. Adding a job through the
admin makes it appear on the timeline automatically, with no second edit.

### Files

| File | Status | Purpose |
|---|---|---|
| `data/profile.json` | changed | Name, Arabic name, role line, contact |
| `data/summary.json` | changed | The About paragraph |
| `data/experience.json` | changed | Companies and roles, feeds the timeline |
| `data/education.json` | changed | Degrees, feeds the timeline |
| `data/projects.json` | changed | Selected Work, and feeds the timeline |
| `data/milestones.json` | **new** | Awards, certifications, volunteering |
| `data/metrics.json` | **new** | By the numbers |
| `data/skills.json` | changed | Rebuilt from the CV |
| `data/settings.json` | changed | Sections, CV path, meta; graph config removed |
| `data/blocks-registry.json` | changed | `ascii-chart` removed, `image` widened |

### Timeline composition

A pure function in `js/timeline.js` takes the loaded data objects and returns a
sorted, year-grouped array. It is pure so it can be unit tested without a DOM.

Each source contributes entries:

- `experience.json`: one entry per role, keyed on the role start date.
- `education.json`: one entry per degree, keyed on the end date.
- `projects.json`: one entry per project with `timeline: true`, keyed on start
  date, carrying a `workRef` so the entry can link down to Selected Work.
- `milestones.json`: one entry per award, certification, or volunteering item.

Sort is descending by sort date. Ties break by an explicit `order` field, then
by source precedence: role, education, project, milestone.

### Milestone schema

```json
{
  "id": "golden-key-2023",
  "kind": "award",
  "date": "2023-05",
  "title": "Golden Key International Honour Society",
  "org": "Khalifa University chapter",
  "note": "Invitation-only, top fifteen percent of the class.",
  "link": null,
  "images": [
    {
      "src": "assets/photos/honors-day-ceremony.jpg",
      "alt": "Ahmed receiving the Honors Day certificate on stage at Khalifa University",
      "caption": "Honors Day, Khalifa University, May 2023"
    }
  ]
}
```

`kind` is one of `award`, `certification`, `volunteering`. `link` is an optional
`{ url, label }` pointing at third-party corroboration.

### Third-party verification

The Dean's List milestone carries a link to Khalifa University's published
honors list at `https://www.ku.ac.ae/student-life/honors-list`, which names
Ahmed under Applied Mathematics and Statistics for Fall 2022. Independent
corroboration is rare on a portfolio and worth surfacing.

Two caveats are recorded rather than hidden. The university page prints Ahmed's
full legal name, which the redacted graduation photograph deliberately omits, so
the link partially reverses that redaction. And the page rotates its terms as new
semesters publish, so the citation may stop resolving to Fall 2022 in future. The
link is therefore labelled as the university's honors list rather than as proof
of a specific term, and it is presented as supporting evidence, not as the claim
itself.

### Image schema

Every image slot is optional. A timeline entry with no images renders as a
clean text entry, never as a gap or a broken frame.

```json
{
  "src": "assets/photos/graduation-ceremony-certificate.jpg",
  "alt": "…",
  "caption": "…",
  "width": 2000,
  "height": 1333
}
```

`width` and `height` are required so the browser can reserve space and avoid
layout shift.

## 6. Rendering architecture

`script.js` is 55 KB and `style.css` is 46 KB, both monolithic. The reset is the
moment to split them. The comment already in `data/blocks-registry.json` names
`js/blocks.js` and `css/sections.css`, so this was the intended direction.

```
index.html          rewritten

css/tokens.css      palette, type scale, spacing, both themes
css/base.css        reset, element typography, links, focus rings
css/layout.css      nav, page shell, footer
css/sections.css    hero, timeline, numbers, work, skills, contact
css/print.css       print stylesheet

js/main.js          boot and wiring
js/data.js          fetch and validate the JSON payloads
js/timeline.js      pure composition function
js/render.js        section renderers
js/blocks.js        registry-driven block dispatch
js/theme.js         theme toggle, persistence, announcement
```

`script.js` and `style.css` are deleted.

ES modules are used directly with `<script type="module">`. No bundler. The
module count is small enough that request overhead is not a concern on HTTP/2.

## 7. Image pipeline

Source photographs are large: one is 5459 by 3639 and 4 MB. They are processed
once, offline, with Pillow, and the derivatives are committed.

For each photograph:

- Long edge capped at 1600 pixels for the full-measure display size.
- A 800 pixel variant for the stacked mobile layout.
- JPEG quality 82, progressive, EXIF stripped.
- `srcset` and `sizes` so the browser picks correctly.
- `loading="lazy"` and `decoding="async"` on everything below the fold. The
  portrait in the hero is eager and preloaded.

EXIF stripping matters here: several photographs are phone originals and carry
GPS coordinates.

### Logo processing

Both logo files are JPEG on a flat white background.

- Background is keyed to transparency with a tolerance that preserves the
  anti-aliased edges rather than leaving a white halo.
- The icon is trimmed to its content bounding box, then centred on a square
  canvas with even padding.
- Favicon set is generated at 16, 32, 180, 192, and 512 pixels. The Apple touch
  icon gets an opaque ground, since iOS does not composite transparency.
- The nav uses the icon plus the name as live text, not the wordmark raster.
  This keeps the nav crisp, keeps the name selectable and searchable, and makes
  dark mode trivial. The wordmark raster is kept for the Open Graph image.

## 8. Content changes

The current data undersells the CV badly. Rewriting it is a substantial part of
this work.

### About

Rewritten from the CV summary. Two years across data science, data engineering,
and analytics. Pipelines, audit and exception detection, NLP matching,
dashboards.

### Experience

**Rule: the timeline carries a role's full bullet list, unless that role's work
has its own Selected Work entry, in which case the timeline carries three
headline bullets and links down to the full treatment.**

An earlier draft simply truncated the Saal.ai role to four of its ten bullets.
That threw away real evidence the hiring-manager audience wants. Promoting the
procurement audit platform to Selected Work keeps every bullet while preserving
the timeline's scanning rhythm, and it strengthens a Selected Work section left
thin by the removal of Wafa and HiSalon.

Applying the rule to the three roles:

| Role | Bullets in CV | Treatment |
|---|---|---|
| Saal.ai, Graduate Trainee | 10 | 3 in the timeline, all 10 in Selected Work |
| Saal.ai, Data Scientist Intern | 4 | all 4 in the timeline |
| Daman, Data Analyst Intern | 2 | both in the timeline |

Only one role triggers the exception, so the timeline stays predictable.

The three headline bullets for the Graduate Trainee entry:

- Primary developer of a procurement audit platform ingesting Dynamics 365 ERP
  data from Azure Blob Storage, authoring 28 of its 38 exception checks.
- Applied NLP matching combining fuzzy and Levenshtein similarity with a
  cross-encoder transformer to flag near-duplicate line items.
- Built ETL pipelines in a microservices architecture with Python, Pandas, and
  MongoDB, and interactive dashboards in Power BI and Tableau.

Note that the current `experience.json` bullets are not merely fewer than the
CV's, they are vaguer. Every bullet is rewritten from the CV regardless of how
many survive into the timeline.

### Selected work

Three entries. Wafa and HiSalon are removed at Ahmed's request. The procurement
audit platform is promoted here from the experience bullets, per the rule above.

**Procurement audit platform, Saal.ai.** The full ten-bullet treatment: ingestion
of Dynamics 365 ERP data from Azure Blob Storage across procure-to-pay, vendor
master data, and user access rights; 28 of the 38 exception checks authored; the
six-check Delegation of Authority control set tracing ERP workflow records to
flag approvals by the wrong person or at fewer levels than spending limits
require; four further controls over payments and vendor master data extending to
treasury payment exports; NLP matching with fuzzy, Levenshtein, and cross-encoder
similarity for near-duplicate line items; Docker containerisation with
APScheduler scheduling, scaled across one or all business entities, with retry
and backoff on Azure ingestion; and the client-facing dashboard work replacing a
pop-up with a standalone shareable exception page.

No screenshots exist for this work and none can be published, since it is client
audit software. The entry is text and it has to carry itself on specificity. The
Saal.ai logo already in `assets/` provides the only visual anchor.

**Stmnt.** The model description is corrected. Verified in the Stmnt repository
at `lib/core/constants.dart`: OpenRouter is the gateway,
`google/gemini-3-flash-preview` is the primary extraction model, and
`openai/gpt-5.4-mini` is the fallback. `extraction_service.dart` walks the model
list in priority order with a rate-limit retry before failing over. Copy will
say OpenRouter with Gemini primary and a GPT fallback for resilience. The old
data said only OpenRouter; the CV said only Gemini; both were half right.

**On a Generalization of Kernel RLS to Nonlinear State-Space Systems.** The
ASCII chart is retired. The Santa Fe benchmark becomes a small typeset table:
competition winner 0.028, this work 0.042, competition second place 0.080, with
a note that lower NMSE is better. The paper PDF stays linked.

### New content not currently anywhere

- Golden Key International Honour Society, Khalifa University chapter, May
  2023. Confirmed from the scanned certificate. Belongs on the CV too.
- Sustainability E-gaming Competition at Khalifa University. Year and role
  still needed from Ahmed.

### Milestones drawn from the CV

Certifications: DeepLearning.AI Supervised Machine Learning, December 2024.
Dataiku ML Practitioner and Core Designer, April 2024. Python for Data Analysis
Workshop, Khalifa University, June 2022.

Awards: Dean's List Fall 2021 and Fall 2022. Golden Key, May 2023.

Volunteering: Feed and Reap with the Absher Ya Watan team, April 2023. Lead Peer
Mentor at Khalifa University, mentoring nine freshmen across Fall 2022 and
Spring 2023. Mawhibatna Program volunteer, July 2019.

### Deliberately excluded from the public page

- GRE and EmSAT scores. They stay on the CV.
- Phone number. Publishing it invites scraping.
- Nationality. It belongs on a CV for visa reasons, not on a public page.

### By the numbers

Every figure traces to the CV or a verified repository:

| Figure | Source |
|---|---|
| 28 of 38 exception checks authored | CV, Saal.ai |
| 6 Delegation of Authority controls | CV, Saal.ai |
| 35+ currencies handled by Stmnt | CV and repository |
| 9 freshmen mentored | CV, peer mentoring |

## 9. Photography

Eight photographs and three app screenshots are staged. Nine assets will be used.

| File | Placement |
|---|---|
| `portrait-formal.jpg` | Hero |
| `graduation-ceremony-certificate.jpg` | 2023, graduation |
| `graduation-campus-certificate.jpg` | 2023, graduation |
| `honors-day-ceremony.jpg` | 2023, Golden Key |
| `volunteering-meal-packing.jpg` | 2023, Feed and Reap, cropped closer |
| `egaming-competition-demo.jpg` | 2023, on the Khalifa University education entry |
| `stmnt/01-spending-by-category.png` | Selected Work, Stmnt |
| `stmnt/04-recurring-subscriptions.png` | Selected Work, Stmnt |
| `stmnt/05-smart-forecast.png` | Selected Work, Stmnt |
| `graduation-ceremony-stage.jpg` | unused, near-duplicate of the close shot |
| `honors-day-certificate.jpg` | unused, a document rather than a moment |

The campus graduation photograph has been replaced with a version where the
diploma text is redacted down to the first name.

### App screenshots

Stmnt ships two screenshot sets. The App Store marketing exports put a device
mockup on a branded ground under a marketing headline, which would import
another product's brand and marketing voice into the page. The raw device
captures are clean, full-bleed app UI at 1290 by 2796.

The raw captures are used. No cropping is required.

The three chosen map onto the three claims the CV makes about Stmnt: spending
breakdowns, subscription tracking, and spending forecasts. The data shown is
sample data, so there is no personal financial exposure.

Because these are tall portrait captures at a 1:2.17 ratio, they are displayed
as a row of three at a constrained height rather than at full measure, so a
single screenshot does not consume a whole screen of scroll.

### The Saal.ai gap

Two years of career have no photograph, and none is available. Client audit
software cannot be screenshotted either. That stretch of the timeline is
carried by the Saal.ai logo already in `assets/` and by the specificity of the
writing.

This is a constraint the design must absorb rather than paper over. Years
without a photograph render as clean text entries, never as a gap or a
placeholder.

## 10. Accessibility

Existing foundations are preserved: skip link, `prefers-reduced-motion`,
`prefers-contrast: high`, keyboard-usage detection on `html.using-keyboard`,
and screen-reader announcements on theme change.

Added or restated for this design:

- WCAG AA minimum on every text colour, verified numerically in section 3.
- The Arabic name carries `lang="ar"` and `dir="rtl"` on its own element.
- Every photograph has descriptive alt text written as part of the content, not
  as a filename echo. Captions and alt text do not duplicate each other.
- The timeline is a real ordered list, so screen readers announce position.
- Visible focus rings on every interactive element, never removed.
- The theme toggle reports its state with `aria-pressed`.

## 11. Print

The existing print stylesheet must keep working. A recruiter printing the page
should get a clean document.

Print rules: photographs suppressed except the portrait, nav and theme toggle
hidden, timeline collapsed to a tight list, link URLs printed after their text,
ink on white regardless of the active theme.

## 12. Performance

Budget: CSS plus JS under 80 KB uncompressed, down from about 101 KB today.

- Fonts: three families, two of them full text faces, one subsetted to ten
  glyphs. Only the prose regular weight preloaded.
- Images: sized derivatives, lazy below the fold, explicit dimensions to hold
  layout.
- No dependencies, no framework, no bundler.

## 13. Testing

Existing tests run under `node --test`. New tests to add:

- `timeline.test.js`: composition and ordering. A role, a degree, a project,
  and a milestone in the same year sort by the documented precedence. An entry
  with no date is excluded rather than crashing. Descending order holds across
  year boundaries.
- `data-integrity.test.js`: every image referenced in the data exists on disk;
  every image has non-empty alt text; every image has width and height; the CV
  path in settings resolves.
- `blocks-registry.test.js`: every block type used in the data is declared in
  the registry and is in scope for the section that uses it.

Manual verification before completion: both themes at 360, 390, 768, and 1280
pixels wide; keyboard-only traversal of the whole page; print preview; and the
page with JavaScript disabled showing the noscript fallback.

## 14. Migration

Deleted: `script.js`, `style.css`, the terminal markup in `index.html`, the
`ascii-chart` block type and its CSS, the graph and cluster configuration in
`settings.json`.

Rewritten: `index.html`, `CLAUDE.md` design section, `README.md` design
paragraph.

The old CV at `assets/ahmed_radhi_cv_2025.pdf` is replaced by
`assets/ahmed_radhi_cv_2026.pdf`, already committed.

The admin UI is not touched. It reads `data/blocks-registry.json` to build its
forms, so registry changes flow through automatically. Two new content files
mean the admin will not yet be able to edit milestones or metrics. That is
accepted and is the first item of the admin revamp that follows.

## 15. Open items

None. Everything needed to build is settled.

Resolved during review: the campus graduation photograph is redacted; the Stmnt
screenshots are staged and their marketing frames will be cropped away; the
Saal.ai photograph gap is confirmed permanent and absorbed into the design; the
experience-truncation question is answered by the Selected Work promotion in
section 8; and the e-gaming photograph becomes an image on the Khalifa
University education entry rather than a standalone milestone, which removes the
need for a date.
