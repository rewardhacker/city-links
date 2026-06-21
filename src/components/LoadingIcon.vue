<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="20" height="20" fill="none" class="loader" aria-hidden="true">
    <g ref="group">
      <path ref="path" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" opacity="0.15"></path>
    </g>
  </svg>
</template>
<script>
const SVG_NS = 'http://www.w3.org/2000/svg';

// ponytail: ported from the "Rose Three" math-curve loader (a rose curve
// r(t) = a·cos(3t) traced by a fading particle trail). Dropped the original
// demo chrome (title/formula/back-link) since this is just an inline
// loading icon, and trimmed particle/path resolution for its small size.
const rose = {
  particleCount: 36,
  trailSpan: 0.31,
  durationMs: 5300,
  rotationDurationMs: 28000,
  pulseDurationMs: 4400,
  strokeWidth: 4.6,
  a: 9.2,
  aBoost: 0.6,
  breathBase: 0.72,
  breathBoost: 0.28,
  scale: 3.25,
  point(progress, detailScale) {
    let t = progress * Math.PI * 2;
    let a = rose.a + detailScale * rose.aBoost;
    let r = a * (rose.breathBase + detailScale * rose.breathBoost) * Math.cos(3 * t);
    return {
      x: 50 + Math.cos(t) * r * rose.scale,
      y: 50 + Math.sin(t) * r * rose.scale
    };
  }
};

function normalizeProgress(progress) {
  return ((progress % 1) + 1) % 1;
}

export default {
  name: 'LoadingIcon',
  mounted() {
    this.particles = Array.from({length: rose.particleCount}, () => {
      let circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('fill', 'currentColor');
      this.$refs.group.appendChild(circle);
      return circle;
    });
    this.$refs.path.setAttribute('stroke-width', String(rose.strokeWidth));
    this.startedAt = performance.now();
    this.step();
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frame);
  },
  methods: {
    step() {
      this.frame = requestAnimationFrame(now => {
        let time = now - this.startedAt;
        let progress = (time % rose.durationMs) / rose.durationMs;
        let detailScale = this.getDetailScale(time);
        let rotation = -((time % rose.rotationDurationMs) / rose.rotationDurationMs) * 360;

        this.$refs.group.setAttribute('transform', `rotate(${rotation} 50 50)`);
        this.$refs.path.setAttribute('d', this.buildPath(detailScale));

        this.particles.forEach((node, index) => {
          let tailOffset = index / (rose.particleCount - 1);
          let point = rose.point(normalizeProgress(progress - tailOffset * rose.trailSpan), detailScale);
          let fade = Math.pow(1 - tailOffset, 0.56);
          node.setAttribute('cx', point.x.toFixed(2));
          node.setAttribute('cy', point.y.toFixed(2));
          node.setAttribute('r', (0.9 + fade * 2.7).toFixed(2));
          node.setAttribute('opacity', (0.04 + fade * 0.96).toFixed(3));
        });

        this.step();
      });
    },
    getDetailScale(time) {
      let pulseProgress = (time % rose.pulseDurationMs) / rose.pulseDurationMs;
      let pulseAngle = pulseProgress * Math.PI * 2;
      return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
    },
    buildPath(detailScale, steps = 120) {
      return Array.from({length: steps + 1}, (_, index) => {
        let point = rose.point(index / steps, detailScale);
        return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }).join(' ');
    }
  }
}
</script>
