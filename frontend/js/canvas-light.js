/**
 * canvas-light.js
 * Light mode background: hexagonal grid with random color explosions
 * and color "lightning" propagation between adjacent cells.
 */

(function () {
  'use strict';

  const HUES = [260, 285, 310, 195, 220, 175, 330, 240, 160];

  // ── HexCell ───────────────────────────────────────────────────────────────
  class HexCell {
    constructor(cx, cy, r, index) {
      this.cx = cx;
      this.cy = cy;
      this.r = r;
      this.index = index;
      this.hue = 0;
      this.brightness = 0;
      this.targetBrt = 0;
      this.fadeSpeed = 0.008 + Math.random() * 0.006;
      this.neighbors = [];
    }

    ignite(hue, intensity) {
      this.hue = hue;
      this.targetBrt = Math.min(1, intensity);
      this.brightness = Math.min(1, this.brightness + intensity * 0.5);
    }

    update() {
      if (this.brightness < this.targetBrt) {
        this.brightness = Math.min(this.targetBrt, this.brightness + 0.1);
      } else {
        this.brightness = Math.max(0, this.brightness - this.fadeSpeed);
        if (this.brightness < 0.004) this.targetBrt = 0;
      }
    }

    // Draws just the outline path (for base grid pass)
    drawBase(ctx) {
      const r = this.r;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (60 * i - 30) * Math.PI / 180;
        const x = this.cx + r * Math.cos(angle);
        const y = this.cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    draw(ctx) {
      if (this.brightness < 0.004) return;
      const r = this.r * 0.96;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (60 * i - 30) * Math.PI / 180;
        const x = this.cx + r * Math.cos(angle);
        const y = this.cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      ctx.fillStyle = `hsla(${this.hue}, 85%, 58%, ${this.brightness * 0.14})`;
      ctx.fill();

      ctx.strokeStyle = `hsla(${this.hue}, 90%, 62%, ${this.brightness * 0.75})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = `hsla(${this.hue}, 100%, 65%, ${this.brightness * 0.45})`;
      ctx.shadowBlur = 10 * this.brightness;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── ColorWave ─────────────────────────────────────────────────────────────
  // Propagates a color explosion outward from a source cell, skipping some
  // neighbors randomly to create a "lightning" branching effect.
  class ColorWave {
    constructor(startIdx, cells, hue) {
      this.cells = cells;
      this.hue = hue;
      this.depth = 0;
      this.maxDepth = 3 + Math.floor(Math.random() * 6);
      this.frontier = [startIdx];
      this.visited = new Set([startIdx]);
      this.timer = 0;
      this.stepInterval = 3 + Math.floor(Math.random() * 3);
      this.done = false;
    }

    update() {
      this.timer++;
      if (this.timer % this.stepInterval !== 0) return;
      if (this.frontier.length === 0 || this.depth >= this.maxDepth) {
        this.done = true;
        return;
      }

      const nextFrontier = [];
      const intensity = 0.9 * Math.pow(0.62, this.depth);

      for (const idx of this.frontier) {
        const cell = this.cells[idx];
        if (!cell) continue;
        cell.ignite(this.hue, intensity);

        for (const nIdx of cell.neighbors) {
          if (!this.visited.has(nIdx) && Math.random() > 0.28) {
            this.visited.add(nIdx);
            nextFrontier.push(nIdx);
          }
        }
      }

      this.frontier = nextFrontier;
      this.depth++;
    }
  }

  // ── Manager ───────────────────────────────────────────────────────────────
  const LightCanvas = {
    canvas: null,
    ctx: null,
    cells: [],
    waves: [],
    raf: null,
    active: false,
    _frame: 0,
    HEX_R: 26,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._onResize = () => {
        this._resize();
        this._buildGrid();
      };
      window.addEventListener('resize', this._onResize);
      this._resize();
      this._buildGrid();
    },

    _resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    _buildGrid() {
      this.cells = [];
      this.waves = [];
      const r = this.HEX_R;
      const W = this.canvas.width;
      const H = this.canvas.height;

      // Pointy-top hex grid (offset row layout)
      // Horizontal spacing between col centers in same row: sqrt(3) * r
      // Vertical spacing between row centers: 1.5 * r
      // Odd rows are offset right by sqrt(3)/2 * r
      const colSpacing = Math.sqrt(3) * r;
      const rowSpacing = 1.5 * r;

      const cols = Math.ceil(W / colSpacing) + 2;
      const rows = Math.ceil(H / rowSpacing) + 2;

      const map = {};

      for (let row = -1; row <= rows; row++) {
        for (let col = -1; col <= cols; col++) {
          const cx = col * colSpacing + (row % 2 !== 0 ? colSpacing / 2 : 0);
          const cy = row * rowSpacing + r;
          const idx = this.cells.length;
          map[`${col},${row}`] = idx;
          this.cells.push(new HexCell(cx, cy, r, idx));
        }
      }

      // Assign neighbors (odd-r offset grid)
      for (let row = -1; row <= rows; row++) {
        for (let col = -1; col <= cols; col++) {
          const idx = map[`${col},${row}`];
          if (idx === undefined) continue;
          const cell = this.cells[idx];

          let offsets;
          if (row % 2 === 0) {
            offsets = [
              [col - 1, row], [col + 1, row],
              [col - 1, row - 1], [col, row - 1],
              [col - 1, row + 1], [col, row + 1],
            ];
          } else {
            offsets = [
              [col - 1, row], [col + 1, row],
              [col, row - 1], [col + 1, row - 1],
              [col, row + 1], [col + 1, row + 1],
            ];
          }

          for (const [nc, nr] of offsets) {
            const nIdx = map[`${nc},${nr}`];
            if (nIdx !== undefined) cell.neighbors.push(nIdx);
          }
        }
      }
    },

    start() {
      if (this.active) return;
      this.active = true;
      this._resize();
      this._buildGrid();
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
      this.waves = [];
    },

    _spawnWave() {
      if (this.cells.length === 0) return;
      const hue = HUES[Math.floor(Math.random() * HUES.length)];
      const startIdx = Math.floor(Math.random() * this.cells.length);
      this.cells[startIdx].ignite(hue, 1.0);
      this.waves.push(new ColorWave(startIdx, this.cells, hue));
    },

    _loop() {
      if (!this.active) return;
      this.raf = requestAnimationFrame(() => this._loop());

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);
      this._frame++;

      // Base grid pass — one save/restore for all cells
      ctx.save();
      ctx.strokeStyle = 'rgba(108, 63, 255, 0.065)';
      ctx.lineWidth = 0.6;
      ctx.shadowBlur = 0;
      for (const cell of this.cells) {
        cell.drawBase(ctx);
        ctx.stroke();
      }
      ctx.restore();

      // Spawn new wave every ~90 frames; also keep at least one going
      if (this._frame % 90 === 1) {
        this._spawnWave();
      }
      if (this._frame % 150 === 75 && Math.random() < 0.65) {
        this._spawnWave();
      }
      if (this.waves.length === 0 && this._frame % 20 === 0) {
        this._spawnWave();
      }

      // Update waves
      this.waves = this.waves.filter(wv => !wv.done);
      for (const wv of this.waves) {
        wv.update();
      }

      // Update & draw lit cells
      for (const cell of this.cells) {
        cell.update();
        cell.draw(ctx);
      }
    },
  };

  window.LightCanvas = LightCanvas;
})();
