/**
 * canvas-dark.js
 * Dark mode background: Tron-inspired grid with moving neon light trails,
 * pulsing intersection nodes, and occasional data-burst flares.
 */

(function () {
  'use strict';

  const NEON = [
    { h: 180, s: 100, l: 55 },  // cyan
    { h: 220, s: 100, l: 58 },  // electric blue
    { h: 285, s: 100, l: 58 },  // neon purple
    { h: 300, s: 100, l: 55 },  // magenta
  ];

  function neonColor(palette, alpha = 1) {
    const c = palette;
    return `hsla(${c.h},${c.s}%,${c.l}%,${alpha})`;
  }

  // ── Trail ─────────────────────────────────────────────────────────────────
  // A bright line segment traveling along a grid axis
  class Trail {
    constructor(w, h, gridSize) {
      this.gs = gridSize;
      this.color = NEON[Math.floor(Math.random() * NEON.length)];
      this.speed = 1.8 + Math.random() * 3;
      this.tailLen = 80 + Math.random() * 140;
      this.history = [];

      const horiz = Math.random() > 0.45;
      if (horiz) {
        const rows = Math.ceil(h / gridSize);
        const row = Math.floor(Math.random() * rows);
        this.y = row * gridSize;
        const goRight = Math.random() > 0.5;
        this.x = goRight ? -this.tailLen : w + this.tailLen;
        this.dx = goRight ? this.speed : -this.speed;
        this.dy = 0;
        this._limit = goRight ? w + this.tailLen + 20 : -this.tailLen - 20;
        this._dead = () => goRight ? this.x > this._limit : this.x < this._limit;
      } else {
        const cols = Math.ceil(w / gridSize);
        const col = Math.floor(Math.random() * cols);
        this.x = col * gridSize;
        const goDown = Math.random() > 0.5;
        this.y = goDown ? -this.tailLen : h + this.tailLen;
        this.dx = 0;
        this.dy = goDown ? this.speed : -this.speed;
        this._limit = goDown ? h + this.tailLen + 20 : -this.tailLen - 20;
        this._dead = () => goDown ? this.y > this._limit : this.y < this._limit;
      }
    }

    get dead() { return this._dead(); }

    update() {
      this.history.push({ x: this.x, y: this.y });
      // Trim tail
      while (this.history.length > 1) {
        const oldest = this.history[0];
        const dx = this.x - oldest.x;
        const dy = this.y - oldest.y;
        if (Math.sqrt(dx * dx + dy * dy) > this.tailLen) {
          this.history.shift();
        } else {
          break;
        }
      }
      this.x += this.dx;
      this.y += this.dy;
    }

    draw(ctx) {
      if (this.history.length < 2) return;

      ctx.save();
      ctx.lineCap = 'round';

      const len = this.history.length;
      for (let i = 1; i < len; i++) {
        const t = i / len;
        const alpha = t * 0.9;
        ctx.beginPath();
        ctx.moveTo(this.history[i - 1].x, this.history[i - 1].y);
        ctx.lineTo(this.history[i].x, this.history[i].y);
        ctx.strokeStyle = neonColor(this.color, alpha);
        ctx.lineWidth = 1.5 + t;
        ctx.shadowColor = neonColor(this.color, 0.6);
        ctx.shadowBlur = 8 + t * 8;
        ctx.stroke();
      }

      // Bright head dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = neonColor(this.color, 1);
      ctx.shadowBlur = 22;
      ctx.shadowColor = neonColor(this.color, 0.9);
      ctx.fill();

      ctx.restore();
    }
  }

  // ── Node flash ────────────────────────────────────────────────────────────
  // A brief bright flare at a grid intersection
  class NodeFlash {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.color = NEON[Math.floor(Math.random() * NEON.length)];
      this.life = 1.0;
      this.decay = 0.03 + Math.random() * 0.04;
      this.maxR = 4 + Math.random() * 6;
    }

    get dead() { return this.life <= 0; }

    update() { this.life -= this.decay; }

    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.pow(this.life, 0.5);
      const r = this.maxR * (1 - this.life * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = neonColor(this.color, alpha * 0.8);
      ctx.shadowColor = neonColor(this.color, 0.9);
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Manager ───────────────────────────────────────────────────────────────
  const DarkCanvas = {
    canvas: null,
    ctx: null,
    raf: null,
    active: false,
    trails: [],
    flashes: [],
    gridSize: 64,
    MAX_TRAILS: 14,
    _frame: 0,
    // Precomputed node list for flash spawning
    _nodes: [],

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.trails = [];
      this.flashes = [];
      this._frame = 0;

      if (!this._onResize) {
        this._onResize = () => {
          this._resize();
          this._buildNodes();
        };
        window.addEventListener('resize', this._onResize);
      }

      this._resize();
      this._buildNodes();
    },

    _resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    _buildNodes() {
      this._nodes = [];
      const cols = Math.ceil(this.canvas.width / this.gridSize) + 1;
      const rows = Math.ceil(this.canvas.height / this.gridSize) + 1;
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          this._nodes.push({ x: c * this.gridSize, y: r * this.gridSize });
        }
      }
    },

    start() {
      if (this.active) return;
      this.active = true;
      this._resize();
      this._buildNodes();
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

    _drawGrid(ctx, w, h) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.055)';
      ctx.lineWidth = 0.6;
      ctx.shadowBlur = 0;

      const gs = this.gridSize;
      for (let x = 0; x <= w + gs; x += gs) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h + gs; y += gs) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    },

    _drawStaticNodes(ctx) {
      // A fraction of nodes get a dim persistent glow, drifting in phase
      const t = this._frame * 0.008;
      ctx.save();
      for (let i = 0; i < this._nodes.length; i += 6) {
        const node = this._nodes[i];
        const phase = Math.sin(t + i * 0.31);
        if (phase > 0.7) {
          const alpha = ((phase - 0.7) / 0.3) * 0.35;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,255,${alpha})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(0,255,255,0.5)';
          ctx.fill();
        }
      }
      ctx.restore();
    },

    _loop() {
      if (!this.active) return;
      this.raf = requestAnimationFrame(() => this._loop());

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      this._frame++;

      // Grid
      this._drawGrid(ctx, w, h);

      // Static node pulses
      this._drawStaticNodes(ctx);

      // Spawn trails
      if (this.trails.length < this.MAX_TRAILS && this._frame % 18 === 0) {
        this.trails.push(new Trail(w, h, this.gridSize));
      }

      // Spawn random node flash
      if (Math.random() < 0.015 && this._nodes.length > 0) {
        const node = this._nodes[Math.floor(Math.random() * this._nodes.length)];
        this.flashes.push(new NodeFlash(node.x, node.y));
      }

      // Update & draw trails
      this.trails = this.trails.filter(t => !t.dead);
      for (const t of this.trails) {
        t.update();
        t.draw(ctx);
      }

      // Update & draw flashes
      this.flashes = this.flashes.filter(f => !f.dead);
      for (const f of this.flashes) {
        f.update();
        f.draw(ctx);
      }
    },
  };

  window.DarkCanvas = DarkCanvas;
})();
