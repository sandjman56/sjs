/**
 * canvas-light.js
 * Light mode background: colorful fractal bursts that splinter
 * in and out of existence across the canvas.
 */

(function () {
  'use strict';

  // ── Palette: vivid, saturated colors (avoid muddy mid-range) ─────────────
  const HUES = [260, 285, 310, 195, 220, 175, 330, 240, 160];

  // ── FractalBurst ──────────────────────────────────────────────────────────
  class FractalBurst {
    constructor(w, h) {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.baseHue = HUES[Math.floor(Math.random() * HUES.length)];
      this.maxDepth = 5 + Math.floor(Math.random() * 3);
      this.baseLen = 38 + Math.random() * 55;
      this.spread = 0.38 + Math.random() * 0.52;
      this.lenDecay = 0.60 + Math.random() * 0.10;

      // "Splinter" — initial direction can be anything
      const startAngle = Math.random() * Math.PI * 2;

      // Pre-compute all line segments sorted by depth (trunk → tips)
      this.segments = [];
      this._build(this.x, this.y, startAngle, this.baseLen, 0);
      this.segments.sort((a, b) => a.d - b.d);

      // Playback state
      this.revealed = 0;          // how many segments are visible
      this.revealRate = 4 + Math.floor(Math.random() * 4); // per frame
      this.opacity = 0;
      this.fadeInRate = 0.06;
      this.fadeOutRate = 0.012 + Math.random() * 0.008;
      this.holdFrames = 50 + Math.floor(Math.random() * 70);
      this.holdCount = 0;
      this.phase = 'in'; // in | hold | out
    }

    _build(x1, y1, angle, len, depth) {
      if (depth > this.maxDepth || len < 4) return;

      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;
      const hue = (this.baseHue + depth * 32) % 360;
      const width = Math.max(0.4, (this.maxDepth - depth + 1) * 0.65);

      this.segments.push({ x1, y1, x2, y2, hue, w: width, d: depth });

      const nextLen = len * this.lenDecay;

      // Left child
      this._build(x2, y2, angle - this.spread, nextLen, depth + 1);
      // Right child
      this._build(x2, y2, angle + this.spread, nextLen, depth + 1);

      // Occasional third branch on shallow depths for crystal feel
      if (depth < 2 && Math.random() > 0.45) {
        const midAngle = angle + (Math.random() - 0.5) * 0.28;
        this._build(x2, y2, midAngle, nextLen * 0.72, depth + 1);
      }
    }

    update() {
      if (this.phase === 'in') {
        this.opacity = Math.min(1, this.opacity + this.fadeInRate);
        this.revealed = Math.min(this.segments.length, this.revealed + this.revealRate);
        if (this.revealed >= this.segments.length) this.phase = 'hold';
      } else if (this.phase === 'hold') {
        this.holdCount++;
        if (this.holdCount >= this.holdFrames) this.phase = 'out';
      } else {
        this.opacity -= this.fadeOutRate;
      }
    }

    draw(ctx) {
      if (this.opacity <= 0) return;

      ctx.save();
      ctx.globalAlpha = this.opacity * 0.82;
      ctx.lineCap = 'round';

      for (let i = 0; i < this.revealed; i++) {
        const seg = this.segments[i];
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.strokeStyle = `hsl(${seg.hue}, 90%, 52%)`;
        ctx.lineWidth = seg.w;
        ctx.shadowColor = `hsl(${seg.hue}, 100%, 62%)`;
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      ctx.restore();
    }

    get done() {
      return this.phase === 'out' && this.opacity <= 0;
    }
  }

  // ── Manager ───────────────────────────────────────────────────────────────
  const LightCanvas = {
    canvas: null,
    ctx: null,
    bursts: [],
    raf: null,
    active: false,
    MAX_BURSTS: 6,
    SPAWN_INTERVAL: 40, // frames between spawn checks
    _frame: 0,
    _resizeId: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._onResize = () => this._resize();
      window.addEventListener('resize', this._onResize);
      this._resize();
    },

    _resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    start() {
      if (this.active) return;
      this.active = true;
      this._resize();
      this._loop();
    },

    stop() {
      this.active = false;
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
      }
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    },

    _spawn() {
      this.bursts.push(new FractalBurst(this.canvas.width, this.canvas.height));
    },

    _loop() {
      if (!this.active) return;
      this.raf = requestAnimationFrame(() => this._loop());

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      this._frame++;

      // Maintain burst count
      if (this._frame % this.SPAWN_INTERVAL === 0 || this.bursts.length === 0) {
        const needed = this.MAX_BURSTS - this.bursts.filter(b => !b.done).length;
        for (let i = 0; i < Math.min(needed, 2); i++) {
          this._spawn();
        }
      }

      // Update & draw, prune dead bursts
      this.bursts = this.bursts.filter(b => !b.done);
      for (const b of this.bursts) {
        b.update();
        b.draw(ctx);
      }
    },
  };

  window.LightCanvas = LightCanvas;
})();
