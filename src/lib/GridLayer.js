import config from '../config.js';
import tinycolor from 'tinycolor2';
import {WireCollection} from 'w-gl';

let counter = 0;

export default class GridLayer {
  get color() {
    return this._color;
  }

  set color(unsafeColor) {
    let color = tinycolor(unsafeColor);
    this._color = color;
    if (this.lines) {
      this.lines.color = toRatioColor(color.toRgb());
    }
    if (this.scene) {
      this.scene.renderFrame();
    }
  }

  get lineWidth() {
    return this._lineWidth;
  }

  set lineWidth(newValue) {
    this._lineWidth = newValue;
    if (!this.lines || !this.scene) return;

    this.lines.setLineWidth(newValue);
  }

  constructor() {
    this._color = config.getDefaultLineColor();
    this.grid = null;
    this.lines = null;
    this.scene = null;
    this.dx = 0;
    this.dy = 0;
    this.scale = 1;
    this.hidden = false;
    this.id = 'paths_' + counter;
    this._lineWidth = 1;
    this.animated = true;
    this.animationDuration = 1200;
    this.revealOrder = 'original';
    this.loopAnimation = false;
    this.boomerang = false;
    counter += 1;
  }

  getGridProjector() {
    if (this.grid) return this.grid.projector;
  }

  getQueryBounds() {
    const {grid} = this;
    if (grid) {
      if (grid.queryBounds) return grid.queryBounds;
      if (grid.isArea) return {
        areaId: grid.id
      };
    }
  }

  setGrid(grid) {
    this.grid = grid;
    if (this.scene) {
      this.bindToScene(this.scene);
    }
  }

  getViewBox() {
    if (!this.grid) return null;

    let {width, height} = this.grid.getProjectedRect();
    let initialSceneSize = Math.max(width, height) / 4;
    return {
      left:  -initialSceneSize,
      top:    initialSceneSize,
      right:  initialSceneSize,
      bottom: -initialSceneSize,
    };
  }

  moveTo(x, y = 0) {
    console.warn('Please use moveBy() instead. The moveTo() is under construction');
    // this.dx = x;
    // this.dy = y;

    // this._transferTransform();
  }

  moveBy(dx, dy = 0) {
    this.dx = dx;
    this.dy = dy;

    this._transferTransform();
  }

  buildLinesCollection() {
    if (this.lines) return this.lines;

    let grid = this.grid;
    let ways = [];
    grid.forEachWay(function(from, to) {
      ways.push({from, to});
    });
    ways = orderWays(ways, this.revealOrder);

    let lines = new WireCollection(ways.length || 1, {
      width: this._lineWidth,
      allowColors: false,
      is3D: false
    });
    let color = tinycolor(this._color).toRgb();
    lines.color = toRatioColor(color);
    lines.id = this.id;

    this.lines = lines;
    this._ways = ways;
  }

  // Draws every road at once (the "all at once" feature).
  revealAll() {
    let ways = this._ways;
    let lines = this.lines;
    if (!ways || !lines) return;

    while (lines.count < ways.length) {
      lines.add(ways[lines.count]);
    }
    lines.isDirtyBuffer = true;
    if (this.scene) this.scene.renderFrame();
  }

  // Reveals roads progressively instead of all at once, so the city looks
  // like it's being drawn/connected together in the chosen palette color.
  // `duration` (ms) lets the user calibrate how fast they connect.
  animateReveal(duration = this.animationDuration, onComplete) {
    let ways = this._ways;
    let lines = this.lines;
    if (!ways || !ways.length || !lines) {
      if (onComplete) onComplete();
      return;
    }

    let start = performance.now();

    let step = () => {
      if (this._disposed || this.lines !== lines) return;

      let t = Math.min(1, (performance.now() - start) / duration);
      let eased = 1 - Math.pow(1 - t, 3);
      let targetCount = Math.round(ways.length * eased);

      while (lines.count < targetCount) {
        lines.add(ways[lines.count]);
      }
      lines.isDirtyBuffer = true;
      if (this.scene) this.scene.renderFrame();

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }

      if (onComplete) onComplete();
      if (this.loopAnimation && !this._disposed) {
        if (this.boomerang) {
          this.retract(duration, () => {
            if (this._disposed) return;
            this._ways = orderWays(ways, this.revealOrder);
            this.animateReveal(duration);
          });
        } else {
          this._ways = orderWays(ways, this.revealOrder);
          lines.count = 0;
          lines.isDirtyBuffer = true;
          if (this.scene) this.scene.renderFrame();
          this.animateReveal(duration);
        }
      }
    };

    requestAnimationFrame(step);
  }

  // Un-reveals the city back to 0 (mirror of animateReveal), so a looping
  // boomerang plays forward then backward instead of hard-cutting to blank -
  // no instant jump, the roads just retract the way they were drawn.
  retract(duration = this.animationDuration, onComplete) {
    let lines = this.lines;
    if (!lines || !lines.count) {
      if (onComplete) onComplete();
      return;
    }

    let start = performance.now();
    let startCount = lines.count;

    let step = () => {
      if (this._disposed || this.lines !== lines) return;

      let t = Math.min(1, (performance.now() - start) / duration);
      let eased = 1 - Math.pow(1 - t, 3);
      lines.count = Math.max(0, Math.round(startCount * (1 - eased)));
      lines.isDirtyBuffer = true;
      if (this.scene) this.scene.renderFrame();

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }

      if (onComplete) onComplete();
    };

    requestAnimationFrame(step);
  }

  // Re-runs the reveal from scratch with whatever settings are current,
  // so changing speed/order/animate-toggle can be previewed without
  // re-loading the city. Also used to drive the animation export.
  replay({animated = this.animated, duration = this.animationDuration, onComplete} = {}) {
    if (!this.lines || !this._ways) return;

    this._ways = orderWays(this._ways, this.revealOrder);
    this.lines.count = 0;
    this.lines.isDirtyBuffer = true;
    if (this.scene) this.scene.renderFrame();

    if (animated) {
      this.animateReveal(duration, onComplete);
    } else {
      this.revealAll();
      if (onComplete) onComplete();
    }
  }

  destroy() {
    this._disposed = true;
    if (!this.scene || !this.lines) return;

    // TODO: This should remove the grid layer too. Need to clean up how
    // scene interacts with grid layers.
    this.scene.removeChild(this.lines);
  }

  bindToScene(scene) {
    if (this.scene && this.lines) {
      console.error('You seem to be adding this layer twice...')
    }

    this.scene = scene;
    if (!this.grid) return;

    this.buildLinesCollection();

    if (this.hidden) return;
    this.scene.appendChild(this.lines);
    if (this.animated) {
      this.animateReveal();
    } else {
      this.revealAll();
    }
  }

  hide() {
    if (this.hidden) return;
    this.hidden = true;
    if (!this.scene || !this.grid) return;

    this.scene.removeChild(this.lines);
  }

  show() {
    if (!this.hidden) return;
    this.hidden = false;
    if (!this.scene || !this.grid) {
      console.log('Layer will be shown when grid is available');
      return;
    }

    this.scene.appendChild(this.lines);
  }

  _transferTransform() {
    if (!this.lines) return;

    this.lines.translate([this.dx, this.dy, 0]);
    this.lines.updateWorldTransform(true);
    if (this.scene) {
      this.scene.renderFrame(true);
    }
  }
}

function toRatioColor(c) {
  return {r: c.r/0xff, g: c.g/0xff, b: c.b/0xff, a: c.a}
}

function orderWays(ways, order) {
  if (order === 'random') {
    let shuffled = ways.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  if (order === 'center-out' || order === 'outside-in') {
    let cx = 0, cy = 0;
    ways.forEach(w => { cx += w.from.x; cy += w.from.y; });
    cx /= ways.length || 1;
    cy /= ways.length || 1;

    let sorted = ways.slice().sort((a, b) => {
      let da = (a.from.x - cx) ** 2 + (a.from.y - cy) ** 2;
      let db = (b.from.x - cx) ** 2 + (b.from.y - cy) ** 2;
      return order === 'center-out' ? da - db : db - da;
    });
    return sorted;
  }

  if (order === 'bfs' || order === 'dfs') {
    return traverseWays(ways, order === 'dfs');
  }

  if (order === 'spiral') {
    return spiralWays(ways);
  }

  return ways; // 'original' - the order roads came from OSM
}

// Walks the road network like a graph: two segments are "connected" when
// they share an endpoint. Visits every connected component (a city can have
// disjoint islands of roads) so nothing is left undrawn.
function traverseWays(ways, useStack) {
  let adjacency = buildWayAdjacency(ways);
  let visited = new Uint8Array(ways.length);
  let order = [];

  for (let start = 0; start < ways.length; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    let frontier = [start];

    if (useStack) {
      while (frontier.length) {
        let i = frontier.pop();
        order.push(ways[i]);
        adjacency[i].forEach(n => {
          if (!visited[n]) { visited[n] = 1; frontier.push(n); }
        });
      }
    } else {
      let head = 0;
      while (head < frontier.length) {
        let i = frontier[head++];
        order.push(ways[i]);
        adjacency[i].forEach(n => {
          if (!visited[n]) { visited[n] = 1; frontier.push(n); }
        });
      }
    }
  }

  return order;
}

// ponytail: adjacency is "shares an endpoint", not real street topology
// (no merging of collinear segments). Good enough for a reveal-order
// effect; build a proper road graph if this needs to drive real routing.
function buildWayAdjacency(ways) {
  let pointToWays = new Map();
  let key = p => p.x + ',' + p.y;

  ways.forEach((w, i) => {
    addPoint(w.from, i);
    addPoint(w.to, i);
  });

  return ways.map(w => {
    let neighbors = new Set();
    pointToWays.get(key(w.from)).forEach(n => neighbors.add(n));
    pointToWays.get(key(w.to)).forEach(n => neighbors.add(n));
    return neighbors;
  });

  function addPoint(p, i) {
    let k = key(p);
    let arr = pointToWays.get(k);
    if (!arr) { arr = []; pointToWays.set(k, arr); }
    arr.push(i);
  }
}

// Concentric rings around the centroid, each ring revealed in angular order -
// roads "spiral" outward from the middle of the city.
function spiralWays(ways) {
  let cx = 0, cy = 0;
  ways.forEach(w => { cx += w.from.x; cy += w.from.y; });
  cx /= ways.length || 1;
  cy /= ways.length || 1;

  const RINGS = 24;
  let maxDist = 0;
  let scored = ways.map(w => {
    let dx = w.from.x - cx, dy = w.from.y - cy;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    maxDist = Math.max(maxDist, dist);
    return {w, dist, angle};
  });

  scored.forEach(s => { s.ring = maxDist ? Math.floor((s.dist / maxDist) * RINGS) : 0; });
  scored.sort((a, b) => (a.ring - b.ring) || (a.angle - b.angle));
  return scored.map(s => s.w);
}