# Product

## Register

brand

Design IS the product. This is a personal portfolio at www.7mxd.me: a single
page whose job is to make a case for one person. There is no app surface, no
dashboard, no authenticated flow. The admin under `/admin/` is a private tool
and is not this document's subject.

## Users

Four overlapping audiences read the same page at different depths, so it has to
work at every depth of attention:

- **Recruiter, thirty-second scan.** Needs who he is, what role he wants, and
  one concrete piece of evidence, without scrolling past the fold twice.
- **Hiring manager, two to five minute read.** Evaluating fit for Data
  Scientist, Quantitative Developer, or Data Analyst. Wants methodology, tools,
  outcomes, taste.
- **Peer or collaborator.** Curious about craft and approach. Weird-in-a-good-way
  is welcome.
- **Anyone looking him up over the next two or three years.** The page should
  age without edits.

Context of use: overwhelmingly mobile, often from a LinkedIn or message link,
frequently one-handed. Desktop is the minority case.

Job to be done: decide whether to reply.

Emotion the page should evoke: quiet competence. Not slickness, not hustle.

## Product Purpose

Ahmed Alawi Radhi is an Applied Mathematics and Statistics graduate of Khalifa
University with two years across data science, data engineering, and analytics.
The page exists to get him interviews for the roles above, and to be the durable
thing that comes up when someone searches his name.

Success looks like a recruiter forwarding the link, and a hiring manager arriving
at the interview already knowing what the procurement audit platform is.

## Brand Personality

Precise, plain-spoken, unhurried.

Voice: first person, declarative, specific. Numbers where numbers are earned.
No adjectives doing work that evidence should do. Dry rather than warm, but not
cold: this is someone explaining their work carefully, not selling.

## References

- **haithamalkindi.com** — the structural reference the owner chose. What
  specifically fits: the reverse-chronological "path so far" as the spine of the
  page; the circular portrait with a thin ring; topic pills under the intro that
  let a scanner place him in three seconds; a vertical rail with year badges that
  makes the chronology legible rather than merely ordered; photographs sitting
  inline in the entries they belong to. What does NOT transfer: its purple, its
  centred desktop layout, its blog and FAQ.

## Anti-references

- Terminal and hacker aesthetics. Matrix green-on-black, cyberpunk glow,
  monospace-everything. The previous version of this site was a terminal
  metaphor and it was deliberately retired.
- Data-science teal dashboards. `#1a8fa8`, `#1d9bb8`, cyan, neon green.
- The saturated editorial-typographic lane: display serif italic headline, small
  monospace labels above every section, ruled three-column grids, monochrome
  restraint, no imagery. Photographs are what keep this page out of that lane.
- Cream, sand, and parchment body backgrounds.
- Notion-template portfolios. Centred-avatar-three-column-cards portfolios.
- Language proficiency shown as a percentage bar.

## Design Principles

1. **Density earns trust.** Lots of signal, tight composition, no filler. If a
   card can be a line, make it a line.
2. **Photographs are load-bearing.** Zero images is a bug, not restraint. They
   are what separate this from a résumé rendered in HTML.
3. **Every word earns its place.** No "highly motivated", no "strong passion".
   If a sentence could appear on any portfolio, it does not appear on this one.
4. **The site is not the CV.** The CV holds everything; the site holds the best
   of it, and every number traces to the CV or a verified repository.
5. **Mobile is the real surface.** Most readers arrive on a phone from a link.
   Desktop is the second case, not the design target.
6. **Content is data; interface is code.** Anything Ahmed writes about himself
   lives in `data/*.json`. Structural interface labels live in the renderers.

## Accessibility & Inclusion

- WCAG AA minimum, verified numerically by `test/tokens-contrast.test.js` rather
  than asserted.
- Preserved foundations, non-negotiable: skip link, `prefers-reduced-motion`,
  `prefers-contrast`, keyboard-usage detection, screen-reader announcements on
  theme change, real list semantics on the timeline, `lang` and `dir` on the
  Arabic name, descriptive alt text on every photograph.
- Both themes are first-class. Light is primary; dark is a derived palette, not
  an afterthought.
- The page must print cleanly; a recruiter printing it gets a usable document.
