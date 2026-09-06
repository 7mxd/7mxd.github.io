// test/assets-photos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const asset = (p) => new URL(`../${p}`, import.meta.url);

const STEMS = [
  'portrait-formal',
  'graduation-ceremony-certificate',
  'graduation-campus-certificate',
  'honors-day-ceremony',
  'volunteering-meal-packing',
  'egaming-competition-demo',
  'stmnt-01-spending-by-category',
  'stmnt-04-recurring-subscriptions',
  'stmnt-05-smart-forecast',
];

// Walk JPEG segment markers to read the SOF frame dimensions.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF3 and SOF5..SOF7 and SOF9..SOF11 carry the frame header.
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker found');
}

// Read width/height straight out of a PNG's IHDR chunk (bytes 16-23, after
// the 8-byte signature and the 4-byte length + 4-byte "IHDR" type).
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function sizeOf(path, buf) {
  return path.endsWith('.png') ? pngSize(buf) : jpegSize(buf);
}

// Maps each derived stem back to the exact source file tools/process_photos.py
// reads, so the test can measure the real source pixel dimensions instead of
// trusting a hand-copied number that could drift if a source is replaced.
const SOURCE_FILES = {
  'portrait-formal': 'assets/photos/portrait-formal.jpg',
  'graduation-ceremony-certificate': 'assets/photos/graduation-ceremony-certificate.jpg',
  'graduation-campus-certificate': 'assets/photos/graduation-campus-certificate.jpg',
  'honors-day-ceremony': 'assets/photos/honors-day-ceremony.jpg',
  'volunteering-meal-packing': 'assets/photos/volunteering-meal-packing.jpg',
  'egaming-competition-demo': 'assets/photos/egaming-competition-demo.jpg',
  'stmnt-01-spending-by-category': 'assets/photos/stmnt/01-spending-by-category.png',
  'stmnt-04-recurring-subscriptions': 'assets/photos/stmnt/04-recurring-subscriptions.png',
  'stmnt-05-smart-forecast': 'assets/photos/stmnt/05-smart-forecast.png',
};

// tools/process_photos.py crops this one stem (a soft video frame where the
// subject occupies only the left ~60%) before resizing, so its effective
// "source" long edge is the post-crop size, not the raw file's. Duplicated
// from CROPS in tools/process_photos.py — keep the two in sync.
const CROPS = {
  'volunteering-meal-packing': [0.0, 0.05, 0.62, 0.95],
};

// The long edge of whatever tools/process_photos.py actually hands to
// Image.thumbnail() for this stem: the raw source dimensions, or the
// post-crop dimensions when the stem has an entry in CROPS.
function preResizeLongEdge(stem) {
  const path = SOURCE_FILES[stem];
  const { width, height } = sizeOf(path, readFileSync(asset(path)));
  const crop = CROPS[stem];
  if (!crop) return Math.max(width, height);
  const [l, t, r, b] = crop;
  const croppedWidth = Math.trunc(width * r) - Math.trunc(width * l);
  const croppedHeight = Math.trunc(height * b) - Math.trunc(height * t);
  return Math.max(croppedWidth, croppedHeight);
}

test('every derived photograph exists at both widths', () => {
  for (const stem of STEMS) {
    for (const w of [1600, 800]) {
      const buf = readFileSync(asset(`assets/photos/derived/${stem}-${w}.jpg`));
      assert.ok(buf.length > 0, `${stem}-${w} is empty`);
    }
  }
});

// Pillow's thumbnail() only ever shrinks, so a derivative's long edge is
// capped at the nominal width, but sources already smaller than a cap keep
// their own (post-crop, where applicable) dimensions rather than being
// upscaled to meet it.
test('long edge is capped at the nominal width, never upscaled past the source', () => {
  for (const stem of STEMS) {
    const srcLongEdge = preResizeLongEdge(stem);
    for (const cap of [1600, 800]) {
      const { width, height } = jpegSize(readFileSync(asset(`assets/photos/derived/${stem}-${cap}.jpg`)));
      const longEdge = Math.max(width, height);
      assert.ok(longEdge <= cap, `${stem}-${cap} long edge ${longEdge} exceeds cap ${cap}`);
      assert.ok(
        longEdge === cap || longEdge === srcLongEdge,
        `${stem}-${cap} long edge ${longEdge} is neither the cap ${cap} nor the source's own long edge ${srcLongEdge}`,
      );
    }
  }
});

test('EXIF is stripped, so no GPS coordinates ship', () => {
  for (const stem of STEMS) {
    const buf = readFileSync(asset(`assets/photos/derived/${stem}-1600.jpg`));
    assert.equal(buf.includes(Buffer.from('Exif\0\0', 'binary')), false, `${stem} still carries EXIF`);
  }
});

test('derived files are small enough to ship', () => {
  for (const stem of STEMS) {
    const buf = readFileSync(asset(`assets/photos/derived/${stem}-1600.jpg`));
    assert.ok(buf.length < 400 * 1024, `${stem}-1600 is ${Math.round(buf.length / 1024)}KB`);
  }
});
