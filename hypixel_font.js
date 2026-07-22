const CACHE_PREFIX = "hypixelFont:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const HYPIXEL_PACK_BRANCH = "alpha/26.2";

function cacheRead(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheWrite(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, cachedAt: Date.now() }));
  } catch {
  }
}

async function cachedFetchJson(url) {
  const cached = cacheRead(url);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const json = await res.json();
    cacheWrite(url, json);
    return json;
  } catch (err) {
    if (cached) {
      console.warn(`hypixel_font: using stale cached data for ${url} (fetch failed: ${err.message})`);
      return cached.value;
    }
    throw err;
  }
}

async function fetchDirectory(branch, path) {
  return cachedFetchJson(`https://api.github.com/repos/meowdding/hypixel-pack/contents/${path}?ref=${encodeURIComponent(branch)}`);
}

const assetDirs = await fetchDirectory(HYPIXEL_PACK_BRANCH, "assets");
const fontDirs = [];
const fontFiles = [];

for (const assetDir of assetDirs) {
  const namespace = assetDir.name;
  const entries = await cachedFetchJson(assetDir.url);
  entries.forEach((entry) => {
    if (entry.name === "font") {
      fontDirs.push({ sha: entry.sha, path: entry.path, namespace: namespace });
    }
  });
}

for (const dir of fontDirs) {
  const files = await cachedFetchJson(`https://api.github.com/repos/meowdding/hypixel-pack/git/trees/${dir.sha}?recursive=true`);

  for (const file of files.tree) {
    fontFiles.push({ absolutePath: `${dir.path}/${file.path}`, namespace: dir.namespace, relative: file.path });
  }
}

export const FontMappings = {};

function parseNamespacedId(image) {
  const identifier = image.split(":");
  if (identifier.length == 2) {
    return { namespace: identifier[0], path: identifier[1] };
  }
  return { namespace: "minecraft", path: identifier[0] };
}

export function imageUrl(image) {
  const { namespace, path } = parseNamespacedId(image);
  return `https://raw.githubusercontent.com/meowdding/hypixel-pack/refs/heads/${HYPIXEL_PACK_BRANCH}/assets/${namespace}/textures/${path}`;
}

// im going to kill someone
const HYPIXEL_GLYPH_SCALE = 1.1;
const HYPIXEL_GLYPH_OFFSET_X = 0.54;
const HYPIXEL_GLYPH_OFFSET_Y = 0.2;
const HYPIXEL_GLYPH_SPACING = 1;

function bitmap(obj, resolveImage = imageUrl, overwrite = true, scale = 1, offsetX = 0, offsetY = 0, spacing = 0) {
  const ascent = obj.ascent;
  const height = obj.height ?? 8;
  const image = resolveImage(obj.file);
  const chars = obj.chars;

  const uvPerLine = 1.0 / chars.length;
  const uvPerColumn = 1.0 / decodeURI(chars[0]).length;

  let line = 0;
  for (const fontLine of chars) {
    let column = 0;
    for (const char of decodeURI(fontLine)) {
      if (char === "\u0000") continue;
      if (!overwrite && char in FontMappings) { column++; continue; }
      FontMappings[char] = {
        image: image,
        u0: column * uvPerColumn,
        u1: column * uvPerColumn + uvPerColumn,
        v0: line * uvPerLine,
        v1: line * uvPerLine + uvPerLine,
        height: height,
        ascent: ascent,
        scale: scale,
        xOffset: offsetX,
        yOffset: offsetY,
        spacing: spacing,
      };
      column++;
    }
    line++;
  }
}

const TypeHandlers = {
  bitmap: bitmap,
};

function loadFont(definition, scale = 1, offsetX = 0, offsetY = 0, spacing = 0) {
  const definitions = Array.isArray(definition) ? definition : [definition];

  for (const definition of definitions) {
    for (const provider of definition.providers) {
      TypeHandlers[provider.type]?.(provider, imageUrl, true, scale, offsetX, offsetY, spacing);
    }
  }
}

for (const file of fontFiles) {
  const fontId = `${file.namespace}:${file.relative.substring(0, file.relative.lastIndexOf("."))}`;
  if (fontId !== "minecraft:default") {
    continue;
  }
  const fontDef = await cachedFetchJson(`https://raw.githubusercontent.com/meowdding/hypixel-pack/refs/heads/${HYPIXEL_PACK_BRANCH}/` + file.absolutePath);
  loadFont(fontDef, HYPIXEL_GLYPH_SCALE, HYPIXEL_GLYPH_OFFSET_X, HYPIXEL_GLYPH_OFFSET_Y, HYPIXEL_GLYPH_SPACING);
}

const VANILLA_ASSETS_VERSION = "26.2";

function vanillaImageUrl(image) {
  const { namespace, path } = parseNamespacedId(image);
  return `https://assets.mcasset.cloud/${VANILLA_ASSETS_VERSION}/assets/${namespace}/textures/${path}`;
}

async function loadVanillaFallbackGlyphs(allowedFiles) {
  const fontDef = await cachedFetchJson(`https://assets.mcasset.cloud/${VANILLA_ASSETS_VERSION}/assets/minecraft/font/include/default.json`);

  for (const provider of fontDef.providers) {
    if (provider.type !== "bitmap") continue;
    if (allowedFiles && !allowedFiles.includes(provider.file)) continue;
    bitmap(provider, vanillaImageUrl, false, HYPIXEL_GLYPH_SCALE, HYPIXEL_GLYPH_OFFSET_X, HYPIXEL_GLYPH_OFFSET_Y);
  }
}

await loadVanillaFallbackGlyphs(["minecraft:font/nonlatin_european.png", "minecraft:font/accented.png"]);
import { unzipSync, strFromU8 } from "https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js";

const UNIFONT_ZIP_URL = `https://assets.mcasset.cloud/${VANILLA_ASSETS_VERSION}/assets/minecraft/font/unifont.zip`;

async function loadUnifontIndex() {
  const res = await fetch(UNIFONT_ZIP_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${UNIFONT_ZIP_URL}`);
  const zipBytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zipBytes, { filter: (f) => f.name.endsWith(".hex") });

  const index = new Map();
  for (const name of Object.keys(files)) {
    for (const line of strFromU8(files[name]).split("\n")) {
      const trimmed = line.trim();
      const sep = trimmed.indexOf(":");
      if (sep === -1) continue;
      const codepoint = parseInt(trimmed.slice(0, sep), 16);
      const hexBits = trimmed.slice(sep + 1);
      const width = hexBits.length === 32 ? 8 : hexBits.length === 64 ? 16 : null;
      if (!width || Number.isNaN(codepoint)) continue;
      index.set(codepoint, { width, hexBits });
    }
  }
  return index;
}

const unifontIndex = await loadUnifontIndex().catch((err) => {
  console.warn(`hypixel_font: GNU Unifont fallback unavailable (${err.message})`);
  return new Map();
});

function hexRowToBits(hexRow) {
  const value = parseInt(hexRow, 16);
  const bitCount = hexRow.length * 4;
  const bits = [];
  for (let i = bitCount - 1; i >= 0; i--) bits.push((value >> i) & 1);
  return bits;
}

function rasterizeUnifontGlyph({ width, hexBits }) {
  const charsPerRow = width === 8 ? 2 : 4;
  const rows = [];
  for (let r = 0; r < 16; r++) {
    rows.push(hexRowToBits(hexBits.slice(r * charsPerRow, r * charsPerRow + charsPerRow)));
  }

  let left = 0;
  let right = width - 1;
  const colHasInk = (c) => rows.some((row) => row[c]);
  while (left < width && !colHasInk(left)) left++;
  while (right > left && !colHasInk(right)) right--;
  if (left > right) { left = 0; right = width - 1; }

  let glyphWidth = right - left + 1;

  if (glyphWidth % 2 !== 0) {
    if (right < width - 1) {
      right++;
    } else if (left > 0) {
      left--;
    }
    glyphWidth = right - left + 1;
  }

  const canvas = document.createElement("canvas");
  canvas.width = glyphWidth;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(glyphWidth, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < glyphWidth; x++) {
      const i = (y * glyphWidth + x) * 4;
      imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = 255;
      imageData.data[i + 3] = rows[y][left + x] ? 255 : 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const displayScale = 0.5;
  const renderWidth = glyphWidth * displayScale;
  const spacing = 1;

  return {
    image: canvas.toDataURL("image/png"),
    u0: 0, u1: 1, v0: 0, v1: 1,
    height: 8,
    ascent: 7,
    pixelWidth: 9,
    pixelHeight: 9,
    advanceWidth: renderWidth + spacing,
    yOffset: 0.1,
  };
}

const unifontGlyphCache = new Map();

export function getUnifontGlyph(char) {
  const codepoint = char.codePointAt(0);

  if (codepoint <= 0x7f) return null;

  if (unifontGlyphCache.has(char)) return unifontGlyphCache.get(char);
  const entry = unifontIndex.get(codepoint);
  const glyph = entry ? rasterizeUnifontGlyph(entry) : null;
  unifontGlyphCache.set(char, glyph);
  return glyph;
}

export const ImageDimensions = {};

const PLEADING_FACE_CODEPOINT = 0x1f97a;
const PLEADING_FACE_URL = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${PLEADING_FACE_CODEPOINT.toString(16)}.png`;

let pleadingFaceGlyph = null;

export function getEmojiGlyph(char) {
  if (char !== String.fromCodePoint(PLEADING_FACE_CODEPOINT)) return null;
  if (pleadingFaceGlyph) return pleadingFaceGlyph;

  pleadingFaceGlyph = {
    image: PLEADING_FACE_URL,
    u0: 0, u1: 1, v0: 0, v1: 1,
    height: 8,
    ascent: 7,
    pixelWidth: 9,
    pixelHeight: 9,
    yOffset: 0,
    tint: false,
  };
  return pleadingFaceGlyph;
}

async function preloadImageDimensions() {
  const images = [...new Set(Object.values(FontMappings).map((m) => m.image))];

  await Promise.all(images.map(async (image) => {
    if (ImageDimensions[image]) return;
    const bitmap = await createImageBitmap(await (await fetch(image)).blob());
    ImageDimensions[image] = { width: bitmap.width, height: bitmap.height };
  }));

  for (const mapping of Object.values(FontMappings)) {
    const dims = ImageDimensions[mapping.image];
    const scale = mapping.scale ?? 1;
    mapping.pixelWidth = (mapping.u1 - mapping.u0) * dims.width * scale;
    mapping.pixelHeight = (mapping.v1 - mapping.v0) * dims.height * scale;
  }
}

await preloadImageDimensions();