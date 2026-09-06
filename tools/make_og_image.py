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
DETAIL = "Data pipelines, analysis, applied statistics"

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
    # measured, then the whole block is centred both vertically (top
    # margin equals bottom margin) and horizontally (block centred on the
    # canvas midline, x=600). Horizontal centring matters beyond symmetry:
    # WhatsApp and iMessage unfurl previews centre-crop the card to a
    # 630x630 square (x=285..915). A block anchored hard left, as the
    # first draft did, put the wordmark's face entirely to the left of
    # that crop and left only text fragments inside it. Centring the
    # block on the canvas midline keeps it centred on the crop too, since
    # the crop is itself centred on that midline.
    wordmark = Image.open(ROOT / "assets" / "brand" / "logo-wordmark.png")
    scale = WORDMARK_WIDTH / wordmark.width
    wordmark = wordmark.resize((WORDMARK_WIDTH, round(wordmark.height * scale)), Image.LANCZOS)

    subtitle_font = load_font(38)
    detail_font = load_font(27)
    subtitle_bbox = draw.textbbox((0, 0), SUBTITLE, font=subtitle_font)
    detail_bbox = draw.textbbox((0, 0), DETAIL, font=detail_font)
    subtitle_w, subtitle_h = subtitle_bbox[2], subtitle_bbox[3]
    detail_w, detail_h = detail_bbox[2], detail_bbox[3]

    content_h = (
        wordmark.height
        + GAP_WORDMARK_TO_SUBTITLE
        + subtitle_h
        + GAP_SUBTITLE_TO_DETAIL
        + detail_h
    )
    top = (SIZE[1] - content_h) // 2

    block_w = max(wordmark.width, subtitle_w, detail_w)
    left = (SIZE[0] - block_w) // 2

    card.paste(wordmark, (left, top), wordmark)
    subtitle_y = top + wordmark.height + GAP_WORDMARK_TO_SUBTITLE
    detail_y = subtitle_y + subtitle_h + GAP_SUBTITLE_TO_DETAIL
    draw.text((left, subtitle_y), SUBTITLE, font=subtitle_font, fill=INK)
    draw.text((left, detail_y), DETAIL, font=detail_font, fill=MUTED)

    out = ROOT / "assets" / "og-image.png"
    card.save(out, "PNG", optimize=True)
    print(
        f"{out} {card.size} {out.stat().st_size // 1024}KB "
        f"top-margin={top}px block=({left},{top})-({left + block_w},{top + content_h})"
    )


if __name__ == "__main__":
    main()
