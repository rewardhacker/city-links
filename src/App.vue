<template>
  <find-place v-if='!placeFound' @loaded='onGridLoaded'></find-place>
  <div id="app">
    <div v-if='placeFound'>
      <div class='site-nav'>
        <a href='#' class='nav-brand' @click.prevent='startOver'>
          <span class='nav-name'>city links</span>
        </a>
        <div class='nav-links'>
          <div class='nav-item' :class='{"sub-open": showSettings}'>
            <a href="#" class='print-button' :class='{active: showSettings}' @click.prevent='toggleSettings'>Customize</a>
          </div>
          <a href="#" class='try-another' @click.prevent='startOver'>Try another city</a>
        </div>
      </div>
      <div v-if='showSettings' class='print-window'>
        <h3>Palettes</h3>
        <div class='row palettes'>
          <a href='#' v-for='p in palettes' :key='p.name' class='palette-swatch' :title='p.name' :aria-label='p.name + " palette"'
             @click.prevent='applyPalette(p)' :style='{background: p.background, borderColor: p.line}'>
            <span :style='{background: p.line}'></span>
          </a>
        </div>

        <h3>Animation</h3>
        <div class='row'>
          <label class='col' for='animate-roads'>Animate roads connecting</label>
          <div class='col c-2'>
            <div class='checkbox-wrapper-9'>
              <input class='tgl tgl-flat' id='animate-roads' type='checkbox' v-model='animateRoads' @change='saveAnimationPrefs'>
              <label class='tgl-btn' for='animate-roads'></label>
            </div>
          </div>
        </div>
        <div class='row' v-if='animateRoads'>
          <label class='col' for='connect-time'>Connect time</label>
          <div class='col c-2'>
            <input id='connect-time' type='range' min='300' max='3000' step='100' v-model.number='animationSpeed' @change='saveAnimationPrefs'>
            <span class='duration-label'>{{(animationSpeed/1000).toFixed(1)}}s</span>
          </div>
        </div>
        <div class='row' v-if='animateRoads'>
          <label class='col' for='reveal-order'>Reveal order</label>
          <div class='col c-2'>
            <select id='reveal-order' v-model='revealOrder' @change='saveAnimationPrefs'>
              <option value='original'>Original</option>
              <option value='center-out'>Center out</option>
              <option value='outside-in'>Outside in</option>
              <option value='random'>Random</option>
            </select>
          </div>
        </div>
        <div class='row'>
          <a href='#' @click.prevent='replayAnimation' class='col'>Replay</a>
          <span class='col c-2'>
            Re-run the reveal with the current settings on this city.
          </span>
        </div>

        <h3>Display</h3>
        <div class='row'>
          <div class='col'>Colors</div>
          <div class='col colors c-2'>
            <div v-for='layer in layers' :key='layer.name' class='color-container'>
              <color-picker v-model='layer.color' @change='layer.changeColor'></color-picker>
              <div class='color-label'>{{layer.name}}</div>
            </div>
          </div>
        </div>

        <h3>Export</h3>
        <div class='row'>
          <a href='#' @click.prevent='zazzleMugPrint()' class='col'>Onto a mug</a> 
          <span class='col c-2'>
            Print what you see onto a mug. <br/>Get a unique gift of your favorite city.
          </span>
        </div>
        <div class='preview-actions message' v-if='zazzleLink || generatingPreview'>
            <div v-if='zazzleLink' class='padded popup-help'>
              If your browser has blocked the new window, <br/>please <a :href='zazzleLink' target='_blank'>click here</a>
              to open it.
            </div>
            <div v-if='generatingPreview' class='loading-container'>
              <loading-icon></loading-icon>
              Generating preview url...
            </div>
        </div>
        <div class='row'>
          <a href='#'  @click.prevent='toPNGFile' class='col'>As an image (.png)</a> 
          <span class='col c-2'>
            Save the current screen as a raster image.
          </span>
        </div>
        
        <div class='row'>
          <a href='#'  @click.prevent='toSVGFile' class='col'>As a vector (.svg)</a>
          <span class='col c-2'>
            Save the current screen as a vector image.
          </span>
        </div>
        <div class='row'>
          <a href='#' @click.prevent='exportAnimation' class='col'>{{exportingAnimation ? 'Recording...' : 'As a video (.webm)'}}</a>
          <span class='col c-2'>
            Record the reveal animation and save it as a video.
          </span>
        </div>
        <div v-if='false' class='row'>
          <a href='#' @click.prevent='toProtobuf' class='col'>To a .PBF file</a> 
          <span class='col c-2'>
            Save the current data as a protobuf message. For developer use only.
          </span>
        </div>

        <h3>About</h3>
        <div>
          <p>This website was created by <a href='https://instagram.com/localponders' target='_blank'>@localponders</a>.
          It downloads roads from OpenStreetMap and renders them with WebGL. Visit <a href='https://jakadin.com' target='_blank'>jakadin.com</a> for more.
          </p>
          <p>
           You can find the entire <a href='https://github.com/rewardhacker'>source code here</a>.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div v-if='placeFound' class='bottom-bar'>
    <div class='license printable can-drag' :style='{color: labelColorRGBA}'>data <a href='https://www.openstreetmap.org/about/' target="_blank" :style='{color: labelColorRGBA}'>© OpenStreetMap</a></div>
    <editable-label v-model='name' class='city-name' :printable='true' :style='{color: labelColorRGBA}' :overlay-manager='overlayManager'></editable-label>
  </div>
</template>

<script>
import FindPlace from './components/FindPlace.vue';
import LoadingIcon from './components/LoadingIcon.vue';
import EditableLabel from './components/EditableLabel.vue';
import ColorPicker from './components/ColorPicker.vue';
import createScene from './lib/createScene.js';
import GridLayer from './lib/GridLayer.js';
import generateZazzleLink from './lib/getZazzleLink.js';
import appState from './lib/appState.js';
import {getPrintableCanvas, getCanvas} from './lib/saveFile.js';
import config from './config.js';
import palettes from './palettes.js';
import './lib/canvas2BlobPolyfill.js';
import bus from './lib/bus.js';
import createOverlayManager from './createOverlayManager.js';
import tinycolor from 'tinycolor2';

class ColorLayer {
  constructor(name, color, callback) {
    this.name = name;
    this.changeColor = callback;
    this.color = color;
  }
}

export default {
  name: 'App',
  components: {
    FindPlace,
    LoadingIcon,
    EditableLabel,
    ColorPicker
  },
  data() {
    return {
      placeFound: false,
      name: '',
      zazzleLink: null,
      generatingPreview: false,
      showSettings: false,
      settingsOpen: false,
      labelColor: config.getLabelColor().toRgb(),
      backgroundColor: config.getBackgroundColor().toRgb(),
      layers: [],
      palettes,
      animateRoads: localStorage.getItem('animateRoads')
        ? localStorage.getItem('animateRoads') !== 'false'
        : !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationSpeed: Number.parseInt(localStorage.getItem('animationSpeed'), 10) || 1200,
      revealOrder: localStorage.getItem('revealOrder') || 'original',
      exportingAnimation: false
    }
  },
  computed: {
    labelColorRGBA() {
      return toRGBA(this.labelColor);
    }
  },
  created() {
    bus.on('scene-transform', this.handleSceneTransform);
    bus.on('background-color', this.syncBackground);
    bus.on('line-color', this.syncLineColor);
    this.overlayManager = createOverlayManager();
  },
  beforeUnmount() {
    debugger;
    this.overlayManager.dispose();
    this.dispose();
    bus.off('scene-transform', this.handleSceneTransform);
    bus.off('background-color', this.syncBackground);
    bus.off('line-color', this.syncLineColor);
  },
  methods: {
    dispose() {
      if (this.scene) {
        this.scene.dispose();
        window.scene = null;
      }
      this.gridLayer = null;
    },
    toggleSettings() {
      this.showSettings = !this.showSettings;
    },
    handleSceneTransform() {
      this.zazzleLink = null;
    },
    onGridLoaded(grid) {
      if (grid.isArea) {
        appState.set('areaId', grid.id);
        appState.unset('osm_id');
        appState.unset('bbox');
      } else if (grid.bboxString) {
        appState.unset('areaId');
        appState.set('osm_id', grid.id);
        appState.set('bbox', grid.bboxString);
      }
      this.placeFound = true;
      this.name = grid.name.split(',')[0];
      let canvas = getCanvas();
      canvas.style.visibility = 'visible';

      this.scene = createScene(canvas);
      this.scene.on('layer-added', this.updateLayers);
      this.scene.on('layer-removed', this.updateLayers);

      window.scene = this.scene;

      let gridLayer = new GridLayer();
      gridLayer.id = 'lines';
      gridLayer.animated = this.animateRoads;
      gridLayer.animationDuration = this.animationSpeed;
      gridLayer.revealOrder = this.revealOrder;
      gridLayer.setGrid(grid);
      this.scene.add(gridLayer)
      this.gridLayer = gridLayer;
    },

    saveAnimationPrefs() {
      localStorage.setItem('animateRoads', this.animateRoads);
      localStorage.setItem('animationSpeed', this.animationSpeed);
      localStorage.setItem('revealOrder', this.revealOrder);
    },

    replayAnimation() {
      if (!this.gridLayer) return;
      this.gridLayer.animated = this.animateRoads;
      this.gridLayer.animationDuration = this.animationSpeed;
      this.gridLayer.revealOrder = this.revealOrder;
      this.gridLayer.replay();
    },

    exportAnimation() {
      if (!this.gridLayer || this.exportingAnimation) return;
      let canvas = getCanvas();
      if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
        this.error = new Error('Your browser does not support recording video.');
        return;
      }

      this.exportingAnimation = true;
      let stream = canvas.captureStream(30);
      let recorder = new MediaRecorder(stream, {mimeType: 'video/webm'});
      let chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        let blob = new Blob(chunks, {type: 'video/webm'});
        let url = window.URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = (this.name || 'city-links') + '.webm';
        a.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 45000);
        this.exportingAnimation = false;
      };

      recorder.start();
      this.gridLayer.replay({
        animated: true,
        duration: this.animationSpeed,
        // small buffer after the reveal finishes so the final frame is captured
        onComplete: () => setTimeout(() => recorder.stop(), 300)
      });
    },

    startOver() {
      appState.unset('areaId');
      appState.unsetPlace();
      appState.unset('q');
      appState.enableCache();

      this.dispose();
      this.placeFound = false;
      this.zazzleLink = null;
      this.showSettings = false;
      this.backgroundColor = config.getBackgroundColor().toRgb();
      this.labelColor = config.getLabelColor().toRgb();

      document.body.style.backgroundColor = config.getBackgroundColor().toRgbString();
      getCanvas().style.visibility = 'hidden';
    },

    toPNGFile(e) {
      scene.saveToPNG(this.name)
    },

    toSVGFile(e) { 
      scene.saveToSVG(this.name)
    },

    updateLayers() {
      // TODO: This method likely doesn't belong here
      let newLayers = [];
      let lastLayer = 0;
      let renderer = this.scene.getRenderer();
      let root = renderer.getRoot();
      root.children.forEach(layer => {
        if (!layer.color) return;
        let name = layer.id;
        if (!name) {
          lastLayer += 1;
          name = 'lines ' + lastLayer;
        }
        let layerColor = tinycolor.fromRatio(layer.color);
        newLayers.push(new ColorLayer(name, layerColor, newColor => {
          this.zazzleLink = null;
          layer.color = toRatioColor(newColor);
          renderer.renderFrame();
          this.scene.fire('color-change', layer);
        }));
      });

      newLayers.push(
        new ColorLayer('background', this.backgroundColor, this.setBackgroundColor),
        new ColorLayer('labels', this.labelColor, newColor => this.labelColor = newColor)
      );

      this.layers = newLayers;

      function toRatioColor(c) {
        return {r: c.r/0xff, g: c.g/0xff, b: c.b/0xff, a: c.a}
      }
      this.zazzleLink = null;
    },

    syncLineColor() {
      this.updateLayers();
    },

    syncBackground(newBackground) {
      this.backgroundColor = newBackground.toRgb();
      this.updateLayers()
    },
    // TODO: I need two background methods?
    updateBackground() {
      this.setBackgroundColor(this.backgroundColor)
      this.zazzleLink = null;
    },
    setBackgroundColor(c) {
      this.scene.background = c;
      document.body.style.backgroundColor = toRGBA(c);
      this.zazzleLink = null;
    },

    applyPalette(p) {
      this.backgroundColor = tinycolor(p.background).toRgb();
      this.updateBackground();
      this.labelColor = tinycolor(p.label).toRgb();
      let lineColor = tinycolor(p.line).toRgb();
      this.layers.forEach(layer => {
        if (layer.name === 'background' || layer.name === 'labels') return;
        layer.changeColor(lineColor);
      });
    },

    zazzleMugPrint() {
      if (this.zazzleLink) {
        window.open(this.zazzleLink, '_blank');
        recordOpenClick(this.zazzleLink);
        return;
      }

      this.generatingPreview = true;
      getPrintableCanvas(this.scene).then(printableCanvas => {
        generateZazzleLink(printableCanvas).then(link => {
          this.zazzleLink = link;
          window.open(link, '_blank');
          recordOpenClick(link);
          this.generatingPreview = false;
        }).catch(e => {
          this.error = e;
          this.generatingPreview = false;
        });
      });
    }
  }
}

function toRGBA(c) {
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function recordOpenClick(link) {
  if (typeof gtag === 'undefined') return;

  gtag('event', 'click', {
    'event_category': 'Outbound Link',
    'event_label': link
  });
}
</script>

<style lang='stylus'>
@import('./vars.styl');

#app {
  margin: 8px;
  max-height: 100vh;
  position: absolute;
  z-index: 1;
  h3 {
    font-weight: normal;
  }
}

.can-drag {
  border: 1px solid transparent;
}

.drag-overlay {
  position: fixed;
  background: transparent;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

.overlay-active {
  border: 1px dashed highlight-color;
}
.overlay-active.exclusive {
  border-style: solid;
}

.site-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 36px 14px;
  background: emphasis-background;
  border-bottom: 0.5px solid border-color;
}
.nav-brand {
  text-decoration: none;
  border: 0;
  margin: 0;
}
.nav-name {
  font-weight: 400;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: primary-text;
}
.nav-links {
  display: flex;
  gap: 28px;
  align-items: center;

  a {
    text-decoration: none;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.16em;
    color: secondary-color;
    margin: 0;
    border: 0;
    transition: color 0.2s ease;
    &:hover {
      color: highlight-color;
    }
    &.active {
      color: highlight-color;
      font-weight: 700;
    }
  }
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
}

.col {
    display: flex;
    flex: 1;
    select {
      margin-left: 14px;
    }
  }
.row {
  margin-top: 4px;
  display: flex;
  flex-direction: row;
  min-height: 32px;
}
.palettes {
  flex-wrap: wrap;
  .palette-swatch {
    width: 28px;
    height: 28px;
    margin: 2px;
    border: 2px solid;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 3px;
    box-sizing: border-box;
    border-radius: 0;
    span {
      width: 8px;
      height: 8px;
    }
  }
}
.duration-label {
  margin-left: 8px;
  font-size: 12px;
  color: secondary-color;
}
.colors {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .color-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 64px;
  }

  .color-label {
    font-size: 12px;
  }
}

a {
  border: 1px solid transparent;
  margin: -1px;
  text-decoration: none;
  color: highlight-color
}
a:focus {
  border: 1px dashed highlight-color;
  outline: none;
}
.print-window {
  position: fixed;
  top: 64px;
  right: 36px;
  z-index: 20;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  border: 0.5px solid border-color;
  background: rgba(7,7,15,0.97);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  width: desktop-controls-width;
  padding: 8px;
  .row a {
    margin-right: 4px;
  }

  h3 {
    margin: 8px 0;
    text-align: right;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: secondary-color;
  }
}

.message {
  border-top: 0.5px solid border-color
  border-bottom: 0.5px solid border-color
  background: rgba(232,228,223,0.05);
}

.preview-actions {
  display: flex;
  padding: 8px 0;
  margin-left: -8px;
  margin-bottom: 14px;
  margin-top: 1px;
  width: desktop-controls-width;
  flex-direction: column;
  align-items: stretch;
  font-size: 14px;
  align-items: center;
  display: flex;

  .popup-help {
    text-align: center;
  }
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 12px 36px;
  border-top: 0.5px solid border-color;
  pointer-events: none;
}

.city-name {
  font-size: 24px;
  color: primary-text;
  pointer-events: auto;
  input {
    font-size: 24px;
  }
}

.license {
  text-align: right;
  font-family: labels-font;
  font-size: 12px;
  pointer-events: auto;
  a {
    text-decoration: none;
    display: inline-block;
  }
}

.c-2 {
  flex: 2
}

.checkbox-wrapper-9 {
  .tgl {
    display: none;
  }
  .tgl, .tgl:after, .tgl:before,
  .tgl *, .tgl *:after, .tgl *:before,
  .tgl + .tgl-btn {
    box-sizing: border-box;
  }
  .tgl + .tgl-btn {
    outline: 0;
    display: block;
    width: 2.6em;
    height: 1.3em;
    position: relative;
    cursor: pointer;
    user-select: none;
  }
  .tgl + .tgl-btn:after,
  .tgl + .tgl-btn:before {
    position: relative;
    display: block;
    content: "";
    width: 50%;
    height: 100%;
  }
  .tgl + .tgl-btn:after {
    left: 0;
  }
  .tgl + .tgl-btn:before {
    display: none;
  }
  .tgl:checked + .tgl-btn:after {
    left: 50%;
  }
  .tgl:focus-visible + .tgl-btn {
    outline: 2px solid highlight-color;
    outline-offset: 2px;
  }

  .tgl-flat + .tgl-btn {
    padding: 2px;
    transition: all 0.2s ease;
    background: emphasis-background;
    border: 2px solid border-color;
    border-radius: 2em;
  }
  .tgl-flat + .tgl-btn:after {
    transition: all 0.2s ease;
    background: secondary-color;
    content: "";
    border-radius: 1em;
  }
  .tgl-flat:checked + .tgl-btn {
    border-color: highlight-color;
  }
  .tgl-flat:checked + .tgl-btn:after {
    left: 50%;
    background: highlight-color;
  }
}

@media (max-width: small-screen) {
  #app {
    width: 100%;
    margin: 0;

    .preview-actions,.error,
    .print-window {
      width: 100%;
    }
    .loading-container {
      font-size: 12px;
    }

    .print-window {
      font-size: 14px;
    }

  }
  .site-nav {
    padding: 14px 20px 12px;
  }
  .nav-links {
    gap: 16px;
  }
  .print-window {
    top: 56px;
    right: 0;
  }
  .bottom-bar {
    padding: 8px 12px;
  }
  .city-name {
    font-size: 18px;
    input {
      font-size: 18px;
    }
  }
  .license {
    font-size: 10px;
  }
}

</style>
