/**
 * qr.js — a QR encoder small enough to keep in the tree.
 *
 * Scope is deliberately the smallest thing that draws a share link:
 * **byte mode**, **error correction level M**, **versions 1–6** (21×21 up to
 * 41×41, 106 bytes at level M). Every share URL this renders —
 * `https://app.trezzit.com/s/<22-char token>` and anything of that shape —
 * lands in version 3 or 4. Nothing here is general-purpose: there is no
 * numeric/alphanumeric/kanji mode, no ECI, no structured append, and no
 * version-information block (that starts at version 7, which this cannot
 * reach). A string that does not fit throws rather than silently truncating.
 *
 * Why hand-rolled: the app has no QR dependency and does not want one for a
 * single 40-line component. The algorithm is ISO/IEC 18004; the module
 * placement, mask and format-information conventions follow the reference
 * implementations exactly, and `__tests__/qr.test.js` pins the result against
 * a known matrix and against the structure the spec requires.
 *
 * Output is an SVG path, not a canvas or a grid of <rect>s: one <path> of
 * merged horizontal runs is a fraction of the nodes, scales to any size, and
 * takes its colour from `currentColor` so the code is ink on paper in both
 * the app's palette and the demo's.
 */

/* ── GF(256), the Reed–Solomon field: x^8 + x^4 + x^3 + x^2 + 1 ───────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Doubled so a log-sum never needs a modulo.
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** The degree-`n` generator polynomial, highest power first. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]; // × x
      next[j + 1] ^= gfMul(poly[j], EXP[i]); // × α^i
    }
    poly = next;
  }
  return poly;
}

/** The `ecLen` error-correction codewords for one block of data codewords. */
function rsRemainder(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const buf = new Uint8Array(data.length + ecLen);
  buf.set(data, 0);
  for (let i = 0; i < data.length; i += 1) {
    const factor = buf[i];
    if (factor === 0) continue;
    // gen[0] is 1, so this zeroes buf[i] as it goes.
    for (let j = 0; j < gen.length; j += 1) {
      buf[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return Array.from(buf.subarray(data.length));
}

/* ── The version table, level M only ──────────────────────────────────── */

/**
 * `data` is the total data codewords for the version; `blocks` is how many
 * Reed–Solomon blocks they are split across; `ec` is the EC codewords each
 * block carries. Level M happens to divide evenly at every version here —
 * no version 1–6 has the two-group layout the larger versions use — which is
 * why the interleave below is a plain round-robin.
 */
const VERSIONS = {
  1: { data: 16, blocks: 1, ec: 10 },
  2: { data: 28, blocks: 1, ec: 16 },
  3: { data: 44, blocks: 1, ec: 26 },
  4: { data: 64, blocks: 2, ec: 18 },
  5: { data: 86, blocks: 2, ec: 24 },
  6: { data: 108, blocks: 4, ec: 16 },
};

export const MIN_VERSION = 1;
export const MAX_VERSION = 6;

/** Level M's two format-info bits. */
const EC_FORMAT_BITS = 0b00;

/** Byte mode's header: 4 mode bits + an 8-bit count (versions 1–9). */
const HEADER_BITS = 4 + 8;

export function sizeForVersion(version) {
  return version * 4 + 17;
}

/** How many bytes a version holds in byte mode at level M. */
export function capacityForVersion(version) {
  return Math.floor((VERSIONS[version].data * 8 - HEADER_BITS) / 8);
}

/** UTF-8, because a share URL may carry one some day and it costs nothing. */
export function toUtf8Bytes(text) {
  if (typeof TextEncoder === 'function') {
    return Array.from(new TextEncoder().encode(text));
  }
  return Array.from(unescape(encodeURIComponent(text)), (c) => c.charCodeAt(0));
}

function chooseVersion(byteLength) {
  for (let v = MIN_VERSION; v <= MAX_VERSION; v += 1) {
    if (byteLength <= capacityForVersion(v)) return v;
  }
  throw new RangeError(
    `qr: ${byteLength} bytes does not fit in version ${MAX_VERSION} at error correction M ` +
      `(max ${capacityForVersion(MAX_VERSION)})`,
  );
}

/* ── Bit stream → interleaved codewords ───────────────────────────────── */

function buildCodewords(bytes, version) {
  const spec = VERSIONS[version];
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));

  const capacityBits = spec.data * 8;
  // Terminator: up to four zeroes, then out to a byte boundary.
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // The spec's pad pair, alternating until the block is full.
  const PAD = [0xec, 0x11];
  for (let i = 0; codewords.length < spec.data; i += 1) codewords.push(PAD[i % 2]);

  const perBlock = spec.data / spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  for (let b = 0; b < spec.blocks; b += 1) {
    const block = codewords.slice(b * perBlock, (b + 1) * perBlock);
    dataBlocks.push(block);
    ecBlocks.push(rsRemainder(block, spec.ec));
  }

  // Interleave: one codeword from each block in turn, data then EC.
  const out = [];
  for (let i = 0; i < perBlock; i += 1) dataBlocks.forEach((block) => out.push(block[i]));
  for (let i = 0; i < spec.ec; i += 1) ecBlocks.forEach((block) => out.push(block[i]));
  return out;
}

/* ── Function patterns ────────────────────────────────────────────────── */

function blankGrid(size, fill) {
  return Array.from({ length: size }, () => new Array(size).fill(fill));
}

/** Alignment-pattern centres. Versions 2–6 have exactly one, at (k, k). */
function alignmentCentres(version) {
  if (version === 1) return [];
  return [6, sizeForVersion(version) - 7];
}

function placeFunctionPatterns(version) {
  const size = sizeForVersion(version);
  const modules = blankGrid(size, false);
  const reserved = blankGrid(size, false);
  const set = (r, c, dark) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finders, plus the light separator ring around each.
  [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([fr, fc]) => {
    for (let i = -1; i <= 7; i += 1) {
      for (let j = -1; j <= 7; j += 1) {
        const inside = i >= 0 && i <= 6 && j >= 0 && j <= 6;
        const dark =
          inside &&
          (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
        set(fr + i, fc + j, dark);
      }
    }
  });

  // Timing: row 6 and column 6, alternating, dark on even indices.
  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment: the one that does not collide with a finder.
  const centres = alignmentCentres(version);
  centres.forEach((r) => {
    centres.forEach((c) => {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) return;
      for (let i = -2; i <= 2; i += 1) {
        for (let j = -2; j <= 2; j += 1) {
          set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
        }
      }
    });
  });

  // The always-dark module, and the format-information strips (filled later,
  // reserved now so the data placement steps over them).
  set(size - 8, 8, true);
  for (let i = 0; i <= 8; i += 1) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  return { size, modules, reserved };
}

/** The zigzag: two-module columns, right to left, skipping column 6. */
function placeCodewords(modules, reserved, size, codewords) {
  let bit = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is never data
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (reserved[r][c] || bit >= total) continue;
        modules[r][c] = ((codewords[bit >>> 3] >> (7 - (bit & 7))) & 1) === 1;
        bit += 1;
      }
    }
  }
  // Anything left over is a remainder bit: light, and already false.
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The four penalty rules, which only decide which mask reads best. */
function penalty(modules, size) {
  let score = 0;

  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1;
      } else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  const FINDERISH = ['10111010000', '00001011101'];
  const patternScore = (line) => {
    const s = line.map((d) => (d ? '1' : '0')).join('');
    let total = 0;
    FINDERISH.forEach((needle) => {
      let from = 0;
      for (;;) {
        const at = s.indexOf(needle, from);
        if (at === -1) break;
        total += 40;
        from = at + 1;
      }
    });
    return total;
  };

  let dark = 0;
  for (let r = 0; r < size; r += 1) {
    const row = modules[r];
    const col = modules.map((line) => line[r]);
    score += runScore(row) + runScore(col);
    score += patternScore(row) + patternScore(col);
    row.forEach((d) => {
      if (d) dark += 1;
    });
  }

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/** The 15-bit BCH format word for level M and the given mask. */
export function formatBits(mask) {
  const data = (EC_FORMAT_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function placeFormat(modules, size, mask) {
  const bits = formatBits(mask);
  const at = (i) => ((bits >> i) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) modules[i][8] = at(i);
  modules[7][8] = at(6);
  modules[8][8] = at(7);
  modules[8][7] = at(8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = at(i);

  for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = at(i);
  for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = at(i);

  modules[size - 8][8] = true; // the dark module is not a format bit
}

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Encode `text` as a QR symbol.
 *
 * `mask` forces one of the eight mask patterns instead of taking the one
 * with the lowest penalty. Nothing in the app passes it: the penalty rules
 * are a readability heuristic that implementations are allowed to differ on,
 * and pinning the mask is what lets the tests compare a whole symbol —
 * format bits included — against a reference implementation's output.
 *
 * @param {string} text
 * @param {{ mask?: number }} [options]
 * @returns {{ version: number, size: number, mask: number, modules: boolean[][] }}
 *   `modules[row][col]` is true for a dark module. No quiet zone — that is
 *   the renderer's business.
 */
export function encodeQr(text, { mask: forcedMask } = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('qr: nothing to encode');
  }
  const bytes = toUtf8Bytes(text);
  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const { size, modules, reserved } = placeFunctionPatterns(version);

  placeCodewords(modules, reserved, size, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    if (forcedMask !== undefined && mask !== forcedMask) continue;
    const candidate = modules.map((row, r) =>
      row.map((dark, c) => (reserved[r][c] ? dark : dark !== MASKS[mask](r, c))),
    );
    placeFormat(candidate, size, mask);
    const score = penalty(candidate, size);
    if (!best || score < best.score) best = { score, mask, modules: candidate };
  }
  if (!best) throw new RangeError(`qr: mask ${forcedMask} is not one of 0–7`);

  return { version, size, mask: best.mask, modules: best.modules };
}

/**
 * The same symbol as one SVG path, with the quiet zone folded into the
 * viewBox so the caller only has to pick a width.
 *
 * Dark modules are merged into horizontal runs — an `M x y h n v1 h-n z`
 * subpath each — which is a handful of hundred bytes rather than a thousand
 * <rect> nodes, and renders identically at any size.
 *
 * @param {string} text
 * @param {{ quietZone?: number, mask?: number }} [options]
 * @returns {{ d: string, extent: number, version: number, size: number, mask: number }}
 */
export function qrSvgPath(text, { quietZone = 4, mask } = {}) {
  const { modules, size, version, mask: used } = encodeQr(text, { mask });
  const parts = [];
  for (let r = 0; r < size; r += 1) {
    let c = 0;
    while (c < size) {
      if (!modules[r][c]) {
        c += 1;
        continue;
      }
      let run = 1;
      while (c + run < size && modules[r][c + run]) run += 1;
      parts.push(`M${c + quietZone} ${r + quietZone}h${run}v1h-${run}z`);
      c += run;
    }
  }
  return { d: parts.join(''), extent: size + quietZone * 2, version, size, mask: used };
}

export default qrSvgPath;
