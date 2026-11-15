/**
 * Vantelyo — favicon builder.
 * Renders assets/img/logo.svg into PNG icons (16, 32, 48, 96, 180, 192, 512)
 * and produces a single multi-resolution favicon.ico (16/32/48) using PNG
 * payloads inside the ICO container (Vista+ compatible).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'img', 'logo.svg');
const OUT = path.join(ROOT, 'assets', 'img');
const ICO_OUT = path.join(ROOT, 'favicon.ico');
const ROOT_PNG = path.join(ROOT, 'favicon.png');

// Renders the SVG at `size` and returns a PNG buffer.
async function renderPng(size) {
  return sharp(SRC, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 253, g: 251, b: 247, alpha: 1 } })
    .png()
    .toBuffer();
}

async function main() {
  const sizes = [16, 32, 48, 96, 180, 192, 512];
  const pngs = {};
  for (const size of sizes) {
    pngs[size] = await renderPng(size);
  }

  // Write PNGs
  fs.writeFileSync(path.join(OUT, 'favicon-96.png'), pngs[96]);
  fs.writeFileSync(path.join(OUT, 'favicon-192.png'), pngs[192]);
  fs.writeFileSync(path.join(OUT, 'favicon-512.png'), pngs[512]);
  fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), pngs[180]);
  fs.writeFileSync(path.join(OUT, 'favicon-48.png'), pngs[48]);
  fs.writeFileSync(path.join(OUT, 'favicon-32.png'), pngs[32]);
  fs.writeFileSync(path.join(OUT, 'favicon-16.png'), pngs[16]);
  fs.writeFileSync(ROOT_PNG, pngs[48]);

  // Build ICO (PNG-encoded entries)
  const iconSizes = [16, 32, 48];
  const entries = [];
  let offset = 6 + iconSizes.length * 16;
  for (const size of iconSizes) {
    const data = pngs[size];
    entries.push({ size, data, offset });
    offset += data.length;
  }
  const ico = Buffer.alloc(offset);
  ico.writeUInt16LE(0, 0);       // reserved
  ico.writeUInt16LE(1, 2);       // type: ICO
  ico.writeUInt16LE(iconSizes.length, 4);
  let dirOffset = 6;
  for (const e of entries) {
    const imgSize = e.size === 256 ? 0 : e.size;
    ico.writeUInt8(imgSize, dirOffset);      // width
    ico.writeUInt8(imgSize, dirOffset + 1);  // height
    ico.writeUInt8(0, dirOffset + 2);        // colors in palette
    ico.writeUInt8(0, dirOffset + 3);        // reserved
    ico.writeUInt16LE(1, dirOffset + 4);     // color planes
    ico.writeUInt16LE(32, dirOffset + 6);    // bits per pixel
    ico.writeUInt32LE(e.data.length, dirOffset + 8);  // bytes in res
    ico.writeUInt32LE(e.offset, dirOffset + 12);      // image offset
    dirOffset += 16;
  }
  for (const e of entries) {
    e.data.copy(ico, e.offset);
  }
  fs.writeFileSync(ICO_OUT, ico);

  console.log('Generated:');
  console.log('  favicon.ico            width=' + [...ico.slice(0, 6 + iconSizes.length * 16)].slice(6, 6 + 16).length + ' bytes ICO container, ' + iconSizes.join('/') + ' @ total ' + ico.length + ' bytes');
  console.log('  favicon.png            48x48, ' + pngs[48].length + ' bytes');
  console.log('  assets/img/favicon-48.png    ' + pngs[48].length + ' bytes');
  console.log('  assets/img/favicon-32.png    ' + pngs[32].length + ' bytes');
  console.log('  assets/img/favicon-16.png    ' + pngs[16].length + ' bytes');
  console.log('  assets/img/favicon-96.png    ' + pngs[96].length + ' bytes');
  console.log('  assets/img/favicon-192.png   ' + pngs[192].length + ' bytes');
  console.log('  assets/img/favicon-512.png   ' + pngs[512].length + ' bytes');
  console.log('  assets/img/apple-touch-icon.png ' + pngs[180].length + ' bytes');
  console.log('  features: square, opaque background (#FDFBF7), all logos inherit assets/img/logo.svg');
}

main().catch((e) => { console.error('favicon build failed:', e); process.exit(1); });
