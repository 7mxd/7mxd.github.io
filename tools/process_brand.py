# tools/process_brand.py
"""Key the chroma-green background out of the logo art and emit brand marks.

Run from the repository root:  python tools/process_brand.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
ASSETS = ROOT / "assets"

GROUND = (250, 250, 249)  # --ground, for the opaque Apple touch icon

# The source art is drawn on a chroma-key green. Keying green rather than
# white matters: the ghutra is WHITE cloth, and an earlier white-keyed
# version left it as transparent negative space, which read as paper on a
# light ground and vanished on a dark one. Keying green keeps the cloth
# opaque, so the mark works on any background with no plate behind it.
KEY_RGB = np.array([11, 248, 6], dtype=float)


def key_green(path, tol=110.0, soft=60.0, despill=True):
    """Remove the chroma-key green background, keeping white cloth opaque.

    Alpha ramps from 0 for pixels within `tol` of the key colour to 255 at
    `tol + soft`, so anti-aliased edges keep a soft transition instead of a
    hard stair-step. Distance is measured with the green channel weighted
    down, so a pixel is judged green by how far its red and blue sit below
    green rather than by absolute brightness — that keeps the white cloth
    (high in all three channels) far from the key even though it is bright.
    """
    im = Image.open(path).convert("RGB")
    arr = np.array(im).astype(float)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Greenness: how much green exceeds the stronger of red and blue.
    greenness = g - np.maximum(r, b)
    dist = np.clip(tol - greenness, 0, None)
    alpha = np.clip(dist / soft, 0, 1) * 255

    if despill:
        # Anti-aliased edge pixels carry a green fringe. Pull green down to
        # the brighter of red and blue wherever it overshoots, which removes
        # the fringe without touching genuinely green-free colour.
        cap = np.maximum(r, b)
        overshoot = g > cap
        g = np.where(overshoot, cap, g)
        arr[:, :, 1] = g

    out = np.dstack([arr, alpha]).astype("uint8")
    return Image.fromarray(out, "RGBA")


def trim(im):
    bbox = im.getchannel("A").getbbox()
    return im.crop(bbox) if bbox else im


def center_square(im, pad_ratio=0.06):
    """Centre the artwork on a square canvas sized to its long edge.

    The drawing is a half-face, so it is tall and narrow: roughly 373 by
    784 after trimming. On a square canvas it therefore fills its height
    but only about 41% of its width, and about 20% of the canvas area.
    That is inherent to the subject, not a packing bug — a square canvas
    is required for the favicon slots. Consumers that do not need a square
    (the nav) should set height and let width follow, rather than forcing
    a square box and paying for the empty columns.
    """
    im = trim(im)
    w, h = im.size
    side = int(round(max(w, h) * (1 + pad_ratio * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas


def main():
    icon = center_square(key_green(BRAND / "logo-icon-source.jpg"))
    icon.save(BRAND / "logo-icon.png")

    # The master is ~876px and ~250KB. The nav draws it at 2.25rem, so it gets
    # its own small pair instead: 72px for the 1x slot, 144px for 2x and up.
    # The master stays for the favicon sizes generated below.
    for name, size in (("logo-icon-72.png", 72), ("logo-icon-144.png", 144)):
        icon.resize((size, size), Image.LANCZOS).save(BRAND / name)

    wordmark = trim(key_green(BRAND / "logo-wordmark-source.jpg"))
    wordmark.save(BRAND / "logo-wordmark.png")

    for name, size in (
        ("favicon-16x16.png", 16),
        ("favicon-32x32.png", 32),
        ("android-chrome-192x192.png", 192),
        ("android-chrome-512x512.png", 512),
    ):
        icon.resize((size, size), Image.LANCZOS).save(ASSETS / name)

    # iOS ignores alpha and composites on black, so flatten onto the site ground.
    touch = Image.new("RGB", (180, 180), GROUND)
    scaled = icon.resize((180, 180), Image.LANCZOS)
    touch.paste(scaled, (0, 0), scaled)
    touch.save(ASSETS / "apple-touch-icon.png")

    print(f"icon {icon.size}  wordmark {wordmark.size}")


if __name__ == "__main__":
    main()
