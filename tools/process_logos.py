# tools/process_logos.py
"""Downscale the organisation marks to the size the page actually draws them.

Run from the repository root:  python tools/process_logos.py

The timeline renders each mark at 1.375rem, about 22 CSS pixels. The sources
are 225 to 400 pixels square and total roughly 138 KB, which is more image
weight than the hero portrait for five marks the size of a full stop. Worse,
both Saal.ai variants download on every load regardless of theme, because a
`display: none` image is still fetched.

A 64-pixel raster covers the 22-pixel slot to nearly 3x device pixel ratio and
costs a few KB, which makes the both-variants fetch stop mattering rather than
needing a `<picture>` element whose media query would disagree with the site's
own `data-theme` toggle.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "logos"

SIZE = 64

SOURCES = [
    "SAAL_LIGHT.png",
    "SAAL_DARK.png",
    "Khalifa_University_Logo.png",
    "Daman_Logo.png",
    "Al_Nahda_Logo.png",
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total_before = 0
    total_after = 0

    for name in SOURCES:
        src = ASSETS / name
        total_before += src.stat().st_size

        im = Image.open(src).convert("RGBA")
        # Fit inside the box rather than cropping: these are third-party marks
        # and their own margins are part of the artwork.
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)

        out = OUT / name.lower().replace("_logo", "").replace("_", "-")
        im.save(out, "PNG", optimize=True)
        total_after += out.stat().st_size
        print(f"{out.name:28} {im.size[0]}x{im.size[1]} {out.stat().st_size / 1024:6.1f} KB")

    print(f"\n{total_before / 1024:.0f} KB -> {total_after / 1024:.1f} KB")


if __name__ == "__main__":
    main()
