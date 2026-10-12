import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = -1;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error("Truncated PNG chunk");

    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height) throw new Error("PNG IHDR missing");
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (![2, 6].includes(colorType)) throw new Error(`Unsupported PNG color type: ${colorType}`);
  if (interlace !== 0) throw new Error("Interlaced PNG is not supported");

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const expected = height * (stride + 1);
  if (raw.length !== expected) {
    throw new Error(`Unexpected PNG payload size: ${raw.length}, expected ${expected}`);
  }

  const recon = Buffer.alloc(height * stride);
  let src = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[src++];
      const a = x >= channels ? recon[rowStart + x - channels] : 0;
      const b = y > 0 ? recon[prevStart + x] : 0;
      const c = y > 0 && x >= channels ? recon[prevStart + x - channels] : 0;

      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = Math.floor((a + b) / 2);
      else if (filter === 4) predictor = paeth(a, b, c);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);

      recon[rowStart + x] = (value + predictor) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < recon.length; i += channels, j += 4) {
    rgba[j] = recon[i];
    rgba[j + 1] = recon[i + 1];
    rgba[j + 2] = recon[i + 2];
    rgba[j + 3] = channels === 4 ? recon[i + 3] : 255;
  }

  return { width, height, data: rgba };
}

export function encodePng(image) {
  const { width, height, data } = image;
  if (!(data instanceof Uint8Array) || data.length !== width * height * 4) {
    throw new Error("encodePng expects RGBA Uint8Array data");
  }

  const raw = Buffer.alloc(height * (1 + width * 4));
  let dst = 0;
  let src = 0;
  for (let y = 0; y < height; y++) {
    raw[dst++] = 0;
    for (let x = 0; x < width * 4; x++) raw[dst++] = data[src++];
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", deflateSync(raw)),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}
