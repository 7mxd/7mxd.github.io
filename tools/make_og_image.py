# tools/make_og_image.py
"""Compose the 1200x630 Open Graph card from the wordmark and a subtitle.

Run from the repository root:  python tools/make_og_image.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
GROUND = (250, 250, 249)
INK = (28, 31, 50)
MUTED = (88, 91, 107)

SIZE = (1200, 630)
SUBTITLE = "Data scientist in Abu Dhabi"
DETAIL = "Audit systems and data pipelines at Saal.ai"

LEFT_MARGIN = 96
WORDMARK_WIDTH = 380
GAP_WORDMARK_TO_SUBTITLE = 40
GAP_SUBTITLE_TO_DETAIL = 20

# Georgia ships with Windows and is a reasonable stand-in for the web serif.
FONT_CANDIDATES = ["C:/Windows/Fonts/georgia.ttf", "/System/Library/Fonts/Georgia.ttf"]


def load_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main():
    card = Image.new("RGB", SIZE, GROUND)
    draw = ImageDraw.Draw(card)

    # The wordmark art (face + stacked "Ahmed Radhi" wordtype) is nearly
    # square (924x782), not a wide horizontal logotype, so it cannot be
    # scaled to the width the first draft assumed (620px) without its
    # height alone exceeding the 630px card. Every element below is
    # measured and stacked, then the whole block is centred vertically so
    # the whitespace above the wordmark equals the whitespace below the
    # last line of text.
    wordmark = Image.open(ROOT / "assets" / "brand" / "logo-wordmark.png")
    scale = WORDMARK_WIDTH / wordmark.width
    wordmark = wordmark.resize((WORDMARK_WIDTH, round(wordmark.height * scale)), Image.LANCZOS)

    subtitle_font = load_font(38)
    detail_font = load_font(27)
    subtitle_h = draw.textbbox((0, 0), SUBTITLE, font=subtitle_font)[3]
    detail_h = draw.textbbox((0, 0), DETAIL, font=detail_font)[3]

    content_h = (
        wordmark.height
        + GAP_WORDMARK_TO_SUBTITLE
        + subtitle_h
        + GAP_SUBTITLE_TO_DETAIL
        + detail_h
    )
    top = (SIZE[1] - content_h) // 2

    card.paste(wordmark, (LEFT_MARGIN, top), wordmark)
    subtitle_y = top + wordmark.height + GAP_WORDMARK_TO_SUBTITLE
    detail_y = subtitle_y + subtitle_h + GAP_SUBTITLE_TO_DETAIL
    draw.text((LEFT_MARGIN, subtitle_y), SUBTITLE, font=subtitle_font, fill=INK)
    draw.text((LEFT_MARGIN, detail_y), DETAIL, font=detail_font, fill=MUTED)

    out = ROOT / "assets" / "og-image.png"
    card.save(out, "PNG", optimize=True)
    print(f"{out} {card.size} {out.stat().st_size // 1024}KB top-margin={top}px")


if __name__ == "__main__":
    main()
