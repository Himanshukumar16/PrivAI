// Generates valid PNG icons (16x16, 48x48, 128x128) for PrivAI Chrome Extension
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = drawFn(x, y, width, height);
      buffer[idx] = color[0];     // R
      buffer[idx + 1] = color[1]; // G
      buffer[idx + 2] = color[2]; // B
      buffer[idx + 3] = color[3]; // A
    }
  }

  // PNG filter byte 0 (None) before each scanline
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // Filter: None
    buffer.copy(
      scanlines,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const idatData = zlib.deflateSync(scanlines);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Standard CRC32 calculation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// PrivAI Shield Drawing Function
function drawShield(x, y, w, h) {
  // Normalize coordinates to [0, 1]
  const nx = (x + 0.5) / w;
  const ny = (y + 0.5) / h;

  // Center is (0.5, 0.5)
  const dx = Math.abs(nx - 0.5);

  // Rounded shield shape boundaries
  let inShield = false;
  if (ny >= 0.12 && ny <= 0.55 && dx <= 0.38) {
    inShield = true;
  } else if (ny > 0.55 && ny <= 0.88) {
    const t = (ny - 0.55) / 0.33;
    const maxDx = 0.38 * (1 - Math.pow(t, 1.6));
    if (dx <= maxDx) {
      inShield = true;
    }
  }

  // Rounded top corners
  if (ny < 0.22 && dx > 0.28) {
    const cx = 0.28;
    const cy = 0.22;
    const dist = Math.hypot(dx - cx, ny - cy);
    if (dist > 0.10) inShield = false;
  }

  if (!inShield) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Inner keyhole / lock symbol
  const isKeyHoleCircle = Math.hypot(nx - 0.5, ny - 0.42) <= 0.10;
  const isKeyHoleBase = dx <= 0.05 && ny >= 0.42 && ny <= 0.62;
  if (isKeyHoleCircle || isKeyHoleBase) {
    // White/cyan core
    return [255, 255, 255, 255];
  }

  // Vibrant shield gradient: deep indigo (0x4f46e5) to vivid cyan (0x06b6d4)
  const grad = ny;
  const r = Math.round(99 * (1 - grad) + 6 * grad);
  const g = Math.round(102 * (1 - grad) + 182 * grad);
  const b = Math.round(241 * (1 - grad) + 212 * grad);

  return [r, g, b, 255];
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size, size, drawShield);
  fs.writeFileSync(path.join(assetsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});
