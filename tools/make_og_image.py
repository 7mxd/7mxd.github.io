# tools/make_og_image.py
"""Compose the 1200x630 Open Graph card.

Run from the repository root:  python tools/make_og_image.py

This is the first surface most readers see. PRODUCT.md says they arrive
"overwhelmingly from a LinkedIn or message link", and LinkedIn's feed renders
the image, og:title and the domain, then discards og:description entirely. So
for the primary channel this PNG plus a dozen words of title IS the portfolio.

Three rules follow from that, and all three are load-bearing:

1. Every line has to say something checkable. The card used to read "Data
   scientist in Abu Dhabi" over "Data pipelines, analysis, applied statistics":
   three capability nouns that would fit any data-science graduate, which is
   exactly what CLAUDE.md's fourth principle forbids. It now carries the
   employer with dates, the degree, and the ask.

2. Every drawn line has to survive a centre crop. WhatsApp and iMessage unfurl
   previews crop to a 630x630 square (x=285..915), so anything wider than about
   550px measured gets its ends cut off. The first draft anchored the block hard
   left and that crop removed the face entirely.

3. Nothing ships that the run itself judged broken. The overflow check runs
   before the PNGs are written, not after, so a card that fails the crop budget
   leaves no file behind for the test suite to bless.

The strings are read from data/*.json rather than held here, because a literal
in a generator is content living in code, which the project's first convention
forbids. Reading them only prevents drift at regeneration time, though, so
main() also writes a sidecar assets/og-image.json recording exactly what it
drew; test/og-card.test.js asserts that against the data files, which catches a
copy edit that shipped without a rerun.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

GROUND = (250, 250, 249)
INK = (28, 31, 50)
MUTED = (88, 91, 107)

# Dated, because Open Graph images are cached hard per URL: a redesign at the
# same path stays invisible on every link already shared. The legacy path is
# rewritten with the same bytes in the same run, so old shares improve too as
# their caches expire, rather than being left on a card that no longer matches
# the page. test/og-card.test.js reads this name back out of this file and
# asserts index.html points at it, so the two cannot drift.
CARD_NAME = "og-image-2026-09.png"
LEGACY_CARD_NAME = "og-image.png"

SIZE = (1200, 630)
CROP_SAFE_WIDTH = 550  # the 630px centre crop, less a little breathing room

# Smaller than the 380 the previous card used: three lines of text need the
# vertical room, and the wordmark art is nearly square (924x782) rather than a
# wide logotype, so its width buys height fast.
WORDMARK_WIDTH = 260
GAP_AFTER_WORDMARK = 34

# Two gaps, because they do two different jobs. Continuation lines of one
# wrapped sentence are spaced by the font's own line height and nothing else,
# so they read as one sentence; this gap is added only where a new card line
# begins. A single constant served both for a while, which made the wrapped
# availability line look like a list of unrelated statements.
GAP_BETWEEN_LINES = 16

# Georgia ships with Windows and is a reasonable stand-in for the site's Source
# Serif. macOS moved its bundled fonts to Supplemental/ years ago; the old path
# here was wrong, so a Mac silently took the bitmap fallback branch.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/georgia.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/Library/Fonts/Georgia.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
]


def load_font(size):
    """A real face, or nothing.

    This used to fall back to ImageFont.load_default(), an 11px bitmap, and
    main() then printed success — so a machine without Georgia produced a card
    that looked broken and reported that it had worked. A card is shipped rarely
    and looked at by everyone; failing loudly is the cheaper mistake.
    """
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit(
        "No usable serif font found. Tried:\n  " + "\n  ".join(FONT_CANDIDATES) + "\n"
        "Install one or add its path to FONT_CANDIDATES. Refusing to draw the "
        "card with a bitmap fallback, which would ship looking broken."
    )


def load(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def card_lines():
    """The three lines, derived from the content files.

    Returns a list of (text, font_size, colour). The employer line ages
    correctly on its own: while the range is closed it stays true after the
    contract ends without anyone editing anything, and an open role prints as
    a range ending in "present" rather than as a bare year.
    """
    profile = load("profile")
    experience = load("experience")
    education = load("education")

    company = experience["items"][0]["company"]
    roles = experience["items"][0]["roles"]
    years = sorted({r["startDate"][:4] for r in roles} | {
        r["endDate"][:4] for r in roles if r["endDate"][:4].isdigit()
    })
    # admin/schema.js advertises "Present" as a valid endDate, and an open role
    # is the ordinary state for the person this card is for. Without this the
    # card drew "Saal.ai, 2024", which reads as a job that lasted a year.
    open_ended = any(not r["endDate"][:4].isdigit() for r in roles)
    end = "present" if open_ended else years[-1]
    tenure = f"{years[0]}\u2013{end}" if end != years[0] else years[0]
    institution = education["items"][0]["institution"]

    return [
        (profile["role"], 38, INK),
        (f"{company}, {tenure} \u00b7 {institution}", 30, MUTED),
        (profile["status"].rstrip("."), 30, MUTED),
    ]


def wrap(text, width_of, budget):
    """Break one card line into the fewest, most even lines it can be.

    Deliberately not a greedy wrap. Greedy fills the first line to the budget,
    which here broke "Open to Data Scientist, Quantitative / Developer and Data
    Analyst roles" — splitting a role name across lines, so the card's most
    valuable sentence read as a layout accident.

    Two rules replace it. A line may not end between two capitalised words,
    because that pair is a name: "Quantitative Developer", "Data Analyst".
    Punctuation closes a name, so "Scientist," may end a line. Subject to that,
    take the fewest lines the text fits in, and among those the arrangement
    whose widest line is narrowest: the block is centred, and even lines read as
    one set where ragged ones read as an accident.
    """
    words = text.split()
    n = len(words)
    if not n:
        return []

    def width(i, j):
        return width_of(" ".join(words[i:j]))

    def may_end_at(j):
        if j >= n:
            return True
        prev, nxt = words[j - 1], words[j]
        return not (prev[:1].isupper() and nxt[:1].isupper() and prev[-1:].isalnum())

    def arrange(count):
        """Widest line of the best split of words[i:] into k lines, or None."""
        memo = {}

        def best(i, k):
            if k == 0:
                return (0, None) if i == n else (None, None)
            if (i, k) not in memo:
                found = (None, None)
                for j in range(i + 1, n + 1):
                    w = width(i, j)
                    # A single word wider than the budget is allowed to stand
                    # alone: nothing can be done about it, and refusing to
                    # place it would wedge the wrap. main() still refuses to
                    # ship the card.
                    if w > budget and j > i + 1:
                        break
                    if not may_end_at(j):
                        continue
                    rest, _ = best(j, k - 1)
                    if rest is None:
                        continue
                    widest = max(w, rest)
                    if found[0] is None or widest < found[0]:
                        found = (widest, j)
                memo[(i, k)] = found
            return memo[(i, k)]

        if best(0, count)[0] is None:
            return None
        lines, i, k = [], 0, count
        while k:
            j = best(i, k)[1]
            lines.append(" ".join(words[i:j]))
            i, k = j, k - 1
        return lines

    for count in range(1, n + 1):
        lines = arrange(count)
        if lines:
            return lines
    return [text]  # unreachable: one word per line is always a valid split


def main():
    card = Image.new("RGB", SIZE, GROUND)
    draw = ImageDraw.Draw(card)

    wordmark = Image.open(ROOT / "assets" / "brand" / "logo-wordmark.png")
    scale = WORDMARK_WIDTH / wordmark.width
    wordmark = wordmark.resize((WORDMARK_WIDTH, round(wordmark.height * scale)), Image.LANCZOS)

    def measure(text, font):
        """Left bearing and inked width. Not bbox[2], which includes the
        bearing and so shifted every centred line by a pixel or two."""
        box = draw.textbbox((0, 0), text, font=font)
        return box[0], box[2] - box[0]

    rows = []
    for text, size, colour in card_lines():
        font = load_font(size)
        ascent, descent = font.getmetrics()
        # The font's line box, not the inked height of these particular glyphs.
        # Stepping by the ink height made the leading depend on whether a line
        # happened to contain a descender.
        line_h = ascent + descent
        pieces = wrap(text, lambda t, f=font: measure(t, f)[1], CROP_SAFE_WIDTH)
        for i, piece in enumerate(pieces):
            bearing, ink_w = measure(piece, font)
            rows.append((piece, font, colour, bearing, ink_w, line_h, i == 0))

    content_h = wordmark.height + GAP_AFTER_WORDMARK + sum(
        line_h + (GAP_BETWEEN_LINES if i and starts else 0)
        for i, (_, _, _, _, _, line_h, starts) in enumerate(rows)
    )
    top = (SIZE[1] - content_h) // 2

    print(f"{CARD_NAME}  {SIZE}  top-margin={top}px")
    for text, _, _, _, ink_w, _, _ in rows:
        print(f"  {ink_w:4}px  {text}")

    # Both gates run before anything is written. A run that judges the card
    # unshippable used to have already saved it twice, with a matching sidecar,
    # so `npm test` went green on a card the generator had just condemned.
    overflow = [f"{ink_w}px  {text}" for text, _, _, _, ink_w, _, _ in rows if ink_w > CROP_SAFE_WIDTH]
    if overflow:
        raise SystemExit(
            f"\n{len(overflow)} line(s) exceed the {CROP_SAFE_WIDTH}px centre-crop budget "
            "and would be cut off in a WhatsApp or iMessage preview:\n  "
            + "\n  ".join(overflow)
        )
    if top < 0:
        raise SystemExit(
            f"\nThe block is {-2 * top}px taller than the card. Nothing checked this "
            "before, so a longer status line would have silently drawn off both edges."
        )

    # Each element centred on its own inked width, not on the widest one:
    # centring the block and left-aligning inside it put the smallest, greyest
    # line dead centre while the wordmark sat 59px off the midline.
    card.paste(wordmark, ((SIZE[0] - wordmark.width) // 2, top), wordmark)

    y = top + wordmark.height + GAP_AFTER_WORDMARK
    for i, (text, font, colour, bearing, ink_w, line_h, starts) in enumerate(rows):
        if i and starts:
            y += GAP_BETWEEN_LINES
        draw.text(((SIZE[0] - ink_w) // 2 - bearing, y), text, font=font, fill=colour)
        y += line_h

    out = ROOT / "assets" / CARD_NAME
    card.save(out, "PNG", optimize=True)
    card.save(ROOT / "assets" / LEGACY_CARD_NAME, "PNG", optimize=True)

    # The sidecar is what test/og-card.test.js compares against data/*.json, so
    # a copy edit that never regenerated the card fails the suite instead of
    # shipping a stale picture with a green build. It records the card lines as
    # authored, not as wrapped: the wrap is layout, the text is content.
    sidecar = ROOT / "assets" / "og-image.json"
    with open(sidecar, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"lines": [t for t, _, _ in card_lines()]}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"wrote {out.name} and {LEGACY_CARD_NAME}  {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
