const COLOR_CODES = {
  '0':'#000000','1':'#353FCE','2':'#00AA00','3':'#00aaaa',
  '4':'#D13228','5':'#A335EE','6':'#FF9000','7':'#A8BFD2',
  '8':'#707592','9':'#459bff','a':'#55FF55','b':'#55FFFF',
  'c':'#FF5555','d':'#FF55FF','e':'#FFDE2F','f':'#FFFFFF'
};
const FORMAT_CODES = ['l','o','n','m','k'];

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

const DEFAULT_LAYOUT_CONFIG = {
  fontSize: 12,
  lineHeight: 12,
  fontFamily: 'Minecraft',
  sourceBorderPx: 25,
  borderSize: 25,
  textGap: 2,
  titleGap: 3,
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

const OBF_GROUPS = [
  'k<> ',
  'abcdefghnopqrsuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ023456789@#$&=',
  'm~'
];

function obfuscate(str, seed = 0){
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    let group = OBF_GROUPS[2];
    for (const g of OBF_GROUPS) {
      if (g.includes(char)) {
        group = g;
        break;
      }
    }
    const index = Math.abs(char.charCodeAt(0) * 31 + (obfuscationTick + i) * 17 + seed * 53) % group.length;
    out += group[index];
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

function layoutSegment(ctx, display, bold){
  if (!bold) return { chars: null, width: ctx.measureText(display).width };
  const chars = [];
  let w = 0;
  for (const ch of display){
    const cw = ctx.measureText(ch).width;
    chars.push({ ch, x: w, w: cw });
    w += cw + BOLD_LETTER_SPACING;
  }
  if (chars.length) w -= BOLD_LETTER_SPACING; 
  w += 1; 
  return { chars, width: w };
}

function measureLine(ctx, segments, config, lineIdx = 0){
  let w = 0;
  segments.forEach((seg, segIdx) => {
    ctx.font = fontFor(seg, config);
    const seed = lineIdx * 1000 + segIdx;
    const display = seg.obfuscated ? obfuscate(seg.text, seed) : seg.text;
    w += layoutSegment(ctx, display, seg.bold).width;
  });
  return w;
}

function drawLine(ctx, segments, x, y, shadowOnly, config, lineIdx = 0){
  let cx = x;
  segments.forEach((seg, segIdx) => {
    ctx.font = fontFor(seg, config);
    const seed = lineIdx * 1000 + segIdx;
    const display = seg.obfuscated ? obfuscate(seg.text, seed) : seg.text;
    const layout = layoutSegment(ctx, display, seg.bold);
    ctx.fillStyle = shadowOnly ? shadowColor(seg.color) : seg.color;
    const dx = shadowOnly ? cx + 1 : cx;
    const dy = shadowOnly ? y + 1 : y;

    if (!seg.bold){
      ctx.fillText(display, dx, dy);
    } else {
      layout.chars.forEach(({ ch, x: chx }) => {
        ctx.fillText(ch, dx + chx, dy);
        ctx.fillText(ch, dx + chx + 1, dy); 
      });
    }

    if (seg.underline || seg.strikethrough){
      const ly = seg.underline ? y + config.fontSize*0.85 : y + config.fontSize*0.45;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dx, ly);
      ctx.lineTo(dx + layout.width, ly);
      ctx.stroke();
    }
    cx += layout.width;
  });
}

const canvas = document.getElementById('tooltipCanvas');
const ctx = canvas.getContext('2d');

function computeTooltipModel(){
  const config = { ...LAYOUT_CONFIG, previewZoom: getPreviewZoom() };
  const rarity = RARITIES.find(r => r.key === currentRarity);
  const nameSegs = parseFormatted(document.getElementById('itemName').value, rarity.color);
  const loreRaw = document.getElementById('loreText').value.split('\n');
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

function drawTooltip(targetCtx, model, scale){
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
  allLines.forEach((segs, idx) => {
    drawLine(targetCtx, segs, config.padding, y, true, config, idx);
    drawLine(targetCtx, segs, config.padding, y, false, config, idx);
    y += config.lineHeight;
    
    if (idx === 0 && allLines.length > 1) {
      y += config.titleGap;
    }
  });
  targetCtx.restore();
}

let lastCw = 0, lastCh = 0, lastScale = 0, lastZoom = 0;

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

  drawTooltip(ctx, model, previewScale);
}

function updateAnimationButtonsVisibility() {
  const isRecombobulated = document.getElementById('isRecombobulated')?.checked;
  const animGroup = document.getElementById('animationButtons');
  if (animGroup) {
    animGroup.style.display = isRecombobulated ? 'flex' : 'none';
  }
}

function render(){
  const model = computeTooltipModel();
  renderWithModel(model);
  updateAnimationButtonsVisibility();
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

if (cogBtn && configPanel) {
  cogBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    configPanel.classList.toggle('show');
  });

  configPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', () => {
    configPanel.classList.remove('show');
  });
}

if (closeConfigBtn && configPanel) {
  closeConfigBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    configPanel.classList.remove('show');
  });
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
  'itemName', 'itemType', 'loreText', 'showFooter', 'isRecombobulated', 'pixelScale', 'previewZoom'
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

document.getElementById('downloadBtn').addEventListener('click', () => {
  const model = computeTooltipModel();
  const { cw, ch } = model;
  const pixelScale = parseInt(document.getElementById('pixelScale').value, 10);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = cw * pixelScale;
  exportCanvas.height = ch * pixelScale;
  const exportCtx = exportCanvas.getContext('2d');
  drawTooltip(exportCtx, model, pixelScale);

  const link = document.createElement('a');
  link.download = `tooltip-${currentRarity.toLowerCase()}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
});

document.getElementById('downloadGifBtn').addEventListener('click', () => {
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
    drawTooltip(tempCtx, model, pixelScale);
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
      link.download = `tooltip-${currentRarity.toLowerCase()}.gif`;
      link.href = obj.image;
      link.click();
    } else {
      alert("GIF Export Failed: " + obj.errorMsg);
    }
  });
});

document.getElementById('downloadApngBtn').addEventListener('click', () => {
  const btn = document.getElementById('downloadApngBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Encoding APNG...';
  btn.disabled = true;

  setTimeout(() => {
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
        drawTooltip(tempCtx, model, pixelScale);
        
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
      link.download = `tooltip-${currentRarity.toLowerCase()}.apng`;
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

(async function init() {
  updateSliderDisplays();
  populateConfigInputs()
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