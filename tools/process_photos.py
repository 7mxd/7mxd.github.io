# tools/process_photos.py
"""Resize, strip EXIF, and re-encode the site photographs.

Run from the repository root:  python tools/process_photos.py
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "assets" / "photos"
DERIVED = PHOTOS / "derived"

WIDTHS = (1600, 800)
QUALITY = 82

# (source path relative to assets/photos, output stem)
SOURCES = [
    ("portrait-formal.jpg", "portrait-formal"),
    ("graduation-ceremony-certificate.jpg", "graduation-ceremony-certificate"),
    ("graduation-campus-certificate.jpg", "graduation-campus-certificate"),
    ("honors-day-ceremony.jpg", "honors-day-ceremony"),
    ("honors-day-deans-list.jpg", "honors-day-deans-list"),
    ("volunteering-meal-packing.jpg", "volunteering-meal-packing"),
    ("egaming-competition-demo.jpg", "egaming-competition-demo"),
    ("stmnt/01-spending-by-category.png", "stmnt-01-spending-by-category"),
    ("stmnt/04-recurring-subscriptions.png", "stmnt-04-recurring-subscriptions"),
    ("stmnt/05-smart-forecast.png", "stmnt-05-smart-forecast"),
]

# stem: (left, top, right, bottom) as fractions of the source size.
# volunteering-meal-packing is a soft video frame where Ahmed (in a
# high-visibility vest) occupies roughly the left 60%; crop in closer.
CROPS = {
    "volunteering-meal-packing": (0.0, 0.05, 0.62, 0.95),
}


def main():
    DERIVED.mkdir(parents=True, exist_ok=True)
    for rel, stem in SOURCES:
        src = Image.open(PHOTOS / rel)
        # Apply the EXIF orientation to the pixels BEFORE discarding the EXIF.
        # Stripping it first shipped any phone photo taken in portrait on its
        # side: honors-day-deans-list.jpg carries orientation 6, so its stored
        # pixels are landscape and only the tag says otherwise. Every earlier
        # source happened to be orientation 1, so this never bit until now.
        src = ImageOps.exif_transpose(src)
        # Re-creating the image from its pixel data drops every EXIF block.
        clean = Image.new("RGB", src.size)
        clean.paste(src.convert("RGB"))

        if stem in CROPS:
            w, h = clean.size
            l, t, r, b = CROPS[stem]
            clean = clean.crop((int(w * l), int(h * t), int(w * r), int(h * b)))

        for cap in WIDTHS:
            im = clean.copy()
            im.thumbnail((cap, cap), Image.LANCZOS)
            out = DERIVED / f"{stem}-{cap}.jpg"
            im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            print(f"{out.name:52} {im.size[0]}x{im.size[1]} {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
