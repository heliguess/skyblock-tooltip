import { FontMappings, ImageDimensions, getUnifontGlyph, getEmojiGlyph } from "./hypixel_font.js";

function getGlyphMapping(ch) {
  if (ch in FontMappings) return FontMappings[ch];
  const glyph = getEmojiGlyph(ch) ?? getUnifontGlyph(ch);
  if (glyph) FontMappings[ch] = glyph;
  return glyph;
}

const COLOR_CODES = {
  '0':'#000000','1':'#353FCE','2':'#00AA00','3':'#00AAAA',
  '4':'#D13228','5':'#A335EE','6':'#FF9000','7':'#A8BFD2',
  '8':'#707592','9':'#459bff','a':'#55FF55','b':'#55FFFF',
  'c':'#FF5555','d':'#FF55FF','e':'#FFDE2F','f':'#FFFFFF'
};

const FORMAT_FLAG_CODES = {
  bold: 'l', italic: 'o', underline: 'n', strikethrough: 'm', obfuscated: 'k'
};

const FORMAT_FLAG_ALIASES = {
  b: 'bold', i: 'italic', obfus: "obfuscated"
};
const FORMAT_CODES = Object.values(FORMAT_FLAG_CODES);

const TAG_COLOR_CODES = {
  black: '0', dark_blue: '1', dark_green: '2',
  dark_aqua: '3', dark_red: '4', dark_purple: '5', gold: '6',
  gray: '7', grey: '7', dark_gray: '8', dark_grey: '8', blue: '9',
  green: 'a', aqua: 'b', red: 'c', light_purple: 'd', pink: 'd',
  yellow: 'e', white: 'f'
};

function convertTagsToCodes(text){
  if (text.indexOf('<') === -1) return text;

  const tagRegex = /<\/?\s*([a-zA-Z_]+)([^<>]*)>/g;
  let out = '';
  let lastIndex = 0;
  let state = { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false };
  const stack = [];

  const emitSync = () => {
    out += state.color ? ('&' + state.color) : '&r';
    ['bold','italic','underline','strikethrough','obfuscated'].forEach(flag => {
      if (state[flag]) out += '&' + FORMAT_FLAG_CODES[flag];
    });
  };

  let match;
  while ((match = tagRegex.exec(text)) !== null){
    out += text.slice(lastIndex, match.index);
    lastIndex = tagRegex.lastIndex;

    const isClosing = match[0][1] === '/';
    const name = match[1].toLowerCase();

    if (name === 'reset'){
      if (!isClosing){
        stack.push(state);
        state = { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false };
      } else if (stack.length){
        state = stack.pop();
      } else {
        continue;
      }
      emitSync();
      continue;
    }

    if (name === 'color'){
      if (!isClosing){
        const hexMatch = match[2].match(/#?([0-9a-fA-F]{6})\b/);
        if (!hexMatch){
          out += match[0];
          continue;
        }
        stack.push(state);
        state = { ...state, color: '#' + hexMatch[1].toLowerCase() };
      } else if (stack.length){
        state = stack.pop();
      } else {
        continue;
      }
      emitSync();
      continue;
    }

    if (TAG_COLOR_CODES[name]){
      if (!isClosing){
        stack.push(state);
        state = { ...state, color: TAG_COLOR_CODES[name] };
      } else if (stack.length){
        state = stack.pop();
      } else {
        continue;
      }
      emitSync();
      continue;
    }

    const flagName = FORMAT_FLAG_ALIASES[name] || name;
    if (FORMAT_FLAG_CODES[flagName]){
      const flag = flagName;
      if (!isClosing){
        stack.push(state);
        state = { ...state, [flag]: true };
      } else if (stack.length){
        state = stack.pop();
      } else {
        continue;
      }
      emitSync();
      continue;
    }

    out += match[0];
  }
  out += text.slice(lastIndex);
  return out;
}

function hexToRgb(hex){
  hex = hex.replace('#','');
  return { r: parseInt(hex.substr(0,2),16), g: parseInt(hex.substr(2,2),16), b: parseInt(hex.substr(4,2),16) };
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function shadowColor(hex){
  const {r,g,b} = hexToRgb(hex);
  return rgbToHex(r/4, g/4, b/4);
}

const RARITIES = [
  { key:'COMMON', label:'COMMON', code:'f' },
  { key:'UNCOMMON', label:'UNCOMMON', code:'a' },
  { key:'RARE', label:'RARE', code:'9' },
  { key:'EPIC', label:'EPIC', code:'5' },
  { key:'LEGENDARY', label:'LEGENDARY', code:'6' },
  { key:'MYTHIC', label:'MYTHIC', code:'d' },
  { key:'SUPREME', label:'DIVINE', code:'b' },
  { key:'SPECIAL', label:'SPECIAL', code:'c' },
  { key:'VERY_SPECIAL', label:'VERY SPECIAL', code:'c' },
  { key:'ULTIMATE', label:'ULTIMATE', code:'4' },
  { key:'ADMIN', label:'ADMIN', code:'4' },
];

RARITIES.forEach(r => {
  r.color = COLOR_CODES[r.code];
});

let currentRarity = 'RARE';

const GLYPH_ATLAS_BASE_SIZE = 11;

const DEFAULT_LAYOUT_CONFIG = {
  fontSize: 11,
  lineHeight: 11,
  fontFamily: 'Minecraft',
  sourceBorderPx: 25,
  borderSize: 25,
  textGap: 2,
  titleGap: 2,
  padding: 12,
};

let LAYOUT_CONFIG = { ...DEFAULT_LAYOUT_CONFIG };

const builtinBackgrounds = {};
const builtinFrames = {};
const loadingRarities = {};

function loadImage(src){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadRarityAssets(rarityKey) {
  if (loadingRarities[rarityKey]) return loadingRarities[rarityKey];

  loadingRarities[rarityKey] = (async () => {
    const bgPath = `assets/${rarityKey.toLowerCase()}_background.png`;
    const framePath = `assets/${rarityKey.toLowerCase()}_frame.png`;

    const [bgImg, frameImg] = await Promise.all([
      loadImage(bgPath),
      loadImage(framePath)
    ]);

    builtinBackgrounds[rarityKey] = bgImg;
    builtinFrames[rarityKey] = frameImg;
  })();

  return loadingRarities[rarityKey];
}

function getBackgroundLayers(rarityKey){
  return {
    bg: builtinBackgrounds[rarityKey],
    frame: builtinFrames[rarityKey]
  };
}

const grid = document.getElementById('rarityGrid');
if (grid) {
  RARITIES.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'rarity-btn' + (r.key === currentRarity ? ' active' : '');
    btn.textContent = r.label;
    btn.style.borderColor = r.color;
    if (r.key === currentRarity) btn.style.background = r.color;
    btn.addEventListener('click', async () => {
      currentRarity = r.key;
      document.querySelectorAll('.rarity-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; });
      btn.classList.add('active');
      btn.style.background = r.color;
      
      render();
      await loadRarityAssets(currentRarity);
      render();
    });
    grid.appendChild(btn);
  });
}

function drawNineSlice(ctx, img, dx, dy, dw, dh, srcSlice, destSlice){
  const sw = img.width, sh = img.height;
  if (destSlice === undefined) destSlice = srcSlice;

  const s_x = Math.max(1, Math.min(srcSlice, Math.floor(sw / 2)));
  const s_y = Math.max(1, Math.min(srcSlice, Math.floor(sh / 2)));

  const d_s_x = Math.max(1, Math.min(destSlice, s_x, Math.floor(dw / 2)));
  const d_s_y = Math.max(1, Math.min(destSlice, s_y, Math.floor(dh / 2)));

  const srcMidW = sw - 2 * s_x, srcMidH = sh - 2 * s_y;
  const dstMidW = dw - 2 * d_s_x, dstMidH = dh - 2 * d_s_y;

  ctx.drawImage(img, 0, 0, s_x, s_y, dx, dy, d_s_x, d_s_y);
  ctx.drawImage(img, sw - s_x, 0, s_x, s_y, dx + dw - d_s_x, dy, d_s_x, d_s_y);
  ctx.drawImage(img, 0, sh - s_y, s_x, s_y, dx, dy + dh - d_s_y, d_s_x, d_s_y);
  ctx.drawImage(img, sw - s_x, sh - s_y, s_x, s_y, dx + dw - d_s_x, dy + dh - d_s_y, d_s_x, d_s_y);

  if (dstMidW > 0){
    ctx.drawImage(img, s_x, 0, srcMidW, s_y, dx + d_s_x, dy, dstMidW, d_s_y);
    ctx.drawImage(img, s_x, sh - s_y, srcMidW, s_y, dx + d_s_x, dy + dh - d_s_y, dstMidW, d_s_y);
  }
  if (dstMidH > 0){
    ctx.drawImage(img, 0, s_y, s_x, srcMidH, dx, dy + d_s_y, d_s_x, dstMidH);
    ctx.drawImage(img, sw - s_x, s_y, s_x, srcMidH, dx + dw - d_s_x, dy + d_s_y, d_s_x, dstMidH);
  }

  if (dstMidW > 0 && dstMidH > 0){
    ctx.drawImage(img, s_x, s_y, srcMidW, srcMidH, dx + d_s_x, dy + d_s_y, dstMidW, dstMidH);
  }
}

function parseFormatted(text, defaultColor){
  const segments = [];
  let color = defaultColor, bold=false, italic=false, underline=false, strikethrough=false, obfuscated=false;
  let buf = '';
  const flush = () => {
    if (buf.length) segments.push({ text: buf, color, bold, italic, underline, strikethrough, obfuscated });
    buf = '';
  };
  for (let i=0; i<text.length; i++){
    const ch = text[i];
    if (ch === '&' && i+1 < text.length){
      if (text[i+1] === '#' && /^[0-9a-fA-F]{6}$/.test(text.slice(i+2, i+8))){
        flush();
        color = '#' + text.slice(i+2, i+8).toLowerCase();
        bold=italic=underline=strikethrough=obfuscated=false;
        i += 7; continue;
      }
      const code = text[i+1].toLowerCase();
      if (COLOR_CODES[code]){
        flush();
        color = COLOR_CODES[code];
        bold=italic=underline=strikethrough=obfuscated=false;
        i++; continue;
      }
      if (code === 'r'){
        flush();
        color = defaultColor;
        bold=italic=underline=strikethrough=obfuscated=false;
        i++; continue;
      }
      if (FORMAT_CODES.includes(code)){
        flush();
        if (code==='l') bold = true;
        if (code==='o') italic = true;
        if (code==='n') underline = true;
        if (code==='m') strikethrough = true;
        if (code==='k') obfuscated = true;
        i++; continue;
      }
    }
    buf += ch;
  }
  flush();
  return segments;
}

let obfuscationTick = 0;

const OBF_CHARS = 'abcdeghnopqrsuwxyzABCDEFGHJKLMNOPQRSTUVWXYZ023456789#$&=m';

function obfuscate(str, seed = 0){
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === ' ') {
      out += ' ';
      continue;
    }
    
    const index = Math.abs(char.charCodeAt(0) * 31 + (obfuscationTick + i) * 17 + seed * 53) % OBF_CHARS.length;
    out += OBF_CHARS[index];
  }
  return out;
}

function getPreviewZoom(){
  const el = document.getElementById('previewZoom');
  return el ? parseFloat(el.value) : 1.5;
}

function fontFor(seg, config){
  return `${seg.italic ? 'italic ' : ''}${config.fontSize}px "${config.fontFamily}", Consolas, "Courier New", monospace`;
}

const BOLD_LETTER_SPACING = 0.9; 

function layoutSegment(ctx, display, bold, config) {
  const glyphScale = config.fontSize / GLYPH_ATLAS_BASE_SIZE;
  const offset = (bold ? BOLD_LETTER_SPACING : 0) * glyphScale;
  const chars = [];
  let w = 0;
  for (const ch of display){
    const mapping = getGlyphMapping(ch);
    const nativeWidth = mapping ? (mapping.advanceWidth ?? mapping.pixelWidth) : undefined;
    const cw = nativeWidth !== undefined ? nativeWidth * glyphScale : ctx.measureText(ch).width;
    const extraSpacing = mapping ? (mapping.spacing ?? 0) * glyphScale : 0;
    chars.push({ ch, x: w, w: cw });
    w += cw + extraSpacing + offset;
  }
  if (chars.length) w -= offset; 
  w += (bold ? 1 : 0) * glyphScale; 
  return { chars, width: w };
}

function measureLine(ctx, segments, config, lineIdx = 0){
  let w = 0;
  segments.forEach((seg, segIdx) => {
    ctx.font = fontFor(seg, config);
    const seed = lineIdx * 1000 + segIdx;
    const display = seg.obfuscated ? obfuscate(seg.text, seed) : seg.text;
    w += layoutSegment(ctx, display, seg.bold, config).width;
  });
  return w;
}

const BitmapCache = {};

async function getOrCreateBitmap(image) {
  if (image in BitmapCache) {
    return BitmapCache[image];
  }

  const bitmap = await window.createImageBitmap(await (await fetch(image)).blob())
  BitmapCache[image] = bitmap;
  if (!ImageDimensions[image]) {
    ImageDimensions[image] = { width: bitmap.width, height: bitmap.height };
  }
  return bitmap;
}

const ColorizeCache = new WeakMap();
const GlyphTileCache = new WeakMap();

const colorize = (image, r, g, b) => {
  let cacheForImage = ColorizeCache.get(image);
  if (!cacheForImage) {
    cacheForImage = new Map();
    ColorizeCache.set(image, cacheForImage);
  }

  const key = r + ',' + g + ',' + b;
  const cached = cacheForImage.get(key);
  if (cached) return cached;

  const offscreen = new OffscreenCanvas(image.width, image.height);
  const ctx = offscreen.getContext("2d");

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, image.width, image.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i + 0] *= r;
    imageData.data[i + 1] *= g;
    imageData.data[i + 2] *= b;
  }

  ctx.putImageData(imageData, 0, 0);

  cacheForImage.set(key, offscreen);
  return offscreen;
}

async function drawChar(ctx, ch, x, y, config, shadowOnly) {
  const fontMapping = getGlyphMapping(ch);
  if (fontMapping) {
    if (shadowOnly && fontMapping.tint === false) return;
    const glyphScale = config.fontSize / GLYPH_ATLAS_BASE_SIZE;
    const rawBitmap = await getOrCreateBitmap(fontMapping.image);
    let bitmap = rawBitmap;
    if (fontMapping.tint !== false) {
      const color = hexToRgb(ctx.fillStyle);
      bitmap = colorize(rawBitmap, color.r / 255., color.g / 255., color.b / 255.);
    }
    const width = bitmap.width;
    const height = bitmap.height;

    const sx = Math.floor(fontMapping.u0 * width);
    const sy = Math.floor(fontMapping.v0 * height);
    const sw = Math.max(1, Math.round((fontMapping.u1 - fontMapping.u0) * width));
    const sh = Math.max(1, Math.round((fontMapping.v1 - fontMapping.v0) * height));

    const renderWidth = (fontMapping.pixelWidth ?? sw) * glyphScale;
    const renderHeight = (fontMapping.pixelHeight ?? fontMapping.height ?? sh) * glyphScale;
    const xOffset = (fontMapping.xOffset ?? 0) * glyphScale;
    const yOffset = (fontMapping.yOffset ?? 0) * glyphScale;
    const ascentShift = ((fontMapping.ascent ?? 7) - 7) * glyphScale;

    const dx = x + xOffset;
    const dy = y + 2 * glyphScale + yOffset - ascentShift;

    let tileCacheForBitmap = GlyphTileCache.get(bitmap);
    if (!tileCacheForBitmap) {
      tileCacheForBitmap = new Map();
      GlyphTileCache.set(bitmap, tileCacheForBitmap);
    }
    const tileKey = sx + ',' + sy + ',' + sw + ',' + sh;
    let tile = tileCacheForBitmap.get(tileKey);
    if (!tile) {
      tile = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(sw, sh)
        : document.createElement('canvas');
      if (tile instanceof HTMLCanvasElement) {
        tile.width = sw;
        tile.height = sh;
      }
      const tileCtx = tile.getContext('2d');
      tileCtx.imageSmoothingEnabled = false;
      tileCtx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
      tileCacheForBitmap.set(tileKey, tile);
    }

    ctx.drawImage(
      tile,
      0, 0, sw, sh,
      dx, dy, renderWidth, renderHeight
    );
    return;
  }
  
  ctx.fillText(ch, x, y);
}

async function drawLine(ctx, segments, x, y, shadowOnly, config, lineIdx = 0){
  let cx = x;
  for (const [segIdx, seg] of segments.entries()) {
    ctx.font = fontFor(seg, config);
    const seed = lineIdx * 1000 + segIdx;
    const display = seg.obfuscated ? obfuscate(seg.text, seed) : seg.text;
    const layout = layoutSegment(ctx, display, seg.bold, config);
    ctx.fillStyle = shadowOnly ? shadowColor(seg.color) : seg.color;
    const dx = shadowOnly ? cx + 1 : cx;
    const dy = shadowOnly ? y + 1 : y;

    for (const { ch, x: chx } of layout.chars) {
      await drawChar(ctx, ch, dx + chx, dy, config, shadowOnly);
      if (seg.bold) {
        await drawChar(ctx, ch, dx + chx + 1, dy, config, shadowOnly);
      }
    }

    if (seg.underline || seg.strikethrough){
      const ly = seg.underline ? dy + config.fontSize*0.85 : dy + config.fontSize*0.45;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dx, ly);
      ctx.lineTo(dx + layout.width, ly);
      ctx.stroke();
    }
    cx += layout.width;
  }
}

const canvas = document.getElementById('tooltipCanvas');
const ctx = canvas.getContext('2d');
canvas.style.imageRendering = 'pixelated';

function computeTooltipModel(){
  const config = { ...LAYOUT_CONFIG, previewZoom: getPreviewZoom() };
  const rarity = RARITIES.find(r => r.key === currentRarity);
  const nameSegs = parseFormatted(convertTagsToCodes(document.getElementById('itemName').value), rarity.color);
  let loreRaw = document.getElementById('loreText').value.split('\n').map(convertTagsToCodes);
  const autoWrap = document.getElementById('autoWrapLore')?.checked;
  if (autoWrap) {
    loreRaw = loreRaw.flatMap(line => wrapLine(line, 35));
  }
  const loreSegs = loreRaw.map(line => parseFormatted(line, '#AAAAAA'));
  const showFooter = document.getElementById('showFooter').checked;
  const isRecombobulated = document.getElementById('isRecombobulated').checked;
  const itemType = document.getElementById('itemType').value.trim();

  let footerText = itemType 
    ? `&${rarity.code}&l${rarity.label} ${itemType}` 
    : `&${rarity.code}&l${rarity.label}`;

    if (isRecombobulated) {
      footerText = `&${rarity.code}&l&ka&${rarity.code}&l ${rarity.label}${itemType ? ' ' + itemType : ''} &${rarity.code}&l&ka`;
    }
    
  const allLines = [nameSegs, ...loreSegs];
  if (showFooter){
    allLines.push(parseFormatted(footerText, rarity.color));
  }

  let maxWidth = 0; 
  ctx.font = `${config.fontSize}px "${config.fontFamily}"`;
  allLines.forEach((segs, lineIdx) => { 
    maxWidth = Math.max(maxWidth, measureLine(ctx, segs, config, lineIdx)); 
  });

  const contentWidth = Math.max(maxWidth, 40);
  
  let contentHeight = 0;
  if (allLines.length > 0) {
    contentHeight = (allLines.length - 1) * config.lineHeight + config.fontSize;
    if (allLines.length > 1) {
      contentHeight += config.titleGap;
    }
  }

  const vOffset = 2;

  const cw = Math.ceil(contentWidth + config.padding * 2);
  const ch = Math.ceil(contentHeight + config.padding * 2 - vOffset);

  return { config, rarity, allLines, cw, ch, vOffset, contentHeight };
}

async function drawTooltip(targetCtx, model, scale){
  const { config, rarity, allLines, cw, ch, vOffset, contentHeight } = model;

  targetCtx.setTransform(scale, 0, 0, scale, 0, 0);
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.clearRect(0,0,cw,ch);

  const { bg, frame } = getBackgroundLayers(currentRarity);
  if (bg) {
    drawNineSlice(targetCtx, bg, 0, 0, cw, ch, config.sourceBorderPx, config.borderSize);
  }
  if (frame) {
    drawNineSlice(targetCtx, frame, 0, 0, cw, ch, config.sourceBorderPx, config.borderSize);
  }

  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(config.padding, config.padding - vOffset, cw - config.padding * 2, contentHeight);
  targetCtx.clip();

  targetCtx.textBaseline = 'top';
  
  let y = config.padding - vOffset;
  for (let idx = 0; idx < allLines.length; idx++) {
    const segs = allLines[idx];
    await drawLine(targetCtx, segs, config.padding, y, true, config, idx);
    await drawLine(targetCtx, segs, config.padding, y, false, config, idx);
    y += config.lineHeight;
    
    if (idx === 0 && allLines.length > 1) {
      y += config.titleGap;
    }
  }
  targetCtx.restore();
}
let lastCw = 0, lastCh = 0, lastScale = 0, lastZoom = 0;

let previewRenderInFlight = false;
let previewRenderQueued = null;

async function runPreviewRender(model, previewScale) {
  if (previewRenderInFlight) {
    previewRenderQueued = { model, previewScale };
    return;
  }
  previewRenderInFlight = true;
  try {
    await drawTooltip(ctx, model, previewScale);
  } finally {
    previewRenderInFlight = false;
  }
  if (previewRenderQueued) {
    const next = previewRenderQueued;
    previewRenderQueued = null;
    runPreviewRender(next.model, next.previewScale);
  }
}

function renderWithModel(model){
  const { config, cw, ch } = model;

  const dpr = window.devicePixelRatio || 1;
  const previewScale = Math.ceil(Math.max(1, config.previewZoom * dpr));

  const sizeChanged = (cw !== lastCw || ch !== lastCh);
  const scaleChanged = (previewScale !== lastScale);
  const zoomChanged = (config.previewZoom !== lastZoom);
  
  if (sizeChanged || scaleChanged) {
    canvas.width = cw * previewScale;
    canvas.height = ch * previewScale;
    lastCw = cw;
    lastCh = ch;
    lastScale = previewScale;
  }

  if (sizeChanged || zoomChanged) {
    canvas.style.width = (cw * config.previewZoom) + 'px';
    canvas.style.height = (ch * config.previewZoom) + 'px';
    lastZoom = config.previewZoom;
  }

  runPreviewRender(model, previewScale);
}

function updateAnimationButtonsVisibility(model) {
  if (!model) return;
  
  const isRecombobulated = document.getElementById('isRecombobulated')?.checked;
  const hasObfuscated = model.allLines.some(line => line.some(seg => seg.obfuscated));
  
  const animGroup = document.getElementById('animationButtons');
  if (animGroup) {
    animGroup.style.display = (isRecombobulated || hasObfuscated) ? 'flex' : 'none';
  }
}

function render(){
  const model = computeTooltipModel();
  renderWithModel(model);
  updateAnimationButtonsVisibility(model);
}

function populateConfigInputs() {
  document.getElementById('cfgFontSize').value = LAYOUT_CONFIG.fontSize;
  document.getElementById('cfgLineHeight').value = LAYOUT_CONFIG.lineHeight;
  document.getElementById('cfgSourceBorderPx').value = LAYOUT_CONFIG.sourceBorderPx;
  document.getElementById('cfgTextGap').value = LAYOUT_CONFIG.textGap;
  document.getElementById('cfgTitleGap').value = LAYOUT_CONFIG.titleGap;
  document.getElementById('cfgPadding').value = LAYOUT_CONFIG.padding;
  document.getElementById('cfgFontFamily').value = LAYOUT_CONFIG.fontFamily;
}

const configInputs = [
  { id: 'cfgFontSize', key: 'fontSize', type: 'int' },
  { id: 'cfgLineHeight', key: 'lineHeight', type: 'int' },
  { id: 'cfgSourceBorderPx', key: 'sourceBorderPx', type: 'int' },
  { id: 'cfgTextGap', key: 'textGap', type: 'int' },
  { id: 'cfgTitleGap', key: 'titleGap', type: 'int' },
  { id: 'cfgPadding', key: 'padding', type: 'int' },
  { id: 'cfgFontFamily', key: 'fontFamily', type: 'string' }
];

configInputs.forEach(({ id, key, type }) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      let val = el.value;
      if (type === 'int') {
        val = parseInt(val, 10);
        if (isNaN(val)) return;
      }
      LAYOUT_CONFIG[key] = val;
      render();
    });
  }
});

const cogBtn = document.getElementById('cogBtn');
const configPanel = document.getElementById('configPanel');
const closeConfigBtn = document.getElementById('closeConfigBtn');
const colorsBtn = document.getElementById('colorsBtn');
const colorsPanel = document.getElementById('colorsPanel');
const closeColorsBtn = document.getElementById('closeColorsBtn');

if (cogBtn && configPanel) {
  cogBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (colorsPanel) colorsPanel.classList.remove('show');
    configPanel.classList.toggle('show');
  });

  configPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

if (colorsBtn && colorsPanel) {
  colorsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (configPanel) configPanel.classList.remove('show');
    colorsPanel.classList.toggle('show');
  });

  colorsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

document.addEventListener('click', () => {
  if (configPanel) configPanel.classList.remove('show');
  if (colorsPanel) colorsPanel.classList.remove('show');
});

if (closeConfigBtn && configPanel) {
  closeConfigBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    configPanel.classList.remove('show');
  });
}

if (closeColorsBtn && colorsPanel) {
  closeColorsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    colorsPanel.classList.remove('show');
  });
}

const obfuscatedPreviewEl = document.getElementById('obfuscatedPreview');
if (obfuscatedPreviewEl && colorsPanel) {
  const obfPreviewOriginalText = obfuscatedPreviewEl.textContent;
  let obfPreviewInterval = null;
  let obfPreviewTick = 0;

  const startObfPreview = () => {
    if (obfPreviewInterval) return;
    obfPreviewInterval = setInterval(() => {
      obfPreviewTick++;
      obfuscatedPreviewEl.textContent = obfuscate(obfPreviewOriginalText, obfPreviewTick);
    }, 50);
  };
  const stopObfPreview = () => {
    if (obfPreviewInterval) {
      clearInterval(obfPreviewInterval);
      obfPreviewInterval = null;
    }
    obfuscatedPreviewEl.textContent = obfPreviewOriginalText;
  };

  new MutationObserver(() => {
    if (colorsPanel.classList.contains('show')) startObfPreview();
    else stopObfPreview();
  }).observe(colorsPanel, { attributes: true, attributeFilter: ['class'] });
}

const resetConfigBtn = document.getElementById('resetConfigBtn');
if (resetConfigBtn) {
  resetConfigBtn.addEventListener('click', () => {
    LAYOUT_CONFIG = { ...DEFAULT_LAYOUT_CONFIG };
    populateConfigInputs();
    render();
  });
}

function updateSliderDisplays() {
  const slider = document.getElementById('previewZoom');
  const valDisplay = document.getElementById('previewZoomVal');
  if (slider && valDisplay) valDisplay.textContent = slider.value + 'x';
}

const wireInputIds = [
  'itemName', 'itemType', 'loreText', 'showFooter', 'isRecombobulated', 'autoWrapLore', 'pixelScale', 'previewZoom'
];

wireInputIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    const handler = () => {
      updateSliderDisplays();
      render();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const model = computeTooltipModel();
  const { cw, ch } = model;
  const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = cw * pixelScale;
  exportCanvas.height = ch * pixelScale;
  const exportCtx = exportCanvas.getContext('2d');

  await drawTooltip(exportCtx, model, pixelScale);

  const link = document.createElement('a');
  const timestamp = Date.now();
  link.download = `tooltip-${currentRarity.toLowerCase()}-${timestamp}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
});

document.getElementById('downloadStaticWebpBtn').addEventListener('click', async () => {
  const model = computeTooltipModel();
  const { cw, ch } = model;
  const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = cw * pixelScale;
  exportCanvas.height = ch * pixelScale;
  const exportCtx = exportCanvas.getContext('2d');
  await drawTooltip(exportCtx, model, pixelScale);

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      alert("WebP Export Failed: your browser may not support WebP encoding.");
      return;
    }
    const link = document.createElement('a');
    const timestamp = Date.now();
    link.download = `tooltip-${currentRarity.toLowerCase()}-${timestamp}.webp`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, 'image/webp', 0.92);
});

document.getElementById('downloadGifBtn').addEventListener('click', async () => {
  const btn = document.getElementById('downloadGifBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Encoding...';
  btn.disabled = true;

  const model = computeTooltipModel();
  const { cw, ch } = model;
  const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);
  const width = cw * pixelScale;
  const height = ch * pixelScale;

  const numFrames = 30;
  const frames = [];

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');

  const originalTick = obfuscationTick;

  for (let f = 0; f < numFrames; f++) {
    obfuscationTick++;
    tempCtx.clearRect(0, 0, width, height);
    await drawTooltip(tempCtx, model, pixelScale);
    frames.push(tempCanvas.toDataURL('image/png'));
  }

  obfuscationTick = originalTick;

  gifshot.createGIF({
    images: frames,
    gifWidth: width,
    gifHeight: height,
    interval: 0.05,
    numFrames: numFrames,
    sampleInterval: 5,
  }, function (obj) {
    btn.textContent = originalText;
    btn.disabled = false;

    if (!obj.error) {
      const link = document.createElement('a');
      const timestamp = Date.now();
      link.download = `tooltip-${currentRarity.toLowerCase()}-${timestamp}.gif`;
      link.href = obj.image;
      link.click();
    } else {
      alert("GIF Export Failed: " + obj.errorMsg);
    }
  });
});

document.getElementById('downloadApngBtn').addEventListener('click', async () => {
  const btn = document.getElementById('downloadApngBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Encoding APNG...';
  btn.disabled = true;

  setTimeout( async () => {
    try {
      const model = computeTooltipModel();
      const { cw, ch } = model;
      const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);
      const width = cw * pixelScale;
      const height = ch * pixelScale;

      const numFrames = 30;
      const frames = [];
      const delays = [];

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');

      const originalTick = obfuscationTick;

      for (let f = 0; f < numFrames; f++) {
        obfuscationTick++;
        tempCtx.clearRect(0, 0, width, height);
        await drawTooltip(tempCtx, model, pixelScale);
        
        const imgData = tempCtx.getImageData(0, 0, width, height);
        const bufferCopy = new Uint8Array(imgData.data).buffer;
        frames.push(bufferCopy);
        delays.push(50);
      }

      obfuscationTick = originalTick;

      const disps = new Array(numFrames).fill(1); 
      const blends = new Array(numFrames).fill(0); 

      const apngBuffer = UPNG.encodeLL(frames, width, height, 3, 1, 8, delays, disps, blends, 0);
      const blob = new Blob([apngBuffer], { type: 'image/png' });

      const link = document.createElement('a');
      const timestamp = Date.now();
      link.download = `tooltip-${currentRarity.toLowerCase()}-${timestamp}.apng`;
      link.href = URL.createObjectURL(blob);
      link.click();
    } catch (err) {
      console.error(err);
      alert("APNG Export Failed: " + err.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }, 50);
});

let webpXMuxInstance = null;
function getWebpXMux() {
  if (!webpXMuxInstance) {
    webpXMuxInstance = WebPXMux('https://cdn.jsdelivr.net/npm/webpxmux/dist/webpxmux.wasm');
  }
  return webpXMuxInstance;
}

function imageDataToPackedRgba(imgData) {
  const { data, width, height } = imgData;
  const pixelCount = width * height;
  const packed = new Uint32Array(pixelCount);
  for (let i = 0, p = 0; p < pixelCount; i += 4, p++) {
    packed[p] = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
  }
  return packed;
}

document.getElementById('downloadWebpBtn').addEventListener('click', async () => {
  const btn = document.getElementById('downloadWebpBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Encoding WebP...';
  btn.disabled = true;

  try {
    const model = computeTooltipModel();
    const { cw, ch } = model;
    const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);
    const width = cw * pixelScale;
    const height = ch * pixelScale;

    const numFrames = 30;
    const delayMs = 50;
    const frames = [];

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    const originalTick = obfuscationTick;

    for (let f = 0; f < numFrames; f++) {
      obfuscationTick++;
      tempCtx.clearRect(0, 0, width, height);
      await drawTooltip(tempCtx, model, pixelScale);

      const imgData = tempCtx.getImageData(0, 0, width, height);
      frames.push({
        duration: delayMs,
        isKeyframe: false,
        rgba: imageDataToPackedRgba(imgData)
      });
    }

    obfuscationTick = originalTick;

    const xMux = getWebpXMux();
    await xMux.waitRuntime();

    const animatedWebpBytes = await xMux.encodeFrames({
      frameCount: numFrames,
      width,
      height,
      loopCount: 0,
      bgColor: 0x00000000,
      frames
    });

    const blob = new Blob([animatedWebpBytes], { type: 'image/webp' });

    const link = document.createElement('a');
    const timestamp = Date.now();
    link.download = `tooltip-${currentRarity.toLowerCase()}-${timestamp}.webp`;
    link.href = URL.createObjectURL(blob);
    link.click();
  } catch (err) {
    console.error(err);
    alert("Animated WebP Export Failed: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

function wrapLine(line, maxLen = 35) {
  if (line.length === 0) {
    return [''];
  }

  const words = line.split(' ');
  const wrappedLines = [];
  let currentLine = '';
  let currentLineCleanLength = 0;
  
  const formatRegex = /&(?:#[0-9a-f]{6}|[0-9a-fk-or])/gi;
  let activeFormatting = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.replace(formatRegex, '');
    
    const matches = word.match(formatRegex);
    if (matches) {
      matches.forEach(code => {
        if (code.toLowerCase() === '&r') {
          activeFormatting = ''; 
        } else {
          if (code[1] === '#' || /[0-9a-f]/i.test(code[1])) {
            activeFormatting = code;
          } else {
            activeFormatting += code;
          }
        }
      });
    }

    const spaceAddition = currentLineCleanLength > 0 ? 1 : 0;
    
    if (currentLineCleanLength + spaceAddition + cleanWord.length > maxLen && currentLineCleanLength > 0) {
      wrappedLines.push(currentLine);
      currentLine = activeFormatting + word;
      currentLineCleanLength = cleanWord.length;
    } else {
      if (currentLineCleanLength === 0) {
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
      currentLineCleanLength += spaceAddition + cleanWord.length;
    }
  }
  
  if (currentLine) {
    wrappedLines.push(currentLine);
  }
  
  return wrappedLines;
}

let hasWarnedScale = false;

function scaleWarning() {
  if (hasWarnedScale) return;
  const isRecombobulatedEl = document.getElementById('isRecombobulated');
  const pixelScaleEl = document.getElementById('pixelScale');
  
  if (isRecombobulatedEl && pixelScaleEl) {
    const isRecombobulated = isRecombobulatedEl.checked;
    const pixelScale = parseInt(pixelScaleEl.value, 10);
    
    if (isRecombobulated && pixelScale > 4) {
      hasWarnedScale = true;
      alert("Warning: Exporting animated tooltips as GIF or APNG at resolutions above 4x may freeze or even crash your browser.");
    }
  }
}

wireInputIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    const handler = () => {
      if (id === 'isRecombobulated' || id === 'pixelScale') {
        scaleWarning();
      }
      updateSliderDisplays();
      render();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }
});

let lastAnimateTime = 0;

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (timestamp - lastAnimateTime < 20) return;
  lastAnimateTime = timestamp;

  const model = computeTooltipModel();
  const hasObfuscated = model.allLines.some(line => line.some(seg => seg.obfuscated));
  if (hasObfuscated) {
    obfuscationTick++;
    renderWithModel(model);
  }
}

function flattenComponent(comp, parentState = { color: null, bold: false, italic: false, underlined: false, strikethrough: false, obfuscated: false }) {
  if (comp === null || comp === undefined) return [];

  if (Array.isArray(comp)) {
    let segments = [];
    comp.forEach(child => {
      segments = segments.concat(flattenComponent(child, parentState));
    });
    return segments;
  }

  let state = { ...parentState };
  if (typeof comp === 'object') {
    if (comp.color !== undefined) state.color = comp.color;
    if (comp.bold !== undefined) state.bold = comp.bold;
    if (comp.italic !== undefined) state.italic = comp.italic;
    if (comp.underlined !== undefined) state.underlined = comp.underlined;
    if (comp.strikethrough !== undefined) state.strikethrough = comp.strikethrough;
    if (comp.obfuscated !== undefined) state.obfuscated = comp.obfuscated;
  }

  let segments = [];
  if (typeof comp === 'string' || typeof comp === 'number' || typeof comp === 'boolean') {
    segments.push({ text: String(comp), state: { ...state } });
  } else if (typeof comp === 'object') {
    if (comp.text !== undefined && comp.text !== null) {
      segments.push({ text: String(comp.text), state: { ...state } });
    }
    if (Array.isArray(comp.extra)) {
      comp.extra.forEach(child => {
        segments = segments.concat(flattenComponent(child, state));
      });
    }
  }
  return segments;
}

function segmentsToAmpersandString(segments) {
  const mcColorToCode = {
    'black': '0', 'dark_blue': '1', 'dark_green': '2', 'dark_aqua': '3',
    'dark_red': '4', 'dark_purple': '5', 'gold': '6', 'gray': '7',
    'dark_gray': '8', 'blue': '9', 'green': 'a', 'aqua': 'b',
    'red': 'c', 'light_purple': 'd', 'yellow': 'e', 'white': 'f'
  };

  let out = '';
  segments.forEach(seg => {
    if (!seg.text) return;
    let prefix = '';
    if (seg.state.color && mcColorToCode[seg.state.color]) {
      prefix += '&' + mcColorToCode[seg.state.color];
    }
    if (seg.state.bold) prefix += '&l';
    if (seg.state.italic) prefix += '&o';
    if (seg.state.underlined) prefix += '&n';
    if (seg.state.strikethrough) prefix += '&m';
    if (seg.state.obfuscated) prefix += '&k';
    
    out += prefix + seg.text.replace(/§/g, '&');
  });
  return out;
}

function parseSNBT(str) {
  let i = 0;
  const n = str.length;

  const skipWs = () => { while (i < n && /\s/.test(str[i])) i++; };

  function parseValue() {
    skipWs();
    const ch = str[i];
    if (ch === '{') return parseCompound();
    if (ch === '[') return parseList();
    if (ch === '"' || ch === "'") return parseQuoted();
    return parseBare();
  }

  function parseCompound() {
    i++;
    const obj = {};
    skipWs();
    if (str[i] === '}') { i++; return obj; }
    while (true) {
      skipWs();
      const key = parseKey();
      skipWs();
      if (str[i] !== ':') throw new Error(`Expected ':' at position ${i}`);
      i++;
      obj[key] = parseValue();
      skipWs();
      if (str[i] === ',') { i++; continue; }
      if (str[i] === '}') { i++; break; }
      throw new Error(`Expected ',' or '}' at position ${i}`);
    }
    return obj;
  }

  function parseKey() {
    skipWs();
    if (str[i] === '"' || str[i] === "'") return parseQuoted();
    const start = i;
    while (i < n && !/[\s:,}\]]/.test(str[i])) i++;
    if (i === start) throw new Error(`Expected key at position ${i}`);
    return str.slice(start, i);
  }

  function parseList() {
    i++;
    skipWs();
    if (/^[BILbil];/.test(str.slice(i, i + 2))) i += 2;
    const arr = [];
    skipWs();
    if (str[i] === ']') { i++; return arr; }
    while (true) {
      arr.push(parseValue());
      skipWs();
      if (str[i] === ',') { i++; skipWs(); continue; }
      if (str[i] === ']') { i++; break; }
      throw new Error(`Expected ',' or ']' at position ${i}`);
    }
    return arr;
  }

  function parseQuoted() {
    const quote = str[i];
    i++;
    let out = '';
    while (i < n && str[i] !== quote) {
      if (str[i] === '\\' && i + 1 < n) {
        if (str[i + 1] === 'u' && /^[0-9a-fA-F]{4}$/.test(str.slice(i + 2, i + 6))) {
          out += String.fromCharCode(parseInt(str.slice(i + 2, i + 6), 16));
          i += 6;
        } else {
          out += str[i + 1];
          i += 2;
        }
      } else {
        out += str[i];
        i++;
      }
    }
    i++;
    return out;
  }

  function parseBare() {
    const start = i;
    while (i < n && !/[\s,{}\[\]:]/.test(str[i])) i++;
    if (i === start) throw new Error(`Unexpected character at position ${i}: '${str[i]}'`);
    return convertBareToken(str.slice(start, i));
  }

  function convertBareToken(token) {
    if (/^true$/i.test(token)) return true;
    if (/^false$/i.test(token)) return false;
    const m = /^(-?\d+\.?\d*(?:[eE][-+]?\d+)?)[bBsSlLfFdD]?$/.exec(token);
    if (m) return parseFloat(m[1]);
    return token;
  }

  return parseValue();
}

function importFromJson(jsonString) {
  try {
    const parseOne = (str) => {
      try { return JSON.parse(str); } catch (e) { return parseSNBT(str); }
    };

    let rawName = '';
    let rawLore = null;
    let singleObjectError = null;

    try {
      let cleanedInput = jsonString.trim();
      const firstBrace = cleanedInput.indexOf('{');
      const lastBrace = cleanedInput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedInput = cleanedInput.substring(firstBrace, lastBrace + 1);
      }
      const data = parseOne(cleanedInput);
      const components = (data && data.components) || data;
      const candidateName = components['minecraft:custom_name'] ?? components['custom_name'];
      const candidateLore = components['minecraft:lore'] || components['lore'];
      if (candidateName !== undefined) rawName = candidateName;
      if (Array.isArray(candidateLore)) rawLore = candidateLore;
    } catch (err) {
      singleObjectError = err;
    }

    if (!rawLore) {
      const lines = jsonString.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length >= 2) {
        try {
          const parsedLines = lines.map(parseOne);
          rawName = parsedLines[0];
          rawLore = parsedLines.slice(1);
        } catch (err) {
        }
      }
    }

    if (!rawLore) {
      throw singleObjectError || new Error("Could not find lore data.");
    }

    const name = segmentsToAmpersandString(flattenComponent(rawName));
    const loreLines = rawLore.map(line => segmentsToAmpersandString(flattenComponent(line)));
    
    let detectedRarityKey = 'COMMON';
    let detectedItemType = '';
    let isRecombobulated = false;
    let finalLoreLines = [...loreLines];
    
    if (loreLines.length > 0) {
      const lastLine = loreLines[loreLines.length - 1];
      
      isRecombobulated = lastLine.includes('&k');
      
      const cleanLine = lastLine.replace(/&[0-9a-fk-or]/gi, '').trim();
      
      const sortedRarities = [...RARITIES].sort((a, b) => b.label.length - a.label.length);
      let matchedRarity = null;
      for (const r of sortedRarities) {
        if (cleanLine.includes(r.label)) {
          matchedRarity = r;
          break;
        }
      }
      
      if (matchedRarity) {
        detectedRarityKey = matchedRarity.key;
        
        const idx = cleanLine.indexOf(matchedRarity.label);
        let typePart = cleanLine.substring(idx + matchedRarity.label.length);
        
        if (isRecombobulated) {
          typePart = typePart.replace(/\s+.$/, '');
        }
        detectedItemType = typePart.trim();
        
        finalLoreLines.pop();
      }
    }
    
    const nameInput = document.getElementById('itemName');
    if (nameInput) nameInput.value = name;
    
    const loreInput = document.getElementById('loreText');
    if (loreInput) loreInput.value = finalLoreLines.join('\n');
    
    const typeInput = document.getElementById('itemType');
    if (typeInput) typeInput.value = detectedItemType;
    
    const recombobulatedCheck = document.getElementById('isRecombobulated');
    if (recombobulatedCheck) recombobulatedCheck.checked = isRecombobulated;
    
    const showFooterCheck = document.getElementById('showFooter');
    if (showFooterCheck) showFooterCheck.checked = true;
    
    const buttons = document.querySelectorAll('.rarity-btn');
    const rarityObj = RARITIES.find(r => r.key === detectedRarityKey);
    if (rarityObj) {
      buttons.forEach(btn => {
        if (btn.textContent === rarityObj.label) {
          btn.click();
        }
      });
    } else {
      render();
    }
    
    return true;
  } catch (err) {
    console.error("Failed to parse item data:", err);
    alert("Failed to import: Please verify that it's valid JSON or SNBT, or DM @helicoptero on discord.\n\nError: " + err.message);
    return false;
  }
}

window.importFromJson = importFromJson;

const openImportBtn = document.getElementById('openImportBtn');
const importModal = document.getElementById('importModal');
const closeImportBtn = document.getElementById('closeImportBtn');
const cancelImportBtn = document.getElementById('cancelImportBtn');
const confirmImportBtn = document.getElementById('confirmImportBtn');
const importJsonTextarea = document.getElementById('importJsonTextarea');

if (openImportBtn && importModal) {
  openImportBtn.addEventListener('click', () => {
    importModal.classList.add('show');
  });
}

const closeModal = () => {
  if (importModal) {
    importModal.classList.remove('show');
  }
};

if (closeImportBtn) {
  closeImportBtn.addEventListener('click', closeModal);
}

if (cancelImportBtn) {
  cancelImportBtn.addEventListener('click', closeModal);
}

if (importModal) {
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      closeModal();
    }
  });
}

if (confirmImportBtn && importJsonTextarea) {
  confirmImportBtn.addEventListener('click', () => {
    const jsonString = importJsonTextarea.value;
    if (!jsonString.trim()) {
      alert("Please paste your JSON.");
      return;
    }
    
    const success = importFromJson(jsonString);
    if (success) {
      importJsonTextarea.value = '';
      closeModal();
    }
  });
}

const GLYPH_DATA = [
  { char: '', name: 'Health', category: 'stats' },
  { char: '', name: 'Defense', category: 'stats' },
  { char: '', name: 'Strength', category: 'stats' },
  { char: '', name: 'Speed', category: 'stats' },
  { char: '', name: 'Crit Chance', category: 'stats' },
  { char: '', name: 'Crit Damage', category: 'stats'},
  { char: '', name: 'Intelligence', category: 'stats' },
  { char: '', name: 'Magic Find', category: 'stats' },
  { char: '', name: 'Pet Luck', category: 'stats' },
  { char: '', name: 'Ability Damage', category: 'stats' },
  { char: '', name: 'Bonus Attack Speed', category: 'stats' },
  { char: '', name: 'Swing Range', category: 'stats' },
  { char: '', name: 'Ferocity', category: 'stats' },
  { char: '', name: 'Health Regen', category: 'stats' },
  { char: '', name: 'Vitality', category: 'stats' },
  { char: '', name: 'Mending', category: 'stats' },
  { char: '', name: 'True Defense', category: 'stats' },
  { char: '⸎', name: 'Soulflow', category: 'stats' },
  { char: '', name: 'Overflow Mana', category: 'stats' },
  { char: '', name: 'Mining Speed', category: 'stats' },
  { char: '', name: 'Mining / Mining Fortune', category: 'stats' },
  { char: '', name: 'Mining Spread', category: 'stats' },
  { char: '', name: 'Pristine', category: 'stats' },
  { char: '', name: 'Gemstone Spread', category: 'stats' },
  { char: '', name: 'Breaking Power', category: 'stats' },
  { char: '', name: 'Cold / Cold Resistance', category: 'stats' },
  { char: '', name: 'Heat / Heat Resistance', category: 'stats' },
  { char: '', name: 'Fuel', category: 'stats' },
  { char: '', name: 'Fishing Speed', category: 'stats' },
  { char: '', name: 'Sea Creature Chance', category: 'stats' },
  { char: '', name: 'Double Hook Chance', category: 'stats' },
  { char: '', name: 'Treasure Chance', category: 'stats' },
  { char: '', name: 'Trophy Chance', category: 'stats' },
  { char: '', name: 'Pressure Resistance', category: 'stats' },
  { char: '', name: 'Respiration', category: 'stats' },
  { char: '', name: 'Farming / Farming Fortune', category: 'stats' },
  { char: '', name: 'Overbloom', category: 'stats' },
  { char: '', name: 'Pest ', category: 'stats' },
  { char: '', name: 'Bonus Pest Chance', category: 'stats' },
  { char: '', name: 'Foraging / Foraging Fortune', category: 'stats' },
  { char: '', name: 'Sweep', category: 'stats' },
  { char: '☯', name: 'Wisdom', category: 'stats' },
  { char: '', name: 'Rift Mana Regen', category: 'stats' },
  { char: '', name: 'Rift Damage', category: 'stats' },
  { char: '', name: 'Rift Health', category: 'stats' },
  { char: '', name: 'Rift Time', category: 'stats' },
  { char: '', name: '???', category: 'stats' },
  { char: '', name: '???', category: 'stats' },
  { char: '', name: '???', category: 'stats' },


  { char: '', name: 'Combat', category: 'skills' },
  { char: '', name: 'Farming', category: 'skills' },
  { char: '', name: 'Fishing', category: 'skills' },
  { char: '', name: 'Mining', category: 'skills' },
  { char: '', name: 'Foraging', category: 'skills' },
  { char: '', name: 'Enchanting', category: 'skills' },
  { char: '', name: 'Alchemy', category: 'skills' },
  { char: '', name: 'Carpentry', category: 'skills' },
  { char: '', name: 'Runecrafting', category: 'skills' },
  { char: '', name: 'Taming', category: 'skills' },
  { char: '', name: 'Social', category: 'skills' },
  { char: '', name: 'Hunting', category: 'skills' },

  { char: '', name: 'Fragged', category: 'name' },
  { char: '✪', name: 'Star', category: 'name' },
  { char: '➊', name: 'Master Star 1', category: 'name' },
  { char: '➋', name: 'Master Star 2', category: 'name' },
  { char: '➌', name: 'Master Star 3', category: 'name' },
  { char: '➍', name: 'Master Star 4', category: 'name' },
  { char: '➎', name: 'Master Star 5', category: 'name' },
  { char: '✿', name: 'Dye Symbol', category: 'name' },

  { char: '', name: 'Airborne', category: 'mobs' },
  { char: '', name: 'Animal', category: 'mobs' },
  { char: '', name: 'Aquatic', category: 'mobs' },
  { char: '', name: 'Arcane', category: 'mobs' },
  { char: '', name: 'Arthropod', category: 'mobs' },
  { char: '', name: 'Construct', category: 'mobs' },
  { char: '', name: 'Cubic', category: 'mobs' },
  { char: '', name: 'Elusive', category: 'mobs' },
  { char: '', name: 'Ender', category: 'mobs' },
  { char: '', name: 'Frozen', category: 'mobs' },
  { char: '', name: 'Glacial', category: 'mobs' },
  { char: '', name: 'Humanoid', category: 'mobs' },
  { char: '', name: 'Infernal', category: 'mobs' },
  { char: '', name: 'Magmatic', category: 'mobs' },
  { char: '', name: 'Mythological', category: 'mobs' },
  { char: '', name: 'Pest', category: 'mobs' },
  { char: '', name: 'Shielded', category: 'mobs' },
  { char: '', name: 'Skeletal', category: 'mobs' },
  { char: '', name: 'Spooky', category: 'mobs' },
  { char: '', name: 'Subterranean', category: 'mobs' },
  { char: '', name: 'Undead', category: 'mobs' },
  { char: '', name: 'Wither', category: 'mobs' },
  { char: '', name: 'Woodland', category: 'mobs' },

  { char: '', name: 'Left Arrow', category: 'symbols' },
  { char: '', name: 'Right Arrow', category: 'symbols' },
  { char: '', name: 'Up Arrow', category: 'symbols' },
  { char: '', name: 'Down Arrow', category: 'symbols' },
  { char: '✖', name: 'X', category: 'symbols' },
  { char: '', name: 'Lock', category: 'symbols' },
  { char: '', name: 'Location', category: 'symbols' },
  { char: '✆', name: 'Abiphone Ring', category: 'symbols' },
  { char: '♲', name: 'Ironman Profile', category: 'symbols' },
  { char: 'ዞ', name: 'Hypixel Admins', category: 'symbols' },
  { char: '◆', name: 'Rune Symbol', category: 'symbols' },
  { char: '✿', name: 'Dye Symbol', category: 'symbols' },
  { char: '⦾', name: 'Power Scroll', category: 'symbols' },
  { char: '🥺', name: 'Plead', category: 'symbols' }
];

let lastFocusedInput = null;

function insertGlyphAtCursor(glyph) {
  const target = lastFocusedInput || document.getElementById('loreText');
  if (!target) return;

  const start = target.selectionStart !== undefined ? target.selectionStart : target.value.length;
  const end = target.selectionEnd !== undefined ? target.selectionEnd : target.value.length;
  const val = target.value;

  target.value = val.substring(0, start) + glyph + val.substring(end);

  const newPos = start + glyph.length;
  target.selectionStart = newPos;
  target.selectionEnd = newPos;
  target.focus();

  render();
}

async function renderGlyphToCanvas(canvasEl, ch, hexColor = '#FFFFFF') {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.imageSmoothingEnabled = false;

  const mapping = getGlyphMapping(ch);

  if (mapping && mapping.image) {
    try {
      const rawBitmap = await getOrCreateBitmap(mapping.image);
      const color = hexToRgb(hexColor);
      const coloredCanvas = colorize(rawBitmap, color.r / 255, color.g / 255, color.b / 255);

      const w = rawBitmap.width;
      const h = rawBitmap.height;
      const sw = (mapping.u1 - mapping.u0) * w;
      const sh = (mapping.v1 - mapping.v0) * h;

      if (sw > 0 && sh > 0) {
        const pad = 2;
        const availW = canvasEl.width - pad * 2;
        const availH = canvasEl.height - pad * 2;
        const scale = Math.min(availW / sw, availH / sh);
        const dw = Math.max(1, Math.round(sw * scale));
        const dh = Math.max(1, Math.round(sh * scale));
        const dx = Math.round((canvasEl.width - dw) / 2);
        const dy = Math.round((canvasEl.height - dh) / 2);

        ctx.drawImage(
          coloredCanvas,
          mapping.u0 * w, mapping.v0 * h, sw, sh,
          dx, dy, dw, dh
        );
        return;
      }
    } catch (err) {
      console.warn(`Failed rendering glyph "${ch}":`, err);
    }
  }

  ctx.fillStyle = hexColor;
  ctx.font = '12px "Minecraft", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, canvasEl.width / 2, canvasEl.height / 2);
}

function createGlyphButton(item) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'glyph-btn';
  btn.title = `${item.name} (${item.char})`;

  const canvas = document.createElement('canvas');
  canvas.width = 20;
  canvas.height = 20;
  canvas.className = 'glyph-canvas';
  btn.appendChild(canvas);

  renderGlyphToCanvas(canvas, item.char, item.color || '#FFFFFF');

  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    insertGlyphAtCursor(item.char);
  });

  return btn;
}

function getAllAvailableGlyphs() {
  const customList = [...GLYPH_DATA];
  const knownChars = new Set(GLYPH_DATA.map(g => g.char));

  if (typeof FontMappings !== 'undefined') {
    for (const ch of Object.keys(FontMappings)) {
      if (!knownChars.has(ch) && ch.trim() !== '') {
        customList.push({
          char: ch,
          name: `Glyph ${ch}`,
          category: 'all',
          color: '#FFFFFF'
        });
        knownChars.add(ch);
      }
    }
  }
  return customList;
}

function filterAndRenderGlyphGrid() {
  const searchInput = document.getElementById('glyphSearchInput');
  const search = (searchInput?.value || '').toLowerCase().trim();
  const activeTab = document.querySelector('.glyph-tab.active')?.dataset.category || 'all';

  const allGlyphs = getAllAvailableGlyphs();
  const filtered = allGlyphs.filter(g => {
    const matchesTab = (activeTab === 'all') || (g.category === activeTab);
    const matchesSearch = !search || g.name.toLowerCase().includes(search) || g.char.includes(search);
    return matchesTab && matchesSearch;
  });

  const gridEl = document.getElementById('glyphGrid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  filtered.forEach(glyph => {
    gridEl.appendChild(createGlyphButton(glyph));
  });
}

function initGlyphMenu() {
  lastFocusedInput = document.getElementById('loreText');

  ['itemName', 'itemType', 'loreText'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', () => { lastFocusedInput = el; });
      el.addEventListener('click', () => { lastFocusedInput = el; });
    }
  });

  const searchInput = document.getElementById('glyphSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', filterAndRenderGlyphGrid);
  }

  const tabs = document.querySelectorAll('.glyph-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterAndRenderGlyphGrid();
    });
  });

  const toggleBtn = document.getElementById('openGlyphPanelBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const section = document.getElementById('glyphPickerFieldset');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('glyphSearchInput')?.focus();
      }
    });
  }

  filterAndRenderGlyphGrid();
}

(async function init() {
  updateSliderDisplays();
  populateConfigInputs();
  initGlyphMenu();
  render();

  await loadRarityAssets(currentRarity);
  render();

  document.fonts.load(`${LAYOUT_CONFIG.fontSize}px "${LAYOUT_CONFIG.fontFamily}"`)
    .catch(() => {})
    .finally(() => document.fonts.ready.then(render));

  for (const r of RARITIES) {
    if (r.key !== currentRarity) {
      loadRarityAssets(r.key); 
    }
  }

  requestAnimationFrame(animate);
})();