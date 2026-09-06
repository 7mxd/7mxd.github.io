# tools/process_brand.py
"""Key the flat-white background out of the logo art and emit brand marks.

Run from the repository root:  python tools/process_brand.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
ASSETS = ROOT / "assets"

SENTINEL = (255, 0, 255)
GROUND = (250, 250, 249)  # --ground, for the opaque Apple touch icon


def key_background(path, thresh=30, feather=0.8):
    """Remove background white reachable from the border, keeping enclosed white."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(im, seed, SENTINEL, thresh=thresh)

    arr = np.array(im)
    mask = np.all(arr == np.array(SENTINEL, dtype=arr.dtype), axis=-1)

    # Repaint sentinel pixels white so feathering cannot bleed magenta inward.
    arr[mask] = (255, 255, 255)

    alpha = Image.fromarray(np.where(mask, 0, 255).astype("uint8"))
    if feather:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))

    out = Image.fromarray(arr).convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(im):
    bbox = im.getchannel("A").getbbox()
    return im.crop(bbox) if bbox else im


def center_square(im, pad_ratio=0.08):
    im = trim(im)
    w, h = im.size
    side = int(round(max(w, h) * (1 + pad_ratio * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas


def main():
    icon = center_square(key_background(BRAND / "logo-icon-source.jpg"))
    icon.save(BRAND / "logo-icon.png")

    wordmark = trim(key_background(BRAND / "logo-wordmark-source.jpg"))
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
