# Editorial revamp: decisions taken on the owner's behalf

Date: 2026-09-06 to 2026-09-07
Branch: `worktree-editorial-revamp`, 34 commits
Spec: `docs/superpowers/specs/2026-09-06-editorial-revamp-design.md`
Plan: `docs/superpowers/plans/2026-09-06-editorial-revamp.md`

Every judgement call made without asking is recorded here, with what it costs if
it was wrong. Rework anything you disagree with; nothing below is load-bearing
for anything else unless it says so.

## Decisions about the site itself

**Interface labels stay in code; author content stays in data.** `CLAUDE.md` says
"content is data, not code". Read literally that pushes button labels like "Read
more about this work" and "Download CV" into JSON. The line drawn: anything the
owner writes about himself lives in `data/*.json`; structural interface
affordances live in the markup and renderers. Written into `CLAUDE.md` so it
stops being re-litigated. *If wrong: a future translation would need those
strings extracted.*

**Golden Key's "top fifteen percent" was removed.** The claim traced to neither
the CV nor the scanned certificate, and the project constraint is that every
number traces to a source. The note now reads "Invitation-only, by nomination
from the university chapter." *If wrong: a true and impressive detail is missing
and can be restored.*

**The kernel RLS benchmark was corrected from 0.042 to 0.043.** The paper reports
0.042877. Truncating rather than rounding happened to flatter the author's own
row. *If wrong: nothing; 0.043 is the honest rounding.*

**LaTeX moved from Programming Languages to Developer Tools**, matching the CV.

**Test scores, phone number and nationality stay off the public page** but remain
in the downloadable CV. That was the spec's intent. The reviewer noted they are
therefore one click away; publishing a redacted public CV is an open choice.

**The Saal.ai role is described in the past across the site.** The role ends
23 September 2026. Seven locations stated the employer in the present tense and
the role's end date read "Present". The owner chose to be described by craft
rather than employer so the page ages without edits; Saal.ai still appears
throughout the timeline and Selected Work, dated.

**Wafa and HiSalon were removed from Selected Work** at the owner's request,
leaving the site consistent with the CV.

**The procurement audit platform was promoted from an experience bullet to a
Selected Work entry.** An earlier draft truncated the Saal.ai role from ten CV
bullets to four, discarding real evidence. Promoting the platform keeps every
bullet while preserving the timeline's scanning rhythm. The timeline now carries
a role's full bullet list unless that role's work has its own Selected Work
entry, in which case it carries three and links down.

**The numbers strip owns its figures exclusively.** All four originally appeared
in prose as well, violating the spec's no-duplication rule in the section built
to honour it. Five sentences were rewritten. Two of the rewrites are mild losses
in specificity: "author of the majority of its exception checks" is limper than
the count, and "a cohort of first-year students" is more institutional than "nine
freshmen". *If wrong: restore the figures to the prose and change the strip.*

**Timeline project entries carry no photographs.** They link down to Selected
Work instead. The Stmnt screenshots were rendering in both places, which the spec
forbids. Roles, degrees and milestones keep their inline photographs because they
have no article to link down to.

**The nav bar is wider than the reading column.** It has its own `--measure-nav`
token at 58rem rather than borrowing the 46rem prose measure, because a bar
carrying a wordmark, five links, a toggle and a button is chrome, not prose. *If
wrong: the nav sits visibly wider than the content; one token changes it.*

## Decisions about the brand mark

**The dark-mode recolour was abandoned.** Selecting pixels by darkness caught the
agal, eyebrow, moustache, beard and eye as well as the outline; opaque near-white
pixels went from 2,987 to 67,078 and the face washed out.

**The pipeline chroma-keys green rather than keying white.** The ghutra is white
cloth, so a white key could not distinguish it from the background and left it as
transparent negative space, which read as paper on light and vanished on dark.
The owner re-exported the art on a green screen. Zero residual green survives the
despill; opaque near-white pixels rose to 73,576 as the cloth became real. No
plate or backing is needed on either ground.

**The nav mark is sized by height with width following**, rather than forced into
a square box. The artwork is a half-face and its natural shape is about one to
two, so a square box pays for empty columns. It renders at 36 pixels tall. *If
wrong: it is small; raising the height is one line.*

## Decisions about engineering

**`normalizeImage` was wired into `loadSiteData`** rather than deleted as dead
code, so a missing `src` or missing alt text fails loudly at load.

**The admin schema was rebuilt against the real data model.** This was the
branch's one critical defect: the data shape was rewritten and the schema was
not, so saving `profile` through the admin dropped `nameArabic` and saving
`settings` dropped `nav` — either of which takes the whole page down. A
round-trip test over every real data file now makes that class of drift
impossible to reintroduce.

**`settings.meta` stayed in the admin schema** against an instruction to remove
it. Deleting it would have deleted `meta.description` from `settings.json` on the
next save, destroying the source of truth that `index.html`'s tags are now pinned
to, and reproducing the critical defect exactly.

**The spec's font-loading claim was amended rather than implemented.** It promised
metric-compatible fallback stacks via `size-adjust`; none existed. Getting the
overrides right needs measured metrics, and guessing would worsen reflow while
looking authoritative. The spec now states what actually ships. *If wrong: some
text reflow remains on slow connections that a measured pass would remove.*

**Print protection for Selected Work is defensive and currently inert.** The
rules guard against orphaned headings, torn link rows and widow lines. None of
those occur in today's content, and the before and after PDFs are pixel-identical
across all seven pages.

## Known and deliberately not fixed

**The organisation marks add roughly 142 KB of unoptimised image traffic.**
Rendering them fetches five logos of 12 to 46 KB, each drawn at 18 to 22 CSS
pixels, and both Saal.ai variants download on every load because a `display:none`
image still fetches in Chrome. This is the same defect class that was fixed one
commit earlier for the nav mark. It is below the fold and lazy-loaded, so it does
not affect largest contentful paint. `tools/process_brand.py` already has the
machinery to emit small rasters. **This is the first follow-up worth doing.**

**`admin/blocks-editor.js`'s select renderer reads `o.value` while the registry
writes plain strings**, so the callout-tone dropdown renders empty. Pre-existing,
one line, and squarely in the admin revamp that follows this project.

**The noscript fallback was verified over the DevTools Protocol, not by a browser
flag.** Chrome ignores `--disable-javascript` and `--blink-settings=scriptEnabled=false`
in this build. `Emulation.setScriptExecutionDisabled` works.

## Process notes worth carrying into the admin revamp

Three implementer reports in this project described what was expected rather than
what the artifact showed, and reviewers caught all three. Two false readings also
came from headless Chrome itself: a short `--virtual-time-budget` silently drops
lazy images, and `--window-size=390` does not produce a 390-pixel viewport in this
build because the window is clamped to 500 CSS pixels. Measure through an iframe
harness and use a generous time budget.
