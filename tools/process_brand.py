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
INK_DARK = (0xE9, 0xE7, 0xE2)  # --ink in [data-theme="dark"], css/tokens.css


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


def recolor_dark_lines(icon, low=0.30, high=0.45, chroma_lo=0.30, chroma_hi=0.50, ink=INK_DARK):
    """Remap the icon's dark navy line art to the dark theme's ink colour,
    leaving skin and beard tones untouched.

    About 80% of the source canvas is alpha 0: the ghutra's white cloth is
    drawn as transparent negative space, not a white fill, so it reads
    correctly against a light ground but disappears into a dark one. Worse,
    the near-black line art that outlines the face and headband also nearly
    vanishes against a dark ground (roughly 1.1:1), leaving only the opaque
    skin-tone patch afloat with no linework to define it.

    Pixels are selected by how dark and desaturated they are rather than by
    exact colour match, since the art is anti-aliased: a hard threshold
    would leave a visible hard edge around every stroke. Weight ramps
    linearly from 1 (fully recoloured) at `low` lightness down to 0 at
    `high`, and is additionally suppressed for anything with real chroma
    (skin tones measure ~0.32 mean chroma here; the line art measures
    ~0.05), so a hypothetical dark-but-saturated colour would not be pulled
    in just for being dark.
    """
    arr = np.array(icon.convert("RGBA")).astype(float)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    channel_max = rgb.max(axis=2)
    channel_min = rgb.min(axis=2)
    lightness = (channel_max + channel_min) / 2 / 255
    chroma = (channel_max - channel_min) / 255

    weight_lightness = np.clip((high - lightness) / (high - low), 0, 1)
    weight_chroma = np.clip((chroma_hi - chroma) / (chroma_hi - chroma_lo), 0, 1)
    weight = (weight_lightness * weight_chroma)[:, :, None]

    ink_arr = np.array(ink, dtype=float)
    new_rgb = rgb * (1 - weight) + ink_arr * weight
    out = np.concatenate([new_rgb, alpha[:, :, None]], axis=2).astype("uint8")
    return Image.fromarray(out, "RGBA")


def main():
    icon = center_square(key_background(BRAND / "logo-icon-source.jpg"))
    icon.save(BRAND / "logo-icon.png")

    icon_dark = recolor_dark_lines(icon)
    icon_dark.save(BRAND / "logo-icon-dark.png")

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

    print(f"icon {icon.size}  icon-dark {icon_dark.size}  wordmark {wordmark.size}")


if __name__ == "__main__":
    main()
