// Mars 3D Procedural Canvas Globe with Atmospheric Glow, Orbital Trajectories & Sites
export class MarsGlobe {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.rotationY = 0.8;
    this.rotationX = 0.35;
    this.autoRotateSpeed = 0.003;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.selectedSite = null;

    // Mars surface landmarks (lat, lon in radians, label, desc)
    this.sites = [
      {
        id: 'jezero',
        name: 'Jezero Crater',
        lat: 18.38 * (Math.PI / 180),
        lon: 77.58 * (Math.PI / 180),
        desc: 'Perseverance Rover & Delta deposit exploration site.',
        coords: '18.38°N, 77.58°E'
      },
      {
        id: 'gale',
        name: 'Gale Crater',
        lat: -4.59 * (Math.PI / 180),
        lon: 137.44 * (Math.PI / 180),
        desc: 'Curiosity Rover exploration of Mount Sharp lacustrine layers.',
        coords: '4.59°S, 137.44°E'
      },
      {
        id: 'olympus',
        name: 'Olympus Mons',
        lat: 18.65 * (Math.PI / 180),
        lon: -133.8 * (Math.PI / 180),
        desc: 'Largest shield volcano in the Solar System (21.9 km peak).',
        coords: '18.65°N, 133.80°W'
      },
      {
        id: 'valles',
        name: 'Valles Marineris',
        lat: -14.0 * (Math.PI / 180),
        lon: -59.2 * (Math.PI / 180),
        desc: 'Vast canyon system stretching over 4,000 km across Mars.',
        coords: '14.00°S, 59.20°W'
      }
    ];

    this.initEvents();
    this.resize();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.radius = Math.min(this.width, this.height) * 0.38;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.dragDistance = 0;
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.dragDistance += Math.hypot(dx, dy);
      this.rotationY += dx * 0.008;
      this.rotationX = Math.max(-0.8, Math.min(0.8, this.rotationX + dy * 0.008));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    this.canvas.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.dragDistance > 8) {
        this.dragDistance = 0;
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left - this.width / 2;
      const clickY = e.clientY - rect.top - this.height / 2;

      // Check if clicked close to any site marker
      let clickedSite = null;
      for (const site of this.sites) {
        const pt = this.getScreenCoords(site.lat, site.lon);
        if (pt && pt.visible) {
          const dist = Math.hypot(pt.x - clickX, pt.y - clickY);
          if (dist < 18) {
            clickedSite = site;
            break;
          }
        }
      }

      this.selectedSite = clickedSite;
      this.updateSiteCard(clickedSite);
    });
  }

  updateSiteCard(site) {
    const card = document.getElementById('globe-site-card');
    if (!card) return;
    if (site) {
      document.getElementById('globe-site-title').textContent = site.name;
      document.getElementById('globe-site-coords').textContent = site.coords;
      document.getElementById('globe-site-desc').textContent = site.desc;
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  }

  getScreenCoords(lat, lon) {
    const adjustedLon = lon + this.rotationY;
    
    // 3D sphere coordinate
    const x3d = Math.cos(lat) * Math.sin(adjustedLon);
    const y3d = -Math.sin(lat) * Math.cos(this.rotationX) + Math.cos(lat) * Math.cos(adjustedLon) * Math.sin(this.rotationX);
    const z3d = Math.sin(lat) * Math.sin(this.rotationX) + Math.cos(lat) * Math.cos(adjustedLon) * Math.cos(this.rotationX);

    return {
      x: x3d * this.radius,
      y: y3d * this.radius,
      visible: z3d > 0
    };
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const r = this.radius;

    // Atmospheric Outer Glow
    const atmosGlow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
    atmosGlow.addColorStop(0, 'rgba(226, 88, 62, 0.4)');
    atmosGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
    atmosGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = atmosGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Mars Planetary Base Gradient (Sunlight angle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const planetGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    planetGrad.addColorStop(0, '#e86c4f');
    planetGrad.addColorStop(0.4, '#c3482d');
    planetGrad.addColorStop(0.75, '#872715');
    planetGrad.addColorStop(1, '#1b0704');
    ctx.fillStyle = planetGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Simulated Topography & Albedo Features
    this.drawAlbedoBands(cx, cy, r);

    // North & South Polar Ice Caps
    this.drawPolarCaps(cx, cy, r);

    // Coordinate Graticules (Latitude & Longitude grid)
    this.drawGraticule(cx, cy, r);

    // Surface shadow on dark limb
    const shadowGrad = ctx.createRadialGradient(cx + r * 0.45, cy + r * 0.4, r * 0.2, cx, cy, r * 1.05);
    shadowGrad.addColorStop(0, 'transparent');
    shadowGrad.addColorStop(0.65, 'rgba(4, 5, 8, 0.4)');
    shadowGrad.addColorStop(1, 'rgba(4, 5, 8, 0.92)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.restore();

    // Orbital Satellite Vector Ring (MRO orbit)
    this.drawOrbitRing(cx, cy, r);

    // Draw Surface Site Markers
    this.drawSiteMarkers(cx, cy);
  }

  drawAlbedoBands(cx, cy, r) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(75, 20, 10, 0.35)';

    // Synthesize major dark Martian regions (Syrtis Major & Acidalia)
    for (let i = 0; i < 6; i++) {
      const lat = (i - 2.5) * 0.35;
      const lon = i * 1.05 + 0.5;
      const pt = this.getScreenCoords(lat, lon);
      if (pt.visible) {
        ctx.beginPath();
        ctx.arc(cx + pt.x, cy + pt.y, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPolarCaps(cx, cy, r) {
    const ctx = this.ctx;
    // North polar cap (CO2 + H2O ice)
    const northPt = this.getScreenCoords(82 * (Math.PI / 180), 0);
    if (northPt.visible) {
      const capGrad = ctx.createRadialGradient(cx + northPt.x, cy + northPt.y, 0, cx + northPt.x, cy + northPt.y, r * 0.28);
      capGrad.addColorStop(0, '#ffffff');
      capGrad.addColorStop(0.7, '#dbeafe');
      capGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.arc(cx + northPt.x, cy + northPt.y, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGraticule(cx, cy, r) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Latitudes (-60, -30, 0, 30, 60)
    [-60, -30, 0, 30, 60].forEach((latDeg) => {
      ctx.beginPath();
      let first = true;
      const lat = latDeg * (Math.PI / 180);
      for (let lonDeg = 0; lonDeg <= 360; lonDeg += 10) {
        const lon = lonDeg * (Math.PI / 180);
        const pt = this.getScreenCoords(lat, lon);
        if (pt.visible) {
          if (first) {
            ctx.moveTo(cx + pt.x, cy + pt.y);
            first = false;
          } else {
            ctx.lineTo(cx + pt.x, cy + pt.y);
          }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    });
  }

  drawOrbitRing(cx, cy, r) {
    const ctx = this.ctx;
    const time = Date.now() * 0.001;

    // Orbit ellipse
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.45, r * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Satellite (MRO)
    const satAngle = time * 0.8;
    const satX = Math.cos(satAngle) * r * 1.45;
    const satY = Math.sin(satAngle) * r * 0.48;

    // Satellite Dot
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(satX, satY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Satellite Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Rajdhani';
    ctx.fillText('MRO (ORBITAL)', satX + 6, satY - 6);

    ctx.restore();
  }

  drawSiteMarkers(cx, cy) {
    const ctx = this.ctx;
    const time = Date.now() * 0.003;

    this.sites.forEach((site) => {
      const pt = this.getScreenCoords(site.lat, site.lon);
      if (pt.visible) {
        const x = cx + pt.x;
        const y = cy + pt.y;

        // Pulsing ring
        const pulse = (Math.sin(time) + 1) * 0.5;
        ctx.strokeStyle = site.id === 'jezero' ? 'rgba(255, 122, 69, 0.8)' : 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 6 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = site.id === 'jezero' ? '#ff7a45' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Site text label
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 11px Rajdhani';
        ctx.fillText(site.name, x + 8, y + 4);
      }
    });
  }

  animate() {
    if (!this.isDragging) {
      this.rotationY += this.autoRotateSpeed;
    }
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}
