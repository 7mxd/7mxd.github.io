# tools/make_og_image.py
"""Compose the 1200x630 Open Graph card.

Run from the repository root:  python tools/make_og_image.py

This is the first surface most readers see. PRODUCT.md says they arrive
"overwhelmingly from a LinkedIn or message link", and LinkedIn's feed renders
the image, og:title and the domain, then discards og:description entirely. So
for the primary channel this PNG plus a dozen words of title IS the portfolio.

Two rules follow from that, and both are load-bearing:

1. Every line has to say something checkable. The card used to read "Data
   scientist in Abu Dhabi" over "Data pipelines, analysis, applied statistics":
   three capability nouns that would fit any data-science graduate, which is
   exactly what CLAUDE.md's fourth principle forbids. It now carries the
   employer with dates, the degree, and the ask.

2. Every drawn line has to survive a centre crop. WhatsApp and iMessage unfurl
   previews crop to a 630x630 square (x=285..915), so anything wider than about
   550px measured gets its ends cut off. The first draft anchored the block hard
   left and that crop removed the face entirely.

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
# the page.
CARD_NAME = "og-image-2026-09.png"
LEGACY_CARD_NAME = "og-image.png"

SIZE = (1200, 630)
CROP_SAFE_WIDTH = 550  # the 630px centre crop, less a little breathing room

# Smaller than the 380 the previous card used: three lines of text need the
# vertical room, and the wordmark art is nearly square (924x782) rather than a
# wide logotype, so its width buys height fast.
WORDMARK_WIDTH = 260
GAP_AFTER_WORDMARK = 34
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

    Returns a list of (text, font_size, colour) plus the sidecar record. The
    employer line ages correctly on its own: it is a closed date range, so it
    stays true after the contract ends without anyone editing anything.
    """
    profile = load("profile")
    experience = load("experience")
    education = load("education")

    company = experience["items"][0]["company"]
    roles = experience["items"][0]["roles"]
    years = sorted({r["startDate"][:4] for r in roles} | {
        r["endDate"][:4] for r in roles if r["endDate"][:4].isdigit()
    })
    tenure = f"{years[0]}\u2013{years[-1]}" if len(years) > 1 else years[0]
    institution = education["items"][0]["institution"]

    return [
        (profile["role"], 38, INK),
        (f"{company}, {tenure} \u00b7 {institution}", 30, MUTED),
        (profile["status"].rstrip("."), 30, MUTED),
    ]


def main():
    card = Image.new("RGB", SIZE, GROUND)
    draw = ImageDraw.Draw(card)

    wordmark = Image.open(ROOT / "assets" / "brand" / "logo-wordmark.png")
    scale = WORDMARK_WIDTH / wordmark.width
    wordmark = wordmark.resize((WORDMARK_WIDTH, round(wordmark.height * scale)), Image.LANCZOS)

    def width_of(text, font):
        box = draw.textbbox((0, 0), text, font=font)
        # bbox[2] - bbox[0], not bbox[2]: the left bearing is not part of the
        # drawn width, and treating it as such shifted every centred line.
        return box[2] - box[0], box[3] - box[1]

    def wrap(text, font):
        """Greedy wrap to the crop budget.

        The availability line is the longest thing on the card and the one least
        worth shortening — it names the three roles he actually wants, and
        trimming it to fit would trade the specificity for the layout. Wrapping
        keeps the copy exact and spends vertical room the card has.
        """
        words, lines, current = text.split(), [], ''
        for word in words:
            candidate = f'{current} {word}'.strip()
            if current and width_of(candidate, font)[0] > CROP_SAFE_WIDTH:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines

    lines = card_lines()
    measured = []
    for text, size, colour in lines:
        font = load_font(size)
        for piece in wrap(text, font):
            w, h = width_of(piece, font)
            measured.append((piece, font, colour, w, h))

    content_h = wordmark.height + GAP_AFTER_WORDMARK + sum(
        h + (GAP_BETWEEN_LINES if i else 0) for i, (_, _, _, _, h) in enumerate(measured)
    )
    top = (SIZE[1] - content_h) // 2

    # Each element centred on its own width, not on the widest one: centring the
    # block and left-aligning inside it put the smallest, greyest line dead
    # centre while the wordmark sat 59px off the midline.
    card.paste(wordmark, ((SIZE[0] - wordmark.width) // 2, top), wordmark)

    y = top + wordmark.height + GAP_AFTER_WORDMARK
    overflow = []
    for i, (text, font, colour, w, h) in enumerate(measured):
        if i:
            y += GAP_BETWEEN_LINES
        draw.text(((SIZE[0] - w) // 2, y), text, font=font, fill=colour)
        if w > CROP_SAFE_WIDTH:
            overflow.append(f"{w}px  {text}")
        y += h

    out = ROOT / "assets" / CARD_NAME
    card.save(out, "PNG", optimize=True)
    card.save(ROOT / "assets" / LEGACY_CARD_NAME, "PNG", optimize=True)

    # The sidecar is what test/og-card.test.js compares against data/*.json, so
    # a copy edit that never regenerated the card fails the suite instead of
    # shipping a stale picture with a green build.
    sidecar = ROOT / "assets" / "og-image.json"
    with open(sidecar, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"lines": [t for t, _, _ in lines]}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{out.name}  {card.size}  {out.stat().st_size // 1024}KB  top-margin={top}px")
    for text, _, _, w, _ in measured:
        print(f"  {w:4}px  {text}")
    if overflow:
        raise SystemExit(
            f"\n{len(overflow)} line(s) exceed the {CROP_SAFE_WIDTH}px centre-crop budget "
            "and would be cut off in a WhatsApp or iMessage preview:\n  "
            + "\n  ".join(overflow)
        )


if __name__ == "__main__":
    main()
