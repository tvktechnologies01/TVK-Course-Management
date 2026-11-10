/**
 * Compact, self-contained QR Code generator for Node.js / TypeScript.
 * Generates ISO/IEC 18004 compliant QR Code Model 2 boolean matrices.
 * Zero external dependencies.
 */

// Galois Field GF(256) with primitive polynomial 0x11d (285)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  GF_LOG[0] = 0;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, GF_EXP[i]]);
  }
  return poly;
}

function rsCompute(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const lead = msg[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], lead);
      }
    }
  }
  return msg.slice(data.length);
}

// Version table for Byte mode with Medium error correction (Version 1 to 6)
interface QrVersionInfo {
  version: number;
  size: number;
  totalBytes: number;
  dataBytes: number;
  ecBytes: number;
  alignments: number[];
}

const QR_VERSIONS: QrVersionInfo[] = [
  { version: 1, size: 21, totalBytes: 26, dataBytes: 16, ecBytes: 10, alignments: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 28, ecBytes: 16, alignments: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 44, ecBytes: 26, alignments: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 64, ecBytes: 36, alignments: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 86, ecBytes: 48, alignments: [6, 30] },
  { version: 6, size: 41, totalBytes: 172, dataBytes: 108, ecBytes: 64, alignments: [6, 34] },
];

export function generateQrMatrix(text: string): boolean[][] {
  const dataBytes = Buffer.from(text, "utf8");
  const dataLen = dataBytes.length;

  // Find smallest version that fits data with 8-bit byte mode overhead (4 bits mode + 8 bits length)
  const requiredDataBytes = dataLen + 2; // ~12 bits overhead + terminator
  let vInfo = QR_VERSIONS[0];
  for (const v of QR_VERSIONS) {
    if (v.dataBytes >= requiredDataBytes) {
      vInfo = v;
      break;
    }
  }

  // Bitstream construction
  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // 1. Mode indicator: Byte mode = 0100 (4 bits)
  pushBits(0b0100, 4);
  // 2. Character count indicator: 8 bits for versions 1-9
  pushBits(dataLen, 8);
  // 3. Data bytes
  for (let i = 0; i < dataLen; i++) {
    pushBits(dataBytes[i], 8);
  }
  // 4. Terminator: up to 4 zero bits
  const bitCapacity = vInfo.dataBytes * 8;
  const termLen = Math.min(4, bitCapacity - bits.length);
  pushBits(0, termLen);
  // 5. Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  // 6. Pad bytes 0xEC, 0x11
  const pad = [0xec, 0x11];
  let pIdx = 0;
  while (bits.length < bitCapacity) {
    pushBits(pad[pIdx % 2], 8);
    pIdx++;
  }

  // Convert bits to byte array
  const rawData: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    rawData.push(byte);
  }

  // Compute Reed-Solomon Error Correction Code
  const ec = rsCompute(rawData, vInfo.ecBytes);
  const finalCodewords = [...rawData, ...ec];

  // Initialize Matrix
  const size = vInfo.size;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(r: number, c: number, val: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      isFunction[r][c] = true;
    }
  }

  // 1. Finder patterns (7x7 at top-left, top-right, bottom-left)
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setFunction(nr, nc, isBlack);
          } else {
            // 1-module white separator
            setFunction(nr, nc, false);
          }
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns (row 6 and col 6)
  for (let i = 8; i < size - 8; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // 3. Alignment patterns
  if (vInfo.alignments.length >= 2) {
    for (const r of vInfo.alignments) {
      for (const c of vInfo.alignments) {
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setFunction(r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // 4. Reserve Format Information Area
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunction(8, i, false);
      setFunction(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunction(8, size - 1 - i, false);
    setFunction(size - 1 - i, 8, false);
  }
  setFunction(size - 8, 8, true); // Dark module

  // 5. Data placement (zigzag from right to left in 2-column steps)
  let byteIndex = 0;
  let bitIndex = 7;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const r of rows) {
      for (let c = right; c >= right - 1; c--) {
        if (!isFunction[r][c]) {
          let bit = false;
          if (byteIndex < finalCodewords.length) {
            bit = ((finalCodewords[byteIndex] >> bitIndex) & 1) === 1;
            bitIndex--;
            if (bitIndex < 0) {
              bitIndex = 7;
              byteIndex++;
            }
          }
          // Standard mask pattern 000: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = bit !== mask;
        }
      }
    }
    upward = !upward;
  }

  // 6. Format Information (Medium Error Correction = 00, Mask 000 = 000 -> 00000)
  // Standard BCH format code for EC Medium + Mask 0 is 0x5412 ^ 0x5412 = 0x0000 XOR mask 0x5412 = 0x5412
  // Format code 15 bits: 101010000010010 (0x5412)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix;
}
