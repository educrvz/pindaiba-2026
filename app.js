let map, userMarker, watchId = null, autoCenter = true;
let routeLine, altRouteLine;
const TOTAL_KM = 251.62;
let showAllKm = false;
let kmLabelLayers = [];
let kmDotLayers = [];
let lastProgress = { loaded: 0, total: 0, timestamp: 0 };
let stallTimer = null;

function initMap() {
  const routeCoords = ROUTE_DATA.route.map(p => [p[1], p[0]]);
  const routeBounds = L.latLngBounds(routeCoords);

  map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    maxZoom: 17,
    minZoom: 10,
    maxBounds: routeBounds.pad(0.3),
    maxBoundsViscosity: 0.8
  });

  L.tileLayer('tiles/{z}/{x}/{y}.jpg', {
    maxZoom: 17,
    minZoom: 10,
    tileSize: 256,
    bounds: routeBounds.pad(0.15),
    errorTileUrl: '',
    keepBuffer: 6,
    updateWhenZooming: false,
    updateWhenIdle: true
  }).addTo(map);

  routeLine = L.polyline(routeCoords,
    { color: '#ff4444', weight: 3, opacity: 0.9 }
  ).addTo(map);

  if (ROUTE_DATA.altRoute.length > 0) {
    altRouteLine = L.polyline(
      ROUTE_DATA.altRoute.map(p => [p[1], p[0]]),
      { color: '#ffaa00', weight: 2, opacity: 0.7, dashArray: '8,6' }
    ).addTo(map);
  }

  addKmMarkers();
  addPOIs();

  const mid = Math.floor(routeCoords.length / 2);
  map.setView(routeCoords[mid], 13);
}

function addKmMarkers() {
  kmLabelLayers.forEach(l => map.removeLayer(l));
  kmDotLayers.forEach(l => map.removeLayer(l));
  kmLabelLayers = [];
  kmDotLayers = [];

  ROUTE_DATA.kmMarkers.forEach(m => {
    const isStart = m.km === 0;
    const isEnd = m.km >= 251;
    const isMajor = m.km % 10 === 0;
    const isMinor = m.km % 5 === 0;

    const showLabel = showAllKm
      ? true
      : (isStart || isEnd || isMajor);

    if (showLabel) {
      const label = isStart ? 'INÍCIO' : isEnd ? 'FIM' : `${m.km} km`;
      const fontSize = showAllKm ? (isMajor ? 13 : 10) : (isMajor ? 13 : 11);
      const layer = L.marker([m.lat, m.lon], {
        icon: L.divIcon({
          className: 'km-marker-label',
          html: `<span style="font-size:${fontSize}px">${label}</span>`,
          iconSize: [60, 16],
          iconAnchor: [30, 8]
        })
      }).addTo(map);
      kmLabelLayers.push(layer);
    }

    const radius = showAllKm
      ? (isMajor ? 4 : 2.5)
      : (isMajor ? 4 : isMinor ? 2.5 : 1.5);
    const opacity = showAllKm
      ? (isMajor ? 0.9 : 0.7)
      : (isMajor ? 0.9 : isMinor ? 0.6 : 0.3);

    const dot = L.circleMarker([m.lat, m.lon], {
      radius, fillColor: '#fff', fillOpacity: opacity,
      color: '#fff', weight: 0.5, opacity
    }).addTo(map).on('click', () => {
      showInfo(`<h3>Km ${m.km}</h3><p>Restam ${(TOTAL_KM - m.km).toFixed(1)} km</p>`);
    });
    kmDotLayers.push(dot);
  });
}

function toggleKmDetail() {
  showAllKm = !showAllKm;
  document.getElementById('km-toggle-btn').classList.toggle('active', showAllKm);
  addKmMarkers();
}

function addPOIs() {
  ROUTE_DATA.pois.forEach(poi => {
    L.circleMarker([poi.lat, poi.lon], {
      radius: 7, fillColor: '#ffc832', fillOpacity: 0.9,
      color: '#fff', weight: 2
    }).addTo(map).on('click', () => {
      showInfo(`<h3>${poi.name}</h3><p>${poi.lat.toFixed(5)}, ${poi.lon.toFixed(5)}</p>`);
    });

    L.marker([poi.lat, poi.lon], {
      icon: L.divIcon({
        className: 'poi-label',
        html: poi.name,
        iconSize: [100, 20],
        iconAnchor: [50, -8]
      })
    }).addTo(map);
  });
}

function findNearestKm(lat, lon) {
  let minDist = Infinity, nearest = null;
  ROUTE_DATA.kmMarkers.forEach(m => {
    const d = haversine(lat, lon, m.lat, m.lon);
    if (d < minDist) { minDist = d; nearest = m; }
  });
  return nearest;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findNearestPOI(lat, lon) {
  let minDist = Infinity, nearest = null;
  ROUTE_DATA.pois.forEach(p => {
    const d = haversine(lat, lon, p.lat, p.lon);
    if (d < minDist) { minDist = d; nearest = { ...p, dist: d }; }
  });
  return nearest;
}

function toggleGPS() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    document.getElementById('gps-btn').classList.remove('active');
    document.getElementById('center-btn').style.display = 'none';
    document.getElementById('coords-display').style.display = 'none';
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    document.getElementById('km-display').textContent = '-- km';
    document.getElementById('remaining-display').textContent = 'Restam -- km';
    return;
  }

  if (!navigator.geolocation) {
    alert('GPS não disponível neste dispositivo');
    return;
  }

  document.getElementById('gps-btn').classList.add('active');
  document.getElementById('center-btn').style.display = 'flex';
  document.getElementById('coords-display').style.display = 'block';
  autoCenter = true;
  document.getElementById('center-btn').classList.add('active');

  watchId = navigator.geolocation.watchPosition(
    onPosition,
    onPositionError,
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
  );
}

function onPosition(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;

  if (!userMarker) {
    userMarker = L.marker([lat, lon], {
      icon: L.divIcon({ className: 'user-marker', iconSize: [20, 20], iconAnchor: [10, 10] }),
      zIndexOffset: 1000
    }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }

  if (autoCenter) {
    map.setView([lat, lon], Math.max(map.getZoom(), 15));
  }

  const nearest = findNearestKm(lat, lon);
  if (nearest) {
    document.getElementById('km-display').textContent = `${nearest.km.toFixed(1)} km`;
    document.getElementById('remaining-display').textContent = `Restam ${(TOTAL_KM - nearest.km).toFixed(1)} km`;
  }

  document.getElementById('coords-display').textContent =
    `${lat.toFixed(5)}, ${lon.toFixed(5)} | ±${accuracy.toFixed(0)}m`;
}

function onPositionError(err) {
  if (err.code === 1) {
    alert('Permissão de GPS negada. Ative a localização nas configurações.');
  } else {
    console.warn('GPS error:', err.message);
  }
}

function toggleCenter() {
  autoCenter = !autoCenter;
  document.getElementById('center-btn').classList.toggle('active', autoCenter);
  if (autoCenter && userMarker) {
    map.setView(userMarker.getLatLng(), Math.max(map.getZoom(), 15));
  }
}

function showInfo(html) {
  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').style.display = 'block';
}
function closeInfo() {
  document.getElementById('info-panel').style.display = 'none';
}

function updateProgress(loaded, total, cached) {
  const pct = Math.round((loaded / total) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  if (cached > 0 && cached === loaded) {
    document.getElementById('progress-text').textContent = `${pct}% — Já baixado!`;
  } else {
    document.getElementById('progress-text').textContent = `${pct}% — ${loaded.toLocaleString()} de ${total.toLocaleString()} imagens`;
  }

  lastProgress = { loaded, total, timestamp: Date.now() };
  resetStallDetection();
}

function resetStallDetection() {
  if (stallTimer) clearTimeout(stallTimer);
  document.getElementById('resume-btn').style.display = 'none';

  stallTimer = setTimeout(() => {
    const pct = Math.round((lastProgress.loaded / lastProgress.total) * 100);
    if (pct < 100) {
      document.getElementById('resume-btn').style.display = 'inline-block';
    }
  }, 8000);
}

function resumeDownload() {
  document.getElementById('resume-btn').style.display = 'none';
  document.getElementById('progress-text').textContent = 'Retomando download...';
  startTilePreCache();
}

function hideLoading() {
  if (stallTimer) clearTimeout(stallTimer);
  const overlay = document.getElementById('loading-overlay');
  overlay.style.transition = 'opacity 0.5s';
  overlay.style.opacity = '0';
  setTimeout(() => overlay.style.display = 'none', 500);
}

function startTilePreCache() {
  if (!navigator.serviceWorker.controller) {
    setTimeout(startTilePreCache, 200);
    return;
  }

  const tiles = getTileList();
  document.getElementById('progress-text').textContent = `0% — 0 de ${tiles.toLocaleString()} imagens`;
  resetStallDetection();

  navigator.serviceWorker.controller.postMessage({
    type: 'precache-tiles',
    tiles: tiles
  });
}

navigator.serviceWorker.addEventListener('message', event => {
  if (event.data.type === 'cache-progress') {
    updateProgress(event.data.loaded, event.data.total, event.data.cached);
  }
  if (event.data.type === 'cache-complete') {
    if (stallTimer) clearTimeout(stallTimer);
    document.getElementById('resume-btn').style.display = 'none';
    document.getElementById('progress-text').textContent = 'Mapa pronto! Funciona offline ✓';
    document.getElementById('progress-fill').style.width = '100%';
    setTimeout(hideLoading, 1500);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (navigator.serviceWorker.controller) {
      startTilePreCache();
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        startTilePreCache();
      });
    }
  }).catch(() => {
    hideLoading();
  });
} else {
  hideLoading();
}

initMap();

map.on('movestart', () => {
  if (watchId !== null) {
    autoCenter = false;
    document.getElementById('center-btn').classList.remove('active');
  }
});
