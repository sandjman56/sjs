/**
 * canvas-dark.js
 * Dark mode background: Tron-inspired square grid with light cycles
 * that navigate the grid at intersections, pulsing nodes, and brief flares.
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

  // ── TronCar ───────────────────────────────────────────────────────────────
  // A light cycle that travels along grid lines and turns at intersections.
  class TronCar {
    constructor(w, h, gridSize) {
      this.gs = gridSize;
      this.color = NEON[Math.floor(Math.random() * NEON.length)];
      this.speed = 1.1 + Math.random() * 1.3;
      this.bodyLen = 28 + Math.random() * 22;
      this.history = [];
      this._w = w;
      this._h = h;

      // Start at a random interior grid intersection
      const cols = Math.max(2, Math.floor(w / gridSize) - 2);
      const rows = Math.max(2, Math.floor(h / gridSize) - 2);
      const col = 1 + Math.floor(Math.random() * cols);
      const row = 1 + Math.floor(Math.random() * rows);
      this.x = col * gridSize;
      this.y = row * gridSize;

      // Random initial direction
      const DIRS = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
      const d = DIRS[Math.floor(Math.random() * DIRS.length)];
      this.dx = d.dx;
      this.dy = d.dy;

      this._toNext = gridSize;  // distance until next intersection
      this._dead = false;
      this._offFrames = 0;
    }

    get dead() { return this._dead; }

    update() {
      this.history.push({ x: this.x, y: this.y });

      // Trim trail to body length
      while (this.history.length > 1) {
        const oldest = this.history[0];
        const ddx = this.x - oldest.x;
        const ddy = this.y - oldest.y;
        if (Math.sqrt(ddx * ddx + ddy * ddy) > this.bodyLen) {
          this.history.shift();
        } else {
          break;
        }
      }

      this.x += this.dx * this.speed;
      this.y += this.dy * this.speed;
      this._toNext -= this.speed;

      // At intersection: snap and choose new direction
      if (this._toNext <= 0) {
        this.x = Math.round(this.x / this.gs) * this.gs;
        this.y = Math.round(this.y / this.gs) * this.gs;
        this._toNext = this.gs;
        this._pickDirection();
      }

      // Kill if off-screen too long
      const w = this._w;
      const h = this._h;
      const margin = this.gs * 3;
      const offScreen = this.x < -margin || this.x > w + margin ||
                        this.y < -margin || this.y > h + margin;
      if (offScreen) {
        this._offFrames++;
        if (this._offFrames > 90) this._dead = true;
      } else {
        this._offFrames = 0;
      }
    }

    _pickDirection() {
      const w = this._w;
      const h = this._h;
      const options = [];

      // Prefer going straight
      options.push({ dx: this.dx, dy: this.dy, wt: 4 });

      // Perpendicular turns
      if (this.dx !== 0) {
        options.push({ dx: 0, dy: 1, wt: 1 });
        options.push({ dx: 0, dy: -1, wt: 1 });
      } else {
        options.push({ dx: 1, dy: 0, wt: 1 });
        options.push({ dx: -1, dy: 0, wt: 1 });
      }

      // Steer back toward screen center if near edges
      const margin = this.gs * 5;
      if (this.x < margin)      options.push({ dx: 1,  dy: 0,  wt: 6 });
      if (this.x > w - margin)  options.push({ dx: -1, dy: 0,  wt: 6 });
      if (this.y < margin)      options.push({ dx: 0,  dy: 1,  wt: 6 });
      if (this.y > h - margin)  options.push({ dx: 0,  dy: -1, wt: 6 });

      const total = options.reduce((s, o) => s + o.wt, 0);
      let rand = Math.random() * total;
      for (const o of options) {
        rand -= o.wt;
        if (rand <= 0) {
          this.dx = o.dx;
          this.dy = o.dy;
          return;
        }
      }
    }

    draw(ctx) {
      if (this.history.length < 2) return;
      ctx.save();
      ctx.lineCap = 'square';

      const len = this.history.length;
      for (let i = 1; i < len; i++) {
        const t = i / len;
        const alpha = Math.pow(t, 1.4) * 0.85;
        const p0 = this.history[i - 1];
        const p1 = this.history[i];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = neonColor(this.color, alpha);
        ctx.lineWidth = 2;
        ctx.shadowColor = neonColor(this.color, 0.45);
        ctx.shadowBlur = 5;
        ctx.stroke();
      }

      // Bright headlight
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = neonColor(this.color, 1);
      ctx.shadowBlur = 16;
      ctx.shadowColor = neonColor(this.color, 0.9);
      ctx.fill();

      ctx.restore();
    }
  }

  // ── NodeFlash ─────────────────────────────────────────────────────────────
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
    cars: [],
    flashes: [],
    gridSize: 64,
    MAX_CARS: 7,
    _frame: 0,
    _nodes: [],

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cars = [];
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
      this.cars = [];
      this.flashes = [];
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

      this._drawGrid(ctx, w, h);
      this._drawStaticNodes(ctx);

      // Spawn cars gradually (stagger initial spawn)
      if (this.cars.length < this.MAX_CARS && this._frame % 22 === 0) {
        this.cars.push(new TronCar(w, h, this.gridSize));
      }

      // Spawn occasional node flash (sparse — not too distracting)
      if (Math.random() < 0.012 && this._nodes.length > 0) {
        const node = this._nodes[Math.floor(Math.random() * this._nodes.length)];
        this.flashes.push(new NodeFlash(node.x, node.y));
      }

      // Update & draw cars
      this.cars = this.cars.filter(c => !c.dead);
      for (const car of this.cars) {
        car.update();
        car.draw(ctx);
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
