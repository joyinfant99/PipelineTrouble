// Assets — loads the Personio logo once and derives flat, palette-colored
// silhouette icons from it (ink pixels -> solid color, everything else -> transparent),
// so it can be dropped onto our dark canvas in any of the four accent colors.
const Assets = {
  ready: false, // logo variants ready (blockers, lives icons)
  background: null,
  characters: [], // [{ straight: Image|null, up: Image|null }]
  _rawImg: null,
  _variants: {},

  init(onReady) {
    const img = new Image();
    img.onload = () => {
      this._rawImg = img;
      this._buildVariants();
      this.ready = true;
      if (onReady) onReady();
    };
    img.onerror = () => {
      this.ready = false;
      if (onReady) onReady();
    };
    img.src = CONFIG.LOGO_SRC;

    this._loadImage(CONFIG.BACKGROUND_SRC, (bg) => {
      this.background = bg;
    });

    this.characters = CONFIG.CHARACTERS.map(() => ({ straight: null, up: null }));
    CONFIG.CHARACTERS.forEach((char, i) => {
      this._loadImage(char.straight, (im) => {
        this.characters[i].straight = im;
      });
      this._loadImage(char.up, (im) => {
        this.characters[i].up = im;
      });
    });
  },

  // Paths contain spaces and mixed casing exactly as the artwork was delivered,
  // so they have to be URI-encoded before they become an image src.
  _loadImage(src, onLoad) {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.onerror = () => onLoad(null);
    img.src = encodeURI(src);
  },

  characterImage(charIndex, pose) {
    const entry = this.characters[charIndex];
    if (!entry) return null;
    return entry[pose] || entry.straight || entry.up;
  },

  // Draws a character standing on feetY, centred on its body (not its frame).
  // Sprites face right; flip mirrors them for walking left.
  drawCharacter(ctx, charIndex, pose, cx, feetY, drawH, flip) {
    const img = this.characterImage(charIndex, pose);
    if (!img) return false;
    const drawW = drawH * (img.naturalWidth / img.naturalHeight);
    const bodyRatio = CONFIG.SPRITE_BODY_CENTER[pose] || 0.5;
    ctx.save();
    ctx.imageSmoothingEnabled = false; // keep the pixel art crisp when scaled
    ctx.translate(cx, feetY);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -drawW * bodyRatio, -drawH, drawW, drawH);
    ctx.restore();
    return true;
  },

  // Width of a character's body offset used for muzzle placement.
  characterWidth(charIndex, pose, drawH) {
    const img = this.characterImage(charIndex, pose);
    if (!img) return drawH * 0.7;
    return drawH * (img.naturalWidth / img.naturalHeight);
  },

  drawBackground(ctx, w, h) {
    const bg = this.background;
    if (!bg) return false;
    // cover-fit: fill the canvas, cropping the overflowing axis, bottom-aligned so the
    // cobblestone street stays under the players' feet
    const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
    const dw = bg.naturalWidth * scale;
    const dh = bg.naturalHeight * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, (w - dw) / 2, h - dh, dw, dh);
    ctx.restore();
    return true;
  },

  _buildVariants() {
    const size = 128;
    const src = document.createElement('canvas');
    src.width = size;
    src.height = size;
    const sctx = src.getContext('2d');
    sctx.drawImage(this._rawImg, 0, 0, size, size);
    const srcData = sctx.getImageData(0, 0, size, size).data;

    const colors = {
      cyan: CONFIG.COLORS.cyan,
      yellow: CONFIG.COLORS.yellow,
      pink: CONFIG.COLORS.pink,
      white: CONFIG.COLORS.white,
    };

    Object.entries(colors).forEach(([key, hex]) => {
      const [r, g, b] = this._hexToRgb(hex);
      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      const octx = out.getContext('2d');
      const outImg = octx.createImageData(size, size);
      for (let i = 0; i < srcData.length; i += 4) {
        const lum = (srcData[i] + srcData[i + 1] + srcData[i + 2]) / 3;
        const alpha = srcData[i + 3];
        // "ink" pixels (dark) become the solid color; light/background pixels become transparent
        if (alpha > 40 && lum < 140) {
          outImg.data[i] = r;
          outImg.data[i + 1] = g;
          outImg.data[i + 2] = b;
          outImg.data[i + 3] = 255;
        } else {
          outImg.data[i + 3] = 0;
        }
      }
      octx.putImageData(outImg, 0, 0);
      this._variants[key] = out;
    });
  },

  _hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  // draws the logo icon centered at (x,y) fitting inside a box of ~diameter d
  draw(ctx, colorKey, x, y, d) {
    const variant = this._variants[colorKey];
    if (!variant) return false;
    ctx.drawImage(variant, x - d / 2, y - d / 2, d, d);
    return true;
  },
};
