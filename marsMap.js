// MARSWALK - Interactive Mars GIS Map Engine (Jezero Crater Tactical Surface View)
import { JEZERO_CENTER, MARS_LANDMARKS, PERSEVERANCE_TRAVERSE, SCIENCE_TARGETS, HAZARDS, GEOLOGY_REGIONS } from './marsData.js';
import { sounds } from './soundEffects.js';

export class MarsMap {
  constructor(canvasId, layerControl, onSelectTarget) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.layerControl = layerControl;
    this.onSelectTarget = onSelectTarget;

    // Viewport transform (pan & zoom)
    this.scale = 1.15;
    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;

    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Hovered and selected entities
    this.hoveredEntity = null;
    this.selectedEntity = null;

    // Active planned route (will be populated by RoutePlanner in Phase 3)
    this.activeRoute = null;

    // Animation ticker for weather & pulses
    this.animTime = 0;

    this.initEvents();
    this.resize();
    this.centerOnJezero();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const previousWidth = this.width || 0;
    const previousHeight = this.height || 0;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;

    if (!previousWidth || !previousHeight) {
      this.centerOnJezero();
      return;
    }

    const offsetX = (this.width - previousWidth) / 2;
    const offsetY = (this.height - previousHeight) / 2;
    this.panX += offsetX;
    this.panY += offsetY;
    this.targetPanX += offsetX;
    this.targetPanY += offsetY;
  }

  centerOnJezero() {
    // Focus near delta and landing base
    this.panX = this.width / 2 + 120;
    this.panY = this.height / 2 + 30;
    this.targetPanX = this.panX;
    this.targetPanY = this.panY;
    this.scale = 1.25;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    // Pointer input supports mouse, pen, and touch.
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.activePointerId = e.pointerId;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.dragDistance = 0;
      this.canvas.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isDragging && e.pointerId === this.activePointerId) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.dragDistance += Math.hypot(dx, dy);
        this.panX += dx;
        this.panY += dy;
        this.targetPanX = this.panX;
        this.targetPanY = this.panY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }

      if (e.pointerType !== 'mouse') return;
      // Calculate Martian Lat/Lon under cursor
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (!this.isDragging && mouseX >= 0 && mouseX <= this.width && mouseY >= 0 && mouseY <= this.height) {
        this.updateCoordsHUD(mouseX, mouseY);
        this.checkHover(mouseX, mouseY);
      }
    });

    this.canvas.addEventListener('pointerup', () => {
      this.isDragging = false;
      this.activePointerId = null;
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.isDragging = false;
      this.activePointerId = null;
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.max(0.5, Math.min(3.8, this.scale * zoomFactor));

      // Zoom towards mouse pointer
      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.targetPanX = this.panX;
      this.targetPanY = this.panY;
      this.scale = newScale;
    }, { passive: false });

    // Click to select
    this.canvas.addEventListener('click', (e) => {
      if (this.dragDistance > 8) {
        this.dragDistance = 0;
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleClick(mouseX, mouseY);
    });

    // Zoom Buttons
    const btnIn = document.getElementById('map-zoom-in');
    const btnOut = document.getElementById('map-zoom-out');
    const btnReset = document.getElementById('map-reset-view');

    if (btnIn) {
      btnIn.addEventListener('click', () => {
        sounds.playClick();
        this.scale = Math.min(3.8, this.scale * 1.25);
      });
    }
    if (btnOut) {
      btnOut.addEventListener('click', () => {
        sounds.playClick();
        this.scale = Math.max(0.5, this.scale * 0.8);
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        sounds.playPing();
        this.centerOnJezero();
      });
    }

    // Search bar
    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.searchLocation(searchInput.value);
        }
      });
    }
  }

  searchLocation(query) {
    const q = query.toLowerCase().trim();
    const match = MARS_LANDMARKS.find((lm) => lm.name.toLowerCase().includes(q)) ||
                  SCIENCE_TARGETS.find((st) => st.name.toLowerCase().includes(q));

    if (match) {
      sounds.playPing();
      this.panToPoint(match.x, match.y);
      if (this.onSelectTarget) this.onSelectTarget(match);
    }
  }

  panToPoint(worldX, worldY) {
    this.targetPanX = this.width / 2 - worldX * this.scale;
    this.targetPanY = this.height / 2 - worldY * this.scale;
  }

  updateCoordsHUD(screenX, screenY) {
    // World coordinates
    const worldX = (screenX - this.panX) / this.scale;
    const worldY = (screenY - this.panY) / this.scale;

    // Convert world px to Jezero lat/lon (1px ~ 15 meters)
    // Center is (0,0) -> 18.384° N, 77.581° E
    const lat = JEZERO_CENTER.lat - (worldY * 0.00028);
    const lon = JEZERO_CENTER.lon + (worldX * 0.00028);
    const elev = Math.round(JEZERO_CENTER.elevation + Math.sin(worldX * 0.01) * 80 + (worldY < -100 ? 140 : 0));

    const hudCoords = document.querySelector('.map-coords-hud');
    if (hudCoords) {
      hudCoords.innerHTML = `
        <span>LAT: ${lat.toFixed(4)}° N</span>
        <span>LON: ${lon.toFixed(4)}° E</span>
        <span>ELEV: ${elev.toLocaleString()} m</span>
      `;
    }
  }

  checkHover(screenX, screenY) {
    const worldX = (screenX - this.panX) / this.scale;
    const worldY = (screenY - this.panY) / this.scale;

    let found = null;

    // Check science targets
    for (const st of SCIENCE_TARGETS) {
      if (Math.hypot(st.x - worldX, st.y - worldY) < 16) {
        found = { type: 'science', data: st };
        break;
      }
    }

    // Check hazards
    if (!found) {
      for (const haz of HAZARDS) {
        if (Math.hypot(haz.x - worldX, haz.y - worldY) < 16) {
          found = { type: 'hazard', data: haz };
          break;
        }
      }
    }

    // Check landmarks
    if (!found) {
      for (const lm of MARS_LANDMARKS) {
        if (Math.hypot(lm.x - worldX, lm.y - worldY) < 18) {
          found = { type: 'landmark', data: lm };
          break;
        }
      }
    }

    this.hoveredEntity = found;
    this.canvas.style.cursor = found ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
  }

  handleClick(screenX, screenY) {
    const worldX = (screenX - this.panX) / this.scale;
    const worldY = (screenY - this.panY) / this.scale;

    // Find clicked entity
    let clicked = null;
    for (const st of SCIENCE_TARGETS) {
      if (Math.hypot(st.x - worldX, st.y - worldY) < 18) {
        clicked = st;
        break;
      }
    }
    if (!clicked) {
      for (const haz of HAZARDS) {
        if (Math.hypot(haz.x - worldX, haz.y - worldY) < 18) {
          clicked = haz;
          break;
        }
      }
    }
    if (!clicked) {
      for (const lm of MARS_LANDMARKS) {
        if (Math.hypot(lm.x - worldX, lm.y - worldY) < 20) {
          clicked = lm;
          break;
        }
      }
    }

    if (clicked) {
      sounds.playClick();
      this.selectedEntity = clicked;
      if (this.onSelectTarget) {
        this.onSelectTarget(clicked);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Smooth pan transition
    this.panX += (this.targetPanX - this.panX) * 0.15;
    this.panY += (this.targetPanY - this.panY) * 0.15;

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // 1. Terrain Layer
    if (this.layerControl.isLayerActive('terrain')) {
      this.drawTerrain(ctx);
    }

    // 2. Geological Units
    if (this.layerControl.isLayerActive('geology')) {
      this.drawGeology(ctx);
    }

    // 3. Elevation Contours
    if (this.layerControl.isLayerActive('elevation')) {
      this.drawElevationContours(ctx);
    }

    // 4. Orbital HiRISE Layer
    if (this.layerControl.isLayerActive('orbital')) {
      this.drawOrbitalImagery(ctx);
    }

    // 5. Water / Ice Evidence
    if (this.layerControl.isLayerActive('waterIce')) {
      this.drawWaterIceEvidence(ctx);
    }

    // 6. Impact Craters & Rim
    if (this.layerControl.isLayerActive('craters')) {
      this.drawCraters(ctx);
    }

    // 7. Radiation Layer
    if (this.layerControl.isLayerActive('radiation')) {
      this.drawRadiationLayer(ctx);
    }

    // 8. Rover Traverses
    if (this.layerControl.isLayerActive('traverses')) {
      this.drawTraverses(ctx);
    }

    // 9. Active Rover Position & Telemetry
    if (this.layerControl.isLayerActive('roverLocation')) {
      this.drawRoverLocation(ctx);
    }

    // 10. Hazards Layer
    this.drawHazards(ctx);

    // 10.5 Active Planned Route
    if (this.activeRoute) {
      this.drawActiveRoute(ctx);
    }

    // 11. Science Targets
    if (this.layerControl.isLayerActive('scienceTargets')) {
      this.drawScienceTargets(ctx);
    }

    // 12. Weather & Dust Front
    if (this.layerControl.isLayerActive('weather')) {
      this.drawWeatherLayer(ctx);
    }

    // Landmarks / Bases
    this.drawLandmarks(ctx);

    ctx.restore();

    // Map Scale Bar (Screen overlay)
    this.drawScaleBar(ctx);
  }

  setActiveRoute(route) {
    this.activeRoute = route;
  }

  drawActiveRoute(ctx) {
    const route = this.activeRoute;
    if (!route || !route.waypoints || route.waypoints.length < 2) return;

    const wps = route.waypoints;
    const time = this.animTime;

    ctx.save();

    // Outer trajectory glow
    ctx.strokeStyle = route.color;
    ctx.shadowColor = route.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    wps.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Sharp inner line with animated directional dash
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 4;
    ctx.lineWidth = 3;
    ctx.strokeStyle = route.color;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -time * 20;

    ctx.beginPath();
    wps.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Draw waypoints
    wps.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === wps.length - 1;

      if (isStart) {
        // Start flag node
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6ee7b7';
        ctx.font = '700 11px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('START', wp.x, wp.y - 10);
      } else if (isEnd) {
        // Destination target node
        ctx.fillStyle = '#e2583e';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff7a45';
        ctx.font = '700 11px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('DESTINATION', wp.x, wp.y - 14);
      } else {
        // Intermediary waypoint
        ctx.fillStyle = route.color;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  drawTerrain(ctx) {
    // Jezero Crater Floor & Basin Shaded Relief
    const bgGrad = ctx.createRadialGradient(-200, -50, 50, -200, -50, 750);
    bgGrad.addColorStop(0, '#1c1518');
    bgGrad.addColorStop(0.3, '#171114');
    bgGrad.addColorStop(0.65, '#120d10');
    bgGrad.addColorStop(0.9, '#261314'); // Crater rim wall
    bgGrad.addColorStop(1, '#0e090b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-1000, -1000, 2000, 2000);

    // Jezero Western Crater Rim Arc
    ctx.strokeStyle = 'rgba(226, 88, 62, 0.45)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(-200, -50, 680, Math.PI * 0.72, Math.PI * 1.35);
    ctx.stroke();

    // Neretva Vallis breach channel cutting through rim
    ctx.strokeStyle = '#120d10';
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(-680, -360);
    ctx.bezierCurveTo(-580, -320, -520, -260, -420, -180);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(-680, -360);
    ctx.bezierCurveTo(-580, -320, -520, -260, -420, -180);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawGeology(ctx) {
    GEOLOGY_REGIONS.forEach((region) => {
      ctx.fillStyle = region.color;
      ctx.strokeStyle = region.borderColor;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      region.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Label at centroid
      const cx = region.points.reduce((acc, p) => acc + p.x, 0) / region.points.length;
      const cy = region.points.reduce((acc, p) => acc + p.y, 0) / region.points.length;
      ctx.fillStyle = region.borderColor;
      ctx.font = '600 10px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(region.name, cx, cy);
    });
  }

  drawElevationContours(ctx) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.font = '9px Rajdhani';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';

    const contours = [
      { r: 240, elev: '-2560m' },
      { r: 380, elev: '-2500m' },
      { r: 520, elev: '-2420m' },
      { r: 640, elev: '-2280m' }
    ];

    contours.forEach((c) => {
      ctx.beginPath();
      ctx.arc(-200, -50, c.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(c.elev, -200 + c.r - 20, -50);
    });
  }

  drawOrbitalImagery(ctx) {
    // HiRISE Sub-meter textural overlay simulation
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.8;
    for (let x = -600; x <= 400; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, -500);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = -500; y <= 500; y += 60) {
      ctx.beginPath();
      ctx.moveTo(-600, y);
      ctx.lineTo(400, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWaterIceEvidence(ctx) {
    // Ancient lake shoreline & hydrated clay clusters
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);

    ctx.beginPath();
    ctx.arc(-200, -50, 480, Math.PI * 0.8, Math.PI * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Water indicators
    const points = [
      { x: -350, y: -130, label: 'Paleo-Shoreline Clays' },
      { x: -270, y: -160, label: 'Hydrated Carbonate' },
      { x: -440, y: -240, label: 'Lacustrine Sediments' }
    ];

    points.forEach((pt) => {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px Rajdhani';
      ctx.textAlign = 'left';
      ctx.fillText(`💧 ${pt.label}`, pt.x + 8, pt.y + 4);
    });
  }

  drawCraters(ctx) {
    // Belva Crater
    ctx.strokeStyle = 'rgba(226, 88, 62, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-430, -230, 45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff7a45';
    ctx.font = '600 11px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText('Belva Crater', -430, -282);

    // Kodiak Butte remnant
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-245, -40, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Kodiak Butte', -245, -64);
  }

  drawRadiationLayer(ctx) {
    // Radiation hazard overlay
    const radGrad = ctx.createRadialGradient(-300, 100, 20, -300, 100, 260);
    radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
    radGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.12)');
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(-600, -200, 600, 600);
  }

  drawTraverses(ctx) {
    // Perseverance ground traverse line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    PERSEVERANCE_TRAVERSE.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Sol milestone dots
    PERSEVERANCE_TRAVERSE.forEach((pt) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawRoverLocation(ctx) {
    // Current Perseverance Rover Location (Belva Overlook)
    const cur = PERSEVERANCE_TRAVERSE[PERSEVERANCE_TRAVERSE.length - 1];
    const pulse = (Math.sin(this.animTime * 4) + 1) * 0.5;

    // Pulse wave
    ctx.strokeStyle = 'rgba(255, 122, 69, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 8 + pulse * 14, 0, Math.PI * 2);
    ctx.stroke();

    // Rover icon
    ctx.fillStyle = '#ff7a45';
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Rajdhani';
    ctx.textAlign = 'left';
    ctx.fillText('PERSEVERANCE (ACTIVE)', cur.x + 12, cur.y + 4);
  }

  drawHazards(ctx) {
    HAZARDS.forEach((haz) => {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1.5;

      // Hazard badge
      ctx.beginPath();
      ctx.arc(haz.x, haz.y, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(haz.x, haz.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fca5a5';
      ctx.font = '600 10px Rajdhani';
      ctx.textAlign = 'left';
      ctx.fillText(`⚠️ ${haz.code}`, haz.x + 9, haz.y + 3);
    });
  }

  drawScienceTargets(ctx) {
    const pulse = (Math.sin(this.animTime * 3) + 1) * 0.5;

    SCIENCE_TARGETS.forEach((st) => {
      // Glow
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 8 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      // Center
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '700 11px Rajdhani';
      ctx.textAlign = 'left';
      ctx.fillText(`🟣 ${st.code}: ${st.name.substring(0, 18)}...`, st.x + 10, st.y + 4);
    });
  }

  drawWeatherLayer(ctx) {
    // Dynamic wind vectors & dust opacity
    const offset = (this.animTime * 40) % 180;
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 1.2;

    for (let x = -450; x < 200; x += 140) {
      for (let y = -300; y < 200; y += 120) {
        const wx = x + offset;
        const wy = y + offset * 0.4;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 22, wy + 9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawLandmarks(ctx) {
    MARS_LANDMARKS.forEach((lm) => {
      if (lm.id === 'landing_site') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#6ee7b7';
        ctx.font = '700 11px Rajdhani';
        ctx.textAlign = 'left';
        ctx.fillText(`🚩 ${lm.name}`, lm.x + 10, lm.y + 4);
      }
    });
  }

  drawScaleBar(ctx) {
    const barWidthPx = 100 * this.scale;
    const distanceKm = (100 * 0.015).toFixed(1); // 100px ~ 1.5 km

    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 23, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(20, this.height - 40, 130, 24);
    ctx.strokeRect(20, this.height - 40, 130, 24);

    ctx.fillStyle = 'var(--cyan-telemetry)';
    ctx.font = '600 10px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(`SCALE: ~${distanceKm} km`, 85, this.height - 24);
    ctx.restore();
  }

  animate() {
    this.animTime += 0.02;
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}
