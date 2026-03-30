(function () {
  const STORAGE_AUTH = 'balpha-shop-auth';
  if (!localStorage.getItem(STORAGE_AUTH)) {
    window.location.replace('../dnevnik/');
    return;
  }

  const STORAGE_PLANTS = 'balpha-shop-plants';
  const STORAGE_ENTRIES = 'balpha-shop-entries';

  // One-time migration from previous storage keys (older branding).
  (function migrateOldStorageKeys() {
    const flagKey = 'balpha-shop-migrated-v1';
    if (localStorage.getItem(flagKey)) return;
    const pairs = [
      ['balkan-pharm-plants', STORAGE_PLANTS],
      ['balkan-pharm-entries', STORAGE_ENTRIES],
      ['balkan-pharm-toolbox', 'balpha-shop-toolbox'],
      ['balkan-pharm-auth', STORAGE_AUTH],
    ];
    pairs.forEach(([oldKey, newKey]) => {
      try {
        const hasNew = localStorage.getItem(newKey);
        const oldVal = localStorage.getItem(oldKey);
        if (!hasNew && oldVal) localStorage.setItem(newKey, oldVal);
      } catch {
        // ignore
      }
    });
    try {
      localStorage.setItem(flagKey, String(Date.now()));
    } catch {
      // ignore
    }
  })();

  const STAGES = {
    klijanje: 'Klijanje',
    sadnica: 'Sadnica',
    vegetativna: 'Vegetativna',
    cvjetanje: 'Cvjetanje',
    susenje: 'Sušenje',
  };

  function getPlants() {
    try {
      const data = localStorage.getItem(STORAGE_PLANTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function setPlants(plants) {
    localStorage.setItem(STORAGE_PLANTS, JSON.stringify(plants));
  }

  function getEntries() {
    try {
      const data = localStorage.getItem(STORAGE_ENTRIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function setEntries(entries) {
    localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
  }

  function uuid() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  // --- Navigation ---
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  const viewTitle = document.querySelector('.view-title');
  const logoutBtn = document.getElementById('btn-logout');
  const titles = {
    dashboard: 'Nadzorna ploča',
    plants: 'Biljke i dnevnik',
    cpvo: 'CPVO-obrazac',
    growlog: 'Growlog',
    toolbox: 'Alati',
  };

  let currentGrowlogPlantId = null;

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_AUTH);
      window.location.replace('../dnevnik/');
    });
  }

  function showView(id, extra) {
    views.forEach((v) => v.classList.remove('active'));
    navItems.forEach((n) => n.classList.remove('active'));
    if (id === 'growlog' && extra) {
      currentGrowlogPlantId = extra;
      const view = document.getElementById('view-growlog');
      if (view) view.classList.add('active');
      const plant = getPlants().find((p) => p.id === extra);
      if (viewTitle) viewTitle.textContent = plant ? plant.name : 'Growlog';
      renderGrowlog(extra);
      return;
    }
    currentGrowlogPlantId = null;
    const view = document.getElementById('view-' + id);
    document.querySelectorAll('.nav-item[data-view="' + id + '"]').forEach((n) => n.classList.add('active'));
    if (view) view.classList.add('active');
    if (viewTitle && titles[id]) viewTitle.textContent = titles[id];
    if (id === 'dashboard') renderDashboard();
    if (id === 'plants') {
      renderPlants();
      renderJournal();
    }
    if (id === 'toolbox') renderToolbox();
  }

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view !== 'growlog') currentGrowlogPlantId = null;
      showView(view);
    });
  });

  function openGrowlog(plantId) {
    showView('growlog', plantId);
  }

  function getPlantEntries(plantId) {
    return getEntries().filter((e) => e.plantId === plantId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function weeksBetween(d1, d2) {
    if (!d1 || !d2) return 0;
    const a = new Date(d1);
    const b = new Date(d2);
    return Math.max(0, Math.floor((b - a) / (7 * 24 * 60 * 60 * 1000)));
  }

  function daysBetween(d1, d2) {
    if (!d1 || !d2) return 0;
    return Math.max(0, Math.floor((new Date(d2) - new Date(d1)) / (24 * 60 * 60 * 1000)));
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const n = new Date();
    const sec = Math.floor((n - d) / 1000);
    if (sec < 60) return 'upravo';
    if (sec < 3600) return 'prije ' + Math.floor(sec / 60) + ' min';
    if (sec < 86400) return 'prije ' + Math.floor(sec / 3600) + ' h';
    if (sec < 604800) return 'prije ' + Math.floor(sec / 86400) + ' d';
    if (sec < 2592000) return 'prije ' + Math.floor(sec / 604800) + ' tjedana';
    if (sec < 31536000) return 'prije ' + Math.floor(sec / 2592000) + ' mj.';
    return 'prije ' + Math.floor(sec / 31536000) + ' god.';
  }

  function formatDayWeek(dateStr, startDateStr) {
    if (!dateStr || !startDateStr) return '';
    const d = new Date(dateStr);
    const start = new Date(startDateStr);
    const day = daysBetween(startDateStr, dateStr);
    const week = Math.floor(day / 7);
    return 'Dan ' + day + ' (' + week + '. tjedan)';
  }

  const STAGE_ICONS = {
    klijanje: '🌱',
    sadnica: '🌿',
    vegetativna: '🪴',
    cvjetanje: '🌸',
    susenje: '🍂',
  };

  function renderGrowlog(plantId) {
    const plant = getPlants().find((p) => p.id === plantId);
    const entries = getPlantEntries(plantId);
    if (!plant) return;

    const startDate = plant.startDate || new Date().toISOString().slice(0, 10);
    const updatedAt = plant.updatedAt || (plant.startDate ? plant.startDate + 'T12:00:00.000Z' : new Date().toISOString());
    const views = plant.views != null ? plant.views : 0;
    const durationWeeks = weeksBetween(startDate, updatedAt.slice(0, 10));
    const envType = plant.environmentType === 'outdoor' ? 'Na otvorenom' : 'U zatvorenom';
    const exposure = plant.exposureHours ? plant.exposureHours + ' h' : '—';

    document.getElementById('growlog-updated').textContent = 'Ažurirano ' + timeAgo(updatedAt);
    document.getElementById('growlog-views').textContent = views + ' pregleda';

    document.getElementById('growlog-metrics').innerHTML = `
      <div class="growlog-metric"><span class="growlog-metric-icon">📅</span> ${durationWeeks} tjedana</div>
      <div class="growlog-metric"><span class="growlog-metric-icon">💧</span> ${STAGES[plant.stage] || plant.stage}</div>
      <div class="growlog-metric"><span class="growlog-metric-icon">💡</span> ${envType}</div>
    `;

    const allPhotos = [];
    if (plant.photo) allPhotos.push(plant.photo);
    entries.forEach((e) => {
      if (e.photo) allPhotos.push(e.photo);
    });
    const photoGrid = document.getElementById('growlog-photo-grid');
    photoGrid.innerHTML = allPhotos.slice(0, 3).map((src) => '<img src="' + src + '" alt="" />').join('') || '<p class="growlog-empty">Nema fotografija</p>';
    document.getElementById('growlog-view-all-photos').style.display = allPhotos.length > 3 ? 'inline-block' : 'none';

    document.getElementById('growlog-strain').innerHTML = plant.strain
      ? '<span class="strain-icon">🧬</span> ' + escapeHtml(plant.strain)
      : '<span class="growlog-empty">—</span>';

    const stageOrder = ['klijanje', 'sadnica', 'vegetativna', 'cvjetanje', 'susenje'];
    const stageDates = plant.stageDates || {};
    document.getElementById('growlog-tree-stages').innerHTML = stageOrder
      .map((s) => {
        const date = stageDates[s] || (s === 'klijanje' ? startDate : null);
        const isCurrent = plant.stage === s;
        const label = STAGES[s] || s;
        const dateStr = date ? new Date(date).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
        return '<div class="tree-stage-item' + (isCurrent ? ' current' : '') + '"><span class="tree-stage-icon">' + (STAGE_ICONS[s] || '•') + '</span><span class="tree-stage-label">' + label + '</span><span class="tree-stage-date">' + dateStr + '</span></div>';
      })
      .join('');

    document.getElementById('growlog-environment').innerHTML = `
      <div class="env-row"><span class="env-icon">⛺</span> ${escapeHtml(plant.environmentName || '—')}</div>
      <div class="env-row"><span class="env-icon">💡</span> ${envType}</div>
      <div class="env-row"><span class="env-icon">🕐</span> ${exposure} osvjetljenja</div>
    `;

    const mainImg = plant.photo || (allPhotos.length ? allPhotos[0] : null);
    const heroEl = document.getElementById('growlog-hero-image');
    if (mainImg) heroEl.innerHTML = '<img src="' + mainImg + '" alt="" />';
    else heroEl.innerHTML = '<div class="growlog-hero-placeholder">Nema glavne fotografije</div>';

    document.getElementById('growlog-plant-name').textContent = plant.name;

    const timelineItems = [];
    entries.slice(0, 20).forEach((e) => {
      const dayWeek = formatDayWeek(e.date, startDate);
      const dateStr = e.date ? new Date(e.date).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
      const typeLabel = e.type || 'Općenito';
      const note = (e.note || '').slice(0, 80) + ((e.note || '').length > 80 ? '…' : '');
      const media = e.photo ? '<img src="' + e.photo + '" alt="" class="timeline-thumb" />' : '';
      timelineItems.push(
        '<div class="timeline-entry"><div class="timeline-entry-header"><span class="timeline-date">📅 ' + dateStr + '</span><span class="timeline-day">' + dayWeek + '</span></div><div class="timeline-entry-body">' + typeLabel + ': ' + escapeHtml(note) + '</div>' + (media ? '<div class="timeline-entry-media">' + media + '</div>' : '') + '</div>'
      );
    });
    document.getElementById('growlog-timeline').innerHTML = timelineItems.length ? timelineItems.join('') : '<p class="growlog-empty">Nema unosa u vremenskoj crti. Dodajte bilješke u Dnevnik.</p>';

    const stripPhotos = allPhotos.slice(0, 8);
    document.getElementById('growlog-photo-strip').innerHTML = stripPhotos.map((src) => '<img src="' + src + '" alt="" />').join('') || '<p class="growlog-empty">Nema fotografija</p>';

    document.getElementById('growlog-back').onclick = () => showView('plants');

    document.getElementById('growlog-view-all-photos').onclick = () => {
      document.getElementById('growlog-photo-strip').scrollIntoView({ behavior: 'smooth' });
    };
  }

  // --- Dashboard ---
  function renderDashboard() {
    const plants = getPlants();
    const entries = getEntries();
    const cardsEl = document.getElementById('dashboard-cards');
    const recentEl = document.getElementById('recent-notes');
    const totalPlantCount = plants.reduce((sum, p) => sum + Math.max(1, Number(p.count || 1)), 0);

    cardsEl.innerHTML = `
      <div class="dashboard-card">
        <h3>Broj biljaka</h3>
        <div class="value">${totalPlantCount}</div>
      </div>
      <div class="dashboard-card">
        <h3>Bilješke u dnevniku</h3>
        <div class="value">${entries.length}</div>
      </div>
      <div class="dashboard-card">
        <h3>Aktivne faze</h3>
        <div class="value">${new Set(plants.map((p) => p.stage)).size}</div>
      </div>
    `;

    const recent = entries.slice(-5).reverse();
    if (recent.length === 0) {
      recentEl.innerHTML = '<div class="empty-state">Nema bilješki. Dodajte biljku i započnite dnevnik.</div>';
    } else {
      recentEl.innerHTML = recent
        .map((e) => {
          const plant = plants.find((p) => p.id === e.plantId);
          const plantName = plant ? plant.name : 'Biljka';
          const date = e.date ? new Date(e.date).toLocaleDateString('hr-HR') : '';
          const thumb = e.photo ? '<img src="' + e.photo + '" alt="" class="recent-note-thumb" />' : '';
          return `
            <div class="recent-note">
              <div class="meta">${plantName} · ${date} · ${ENTRY_TYPE_LABELS[e.type] || e.type || 'Općenito'}</div>
              ${thumb}
              <div class="text">${escapeHtml(e.note || '').slice(0, 120)}${(e.note || '').length > 120 ? '…' : ''}</div>
            </div>
          `;
        })
        .join('');
    }

    const MIN_CHART_ENTRIES = 2;
    const chartsSection = document.getElementById('dashboard-charts-section');
    const chartsContainer = document.getElementById('dashboard-charts');
    if (chartsSection && chartsContainer && typeof getToolboxData === 'function') {
      const toolbox = getToolboxData();
      const watering = toolbox.watering || [];
      const environment = toolbox.environment || [];
      const hasWatering = watering.length >= MIN_CHART_ENTRIES;
      const hasEnv = environment.length >= MIN_CHART_ENTRIES;
      if (!hasWatering && !hasEnv) {
        chartsSection.style.display = 'none';
      } else {
        chartsSection.style.display = 'block';
        chartsContainer.innerHTML = '';
        if (hasWatering) chartsContainer.innerHTML += '<div class="dashboard-chart-block"><h4>Zalijevanje</h4><div id="dashboard-chart-watering"></div></div>';
        if (hasEnv) chartsContainer.innerHTML += '<div class="dashboard-chart-block"><h4>Okoliš (temperatura, vlažnost, pH)</h4><div id="dashboard-chart-environment"></div></div>';
        if (hasWatering && typeof renderToolboxChart === 'function') renderToolboxChart('watering', document.getElementById('dashboard-chart-watering'));
        if (hasEnv && typeof renderToolboxChart === 'function') renderToolboxChart('environment', document.getElementById('dashboard-chart-environment'));
      }
    }

    renderWeatherWidget();
  }

  const WEATHER_CACHE_KEY = 'balpha-shop-weather-cache';
  const WEATHER_PREF_KEY = 'balpha-shop-weather-pref';
  const WEATHER_CACHE_MS = 10 * 60 * 1000;

  function fmtNumber(x, digits = 0) {
    const n = Number(x);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(digits);
  }

  function getWeatherCache() {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getWeatherPref() {
    try {
      const raw = localStorage.getItem(WEATHER_PREF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setWeatherPref(pref) {
    try {
      if (!pref) localStorage.removeItem(WEATHER_PREF_KEY);
      else localStorage.setItem(WEATHER_PREF_KEY, JSON.stringify(pref));
    } catch {
      // ignore
    }
  }

  function setWeatherCache(data) {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  function getCurrentPositionPromise(timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('no_geolocation'));
        return;
      }
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(t);
          resolve(pos);
        },
        (err) => {
          clearTimeout(t);
          reject(err || new Error('geolocation_error'));
        },
        { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: timeoutMs }
      );
    });
  }

  async function fetchWeather(lat, lon) {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(lat) +
      '&longitude=' +
      encodeURIComponent(lon) +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation' +
      '&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather_http_' + res.status);
    return await res.json();
  }

  async function fetchPlaceName(lat, lon) {
    const url =
      'https://geocoding-api.open-meteo.com/v1/reverse?latitude=' +
      encodeURIComponent(lat) +
      '&longitude=' +
      encodeURIComponent(lon) +
      '&language=hr&format=json';
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json && json.results && json.results[0] ? json.results[0] : null;
    if (!r) return null;
    const parts = [r.name, r.admin1, r.country].filter(Boolean);
    return parts.join(', ');
  }

  async function searchCity(name) {
    const url =
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(name) +
      '&count=1&language=hr&format=json';
    const res = await fetch(url);
    if (!res.ok) throw new Error('geocode_http_' + res.status);
    const json = await res.json();
    const r = json && json.results && json.results[0] ? json.results[0] : null;
    if (!r) return null;
    const parts = [r.name, r.admin1, r.country].filter(Boolean);
    return { lat: r.latitude, lon: r.longitude, place: parts.join(', ') };
  }

  function renderWeatherSkeleton(container) {
    container.innerHTML = `
      <div class="weather-card">
        <div class="weather-header">
          <div>
            <p class="weather-title">Lokacija (vrijeme)</p>
            <p class="weather-location">Učitavanje…</p>
          </div>
          <div class="weather-actions">
            <button type="button" class="btn btn-ghost weather-btn" disabled>Osvježi</button>
          </div>
        </div>
        <div class="weather-grid">
          <div class="weather-metric"><div class="label">Temp</div><div class="value">—</div></div>
          <div class="weather-metric"><div class="label">Vlaga</div><div class="value">—</div></div>
          <div class="weather-metric"><div class="label">Vjetar</div><div class="value">—</div></div>
          <div class="weather-metric"><div class="label">Oborine</div><div class="value">—</div></div>
        </div>
        <div class="weather-footnote">Podaci: Open‑Meteo</div>
      </div>
    `;
  }

  function renderWeatherError(container, message, showLocationButton) {
    container.innerHTML = `
      <div class="weather-card">
        <div class="weather-header">
          <div>
            <p class="weather-title">Lokacija (vrijeme)</p>
            <p class="weather-location">${escapeHtml(message)}</p>
          </div>
          <div class="weather-actions">
            ${showLocationButton ? '<button type="button" class="btn btn-primary weather-btn" id="weather-enable-location">Omogući lokaciju</button>' : ''}
            <button type="button" class="btn btn-ghost weather-btn" id="weather-refresh">Osvježi</button>
          </div>
        </div>
        <form class="weather-form" id="weather-city-form">
          <input type="text" id="weather-city" placeholder="Upiši grad (npr. Zagreb)" autocomplete="address-level2" />
          <button type="submit" class="btn btn-primary weather-btn">Prikaži</button>
        </form>
        <div class="weather-footnote">Podaci: Open‑Meteo</div>
      </div>
    `;
    const refreshBtn = document.getElementById('weather-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => renderWeatherWidget(true));
    const enableBtn = document.getElementById('weather-enable-location');
    if (enableBtn) enableBtn.addEventListener('click', () => renderWeatherWidget(true, true));
    const form = document.getElementById('weather-city-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = document.getElementById('weather-city').value.trim();
        if (!city) return;
        renderWeatherSkeleton(container);
        try {
          const loc = await searchCity(city);
          if (!loc) {
            renderWeatherError(container, 'Grad nije pronađen. Pokušajte ponovno.', showLocationButton);
            return;
          }
          const wx = await fetchWeather(loc.lat, loc.lon);
          const current = wx && wx.current ? wx.current : null;
          if (!current) throw new Error('no_current_weather');
          const payload = { fetchedAt: Date.now(), lat: loc.lat, lon: loc.lon, place: loc.place, current };
          setWeatherPref({ lat: loc.lat, lon: loc.lon, place: loc.place });
          setWeatherCache(payload);
          renderWeatherData(container, payload.place, payload.current, payload.fetchedAt);
        } catch {
          renderWeatherError(container, 'Vrijeme trenutno nije dostupno. Pokušajte ponovno.', showLocationButton);
        }
      });
    }
  }

  function renderWeatherData(container, place, current, fetchedAt) {
    const temp = fmtNumber(current.temperature_2m, 1) + ' °C';
    const hum = fmtNumber(current.relative_humidity_2m, 0) + ' %';
    const wind = fmtNumber(current.wind_speed_10m, 0) + ' km/h';
    const precip = fmtNumber(current.precipitation, 1) + ' mm';
    container.innerHTML = `
      <div class="weather-card">
        <div class="weather-header">
          <div>
            <p class="weather-title">Lokacija (vrijeme)</p>
            <p class="weather-location">${escapeHtml(place || 'Vaša lokacija')}</p>
          </div>
          <div class="weather-actions">
            <button type="button" class="btn btn-ghost weather-btn" id="weather-refresh">Osvježi</button>
          </div>
        </div>
        <div class="weather-grid">
          <div class="weather-metric"><div class="label">Temp</div><div class="value">${temp}</div></div>
          <div class="weather-metric"><div class="label">Vlaga</div><div class="value">${hum}</div></div>
          <div class="weather-metric"><div class="label">Vjetar</div><div class="value">${wind}</div></div>
          <div class="weather-metric"><div class="label">Oborine</div><div class="value">${precip}</div></div>
        </div>
        <form class="weather-form" id="weather-city-form">
          <input type="text" id="weather-city" placeholder="Upiši drugi grad (npr. Split)" autocomplete="address-level2" />
          <button type="submit" class="btn btn-ghost weather-btn">Promijeni</button>
        </form>
        <div class="weather-footnote">Ažurirano: ${new Date(fetchedAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })} · Podaci: Open‑Meteo</div>
      </div>
    `;
    const refreshBtn = document.getElementById('weather-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => renderWeatherWidget(true));
    const form = document.getElementById('weather-city-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = document.getElementById('weather-city').value.trim();
        if (!city) return;
        const host = document.getElementById('dashboard-weather');
        if (!host) return;
        renderWeatherSkeleton(host);
        try {
          const loc = await searchCity(city);
          if (!loc) {
            renderWeatherError(host, 'Grad nije pronađen. Pokušajte ponovno.', true);
            return;
          }
          const wx = await fetchWeather(loc.lat, loc.lon);
          const curr = wx && wx.current ? wx.current : null;
          if (!curr) throw new Error('no_current_weather');
          const payload = { fetchedAt: Date.now(), lat: loc.lat, lon: loc.lon, place: loc.place, current: curr };
          setWeatherPref({ lat: loc.lat, lon: loc.lon, place: loc.place });
          setWeatherCache(payload);
          renderWeatherData(host, payload.place, payload.current, payload.fetchedAt);
        } catch {
          renderWeatherError(host, 'Vrijeme trenutno nije dostupno. Pokušajte ponovno.', true);
        }
      });
    }
  }

  async function renderWeatherWidget(force = false, forcePrompt = false) {
    const host = document.getElementById('dashboard-weather');
    if (!host) return;

    const cached = getWeatherCache();
    const fresh = cached && Date.now() - (cached.fetchedAt || 0) < WEATHER_CACHE_MS;
    if (!force && fresh && cached.current) {
      renderWeatherData(host, cached.place, cached.current, cached.fetchedAt);
      return;
    }

    renderWeatherSkeleton(host);

    try {
      const pref = !forcePrompt ? getWeatherPref() : null;
      let lat;
      let lon;
      if (pref && pref.lat && pref.lon) {
        lat = pref.lat;
        lon = pref.lon;
      } else {
        const pos = await getCurrentPositionPromise(9000);
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
      const [wx, place] = await Promise.all([fetchWeather(lat, lon), fetchPlaceName(lat, lon)]);
      const current = wx && wx.current ? wx.current : null;
      if (!current) throw new Error('no_current_weather');
      const payload = { fetchedAt: Date.now(), lat, lon, place: (pref && pref.place) || place || null, current };
      setWeatherCache(payload);
      renderWeatherData(host, payload.place, payload.current, payload.fetchedAt);
    } catch (err) {
      const code = err && (err.code || err.message) ? String(err.code || err.message) : 'error';
      const isDenied = code.includes('1') || code.toLowerCase().includes('denied') || code.toLowerCase().includes('permission');
      renderWeatherError(
        host,
        isDenied
          ? 'Lokacija nije dopuštena. Omogućite lokaciju za prikaz vremena.'
          : 'Vrijeme trenutno nije dostupno. Pokušajte ponovno.',
        isDenied
      );
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const MAX_IMAGE_SIZE = 800;
  const MAX_VIDEO_SIZE_MB = 2;

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, maxWidth) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w <= maxWidth) {
          resolve(dataUrl);
          return;
        }
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // --- Plants ---
  function renderPlants() {
    const list = document.getElementById('plants-list');
    const plants = getPlants();
    if (plants.length === 0) {
      list.innerHTML = '<div class="empty-state">Nemate biljaka. Kliknite "Nova biljka" da dodate prvu.</div>';
      return;
    }
    list.innerHTML = plants
      .map(
        (p) => `
      <div class="plant-card" data-id="${p.id}">
        ${p.photo ? `<div class="plant-card-photo"><img src="${p.photo}" alt="" /></div>` : ''}
        <div class="plant-card-header">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="stage-badge">${STAGES[p.stage] || p.stage}</span>
        </div>
        ${p.strain ? `<div class="strain">${escapeHtml(p.strain)}</div>` : ''}
        <div class="text-muted" style="font-size:0.85rem">Nasad: <strong style="color:var(--text)">${Math.max(1, Number(p.count || 1))}</strong> bilj.</div>
        ${p.startDate ? `<div class="text-muted" style="font-size:0.85rem">Od ${new Date(p.startDate).toLocaleDateString('hr-HR')}</div>` : ''}
        <div class="plant-card-actions">
          <button type="button" class="btn btn-primary btn-growlog">Growlog</button>
          <button type="button" class="btn btn-ghost btn-edit-plant">Uredi</button>
          <button type="button" class="btn btn-ghost btn-delete-plant">Obriši</button>
        </div>
      </div>
    `
      )
      .join('');

    list.querySelectorAll('.btn-growlog').forEach((btn) => {
      btn.addEventListener('click', () => openGrowlog(btn.closest('.plant-card').dataset.id));
    });
    list.querySelectorAll('.btn-edit-plant').forEach((btn) => {
      btn.addEventListener('click', () => openPlantModal(btn.closest('.plant-card').dataset.id));
    });
    list.querySelectorAll('.btn-delete-plant').forEach((btn) => {
      btn.addEventListener('click', () => deletePlant(btn.closest('.plant-card').dataset.id));
    });
  }

  function deletePlant(id) {
    if (!confirm('Obrisati ovu biljku?')) return;
    const plants = getPlants().filter((p) => p.id !== id);
    setPlants(plants);
    const entries = getEntries().filter((e) => e.plantId !== id);
    setEntries(entries);
    renderPlants();
    renderDashboard();
    fillEntryPlantSelect();
    fillJournalPlantFilter();
    if (typeof fillToolboxPlantSelects === 'function') fillToolboxPlantSelects();
  }

  function openPlantModal(editId) {
    const modal = document.getElementById('modal-plant');
    const form = document.getElementById('form-plant');
    const titleEl = document.getElementById('modal-plant-title');
    const photoData = document.getElementById('plant-photo-data');
    const photoPreview = document.getElementById('plant-photo-preview');
    document.getElementById('plant-id').value = editId || '';
    titleEl.textContent = editId ? 'Uredi biljku' : 'Nova biljka';
    document.getElementById('plant-photo').value = '';
    if (editId) {
      const p = getPlants().find((x) => x.id === editId);
      if (p) {
        document.getElementById('plant-name').value = p.name;
        document.getElementById('plant-strain').value = p.strain || '';
        document.getElementById('plant-count').value = p.count ?? 1;
        document.getElementById('plant-stage').value = p.stage || 'klijanje';
        document.getElementById('plant-start-date').value = p.startDate || '';
        document.getElementById('plant-environment-name').value = p.environmentName || '';
        document.getElementById('plant-environment-type').value = p.environmentType || 'indoor';
        document.getElementById('plant-exposure-hours').value = p.exposureHours ?? '';
        document.getElementById('plant-notes').value = p.notes || '';
        if (p.photo) {
          photoData.value = p.photo;
          photoPreview.innerHTML = '<img src="' + p.photo + '" alt="Fotografija" class="media-thumb" /> <button type="button" class="btn-remove-media">Ukloni</button>';
          photoPreview.querySelector('.btn-remove-media').addEventListener('click', () => {
            photoData.value = '';
            photoPreview.innerHTML = '';
          });
        } else {
          photoData.value = '';
          photoPreview.innerHTML = '';
        }
      }
    } else {
      form.reset();
      document.getElementById('plant-id').value = '';
      document.getElementById('plant-count').value = 1;
      document.getElementById('plant-stage').value = 'klijanje';
      photoData.value = '';
      photoPreview.innerHTML = '';
    }
    modal.classList.add('open');
  }

  function closePlantModal() {
    document.getElementById('modal-plant').classList.remove('open');
  }

  document.getElementById('btn-add-plant').addEventListener('click', () => openPlantModal());

  document.getElementById('plant-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const photoData = document.getElementById('plant-photo-data');
    const photoPreview = document.getElementById('plant-photo-preview');
    if (!file || !file.type.startsWith('image/')) {
      photoData.value = '';
      photoPreview.innerHTML = '';
      return;
    }
    try {
      let dataUrl = await readFileAsDataUrl(file);
      dataUrl = await resizeImageDataUrl(dataUrl, MAX_IMAGE_SIZE);
      photoData.value = dataUrl;
      photoPreview.innerHTML = '<img src="' + dataUrl + '" alt="Fotografija" class="media-thumb" /> <button type="button" class="btn-remove-media">Ukloni</button>';
      photoPreview.querySelector('.btn-remove-media').addEventListener('click', () => {
        photoData.value = '';
        photoPreview.innerHTML = '';
        document.getElementById('plant-photo').value = '';
      });
    } catch (err) {
      photoPreview.innerHTML = '<span class="media-error">Greška pri učitavanju.</span>';
    }
  });

  document.getElementById('form-plant').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('plant-id').value;
    const plants = getPlants();
    const photoData = document.getElementById('plant-photo-data').value.trim();
    const exposureVal = document.getElementById('plant-exposure-hours').value.trim();
    const countVal = document.getElementById('plant-count').value.trim();
    const countNum = Math.max(1, parseInt(countVal || '1', 10) || 1);
    const payload = {
      id: id || uuid(),
      name: document.getElementById('plant-name').value.trim(),
      strain: document.getElementById('plant-strain').value.trim(),
      count: countNum,
      stage: document.getElementById('plant-stage').value,
      startDate: document.getElementById('plant-start-date').value || null,
      environmentName: document.getElementById('plant-environment-name').value.trim() || null,
      environmentType: document.getElementById('plant-environment-type').value || 'indoor',
      exposureHours: exposureVal ? parseInt(exposureVal, 10) : null,
      notes: document.getElementById('plant-notes').value.trim(),
      photo: photoData || null,
      updatedAt: new Date().toISOString(),
      views: (getPlants().find((p) => p.id === id) || {}).views ?? 0,
    };
    let next;
    if (id) {
      next = plants.map((p) => (p.id === id ? payload : p));
    } else {
      next = [...plants, payload];
    }
    setPlants(next);
    closePlantModal();
    renderPlants();
    renderDashboard();
    fillEntryPlantSelect();
    fillJournalPlantFilter();
    if (typeof fillToolboxPlantSelects === 'function') fillToolboxPlantSelects();
  });

  document.querySelector('#modal-plant .modal-close').addEventListener('click', closePlantModal);
  document.querySelector('#modal-plant .modal-cancel').addEventListener('click', closePlantModal);

  // --- Journal ---
  function fillEntryPlantSelect() {
    const sel = document.getElementById('entry-plant');
    if (!sel) return;
    const plants = getPlants();
    sel.innerHTML = '<option value="">-- Odaberi biljku --</option>' + plants.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  function fillJournalPlantFilter() {
    const sel = document.getElementById('journal-plant-filter');
    if (!sel) return;
    const plants = getPlants();
    sel.innerHTML = '<option value="">Sve biljke</option>' + plants.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  const ENTRY_TYPE_LABELS = {
    opcenito: 'Općenito',
    zalijevanje: 'Zalijevanje',
    gnojidba: 'Gnojidba',
    okolis: 'Okoliš',
    presadjivanje: 'Presađivanje',
    stresori: 'Stresori',
    ostalo: 'Ostalo',
  };

  function updateEntryExtraVisibility() {
    const type = document.getElementById('entry-type').value;
    const pres = document.getElementById('entry-extra-presadjivanje');
    const stres = document.getElementById('entry-extra-stresori');
    if (pres) {
      const open = type === 'presadjivanje';
      pres.classList.toggle('open', open);
      pres.setAttribute('aria-hidden', !open);
    }
    if (stres) {
      const open = type === 'stresori';
      stres.classList.toggle('open', open);
      stres.setAttribute('aria-hidden', !open);
    }
  }

  function renderJournal() {
    fillJournalPlantFilter();
    const filter = document.getElementById('journal-plant-filter').value;
    let entries = getEntries();
    if (filter) entries = entries.filter((e) => e.plantId === filter);
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const container = document.getElementById('journal-entries');
    const plants = getPlants();
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">Nema bilješki. Kliknite "Nova bilješka".</div>';
      return;
    }
    container.innerHTML = entries
      .map((e) => {
        const plant = plants.find((p) => p.id === e.plantId);
        const plantName = plant ? plant.name : 'Biljka';
        const date = e.date ? new Date(e.date).toLocaleDateString('hr-HR') : '';
        const typeLabel = ENTRY_TYPE_LABELS[e.type] || e.type || 'Općenito';
        const media = [];
        if (e.photo) media.push('<div class="entry-media entry-photo"><img src="' + e.photo + '" alt="Fotografija" /></div>');
        if (e.video) media.push('<div class="entry-media entry-video"><video src="' + e.video + '" controls></video></div>');
        let metaHtml = '';
        if (e.meta) {
          if (e.meta.presadjivanje) {
            const m = e.meta.presadjivanje;
            const parts = [];
            if (m.soilQuality) parts.push('Kvaliteta zemlje: ' + escapeHtml(m.soilQuality));
            if (m.plantAge) parts.push('Starost biljke: ' + escapeHtml(m.plantAge));
            if (m.plantCondition) parts.push('Stanje biljke: ' + escapeHtml(m.plantCondition));
            if (parts.length) metaHtml += '<div class="entry-meta-block"><strong>Presađivanje</strong><ul><li>' + parts.join('</li><li>') + '</li></ul></div>';
          }
          if (e.meta.stresori) {
            const m = e.meta.stresori;
            const parts = [];
            if (m.temperature) parts.push('Temperatura: ' + escapeHtml(m.temperature));
            if (m.humidity) parts.push('Vlaga: ' + escapeHtml(m.humidity));
            if (m.vpd) parts.push('VPD: ' + escapeHtml(m.vpd));
            if (m.pests) parts.push('Nametnici: ' + escapeHtml(m.pests));
            if (parts.length) metaHtml += '<div class="entry-meta-block"><strong>Stresori</strong><ul><li>' + parts.join('</li><li>') + '</li></ul></div>';
          }
        }
        return `
          <div class="journal-entry">
            <div class="entry-meta">
              <span class="entry-type">${typeLabel}</span>
              ${plantName} · ${date}
            </div>
            <div class="entry-note">${escapeHtml(e.note || '')}</div>
            ${metaHtml ? '<div class="entry-meta-blocks">' + metaHtml + '</div>' : ''}
            ${media.length ? '<div class="entry-media-wrap">' + media.join('') + '</div>' : ''}
          </div>
        `;
      })
      .join('');
  }

  const journalPlantFilterEl = document.getElementById('journal-plant-filter');
  if (journalPlantFilterEl) journalPlantFilterEl.addEventListener('change', renderJournal);

  const modalEntry = document.getElementById('modal-entry');
  const entryTypeEl = document.getElementById('entry-type');
  if (entryTypeEl) entryTypeEl.addEventListener('change', updateEntryExtraVisibility);

  function openEntryModal(plantId) {
    if (!modalEntry) return;
    fillEntryPlantSelect();
    const form = document.getElementById('form-entry');
    if (form) form.reset();
    document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('entry-photo-data').value = '';
    document.getElementById('entry-video-data').value = '';
    document.getElementById('entry-photo-preview').innerHTML = '';
    document.getElementById('entry-video-preview').innerHTML = '';
    const plantSelect = document.getElementById('entry-plant');
    if (plantSelect) {
      if (plantId) {
        plantSelect.value = plantId;
        plantSelect.disabled = true;
      } else {
        plantSelect.disabled = false;
      }
    }
    updateEntryExtraVisibility();
    modalEntry.classList.add('open');
  }

  const btnAddEntry = document.getElementById('btn-add-entry');
  if (btnAddEntry) {
    btnAddEntry.addEventListener('click', () => openEntryModal(null));
  }

  const btnAddEntryGrowlog = document.getElementById('btn-add-entry-growlog');
  if (btnAddEntryGrowlog) {
    btnAddEntryGrowlog.addEventListener('click', () => {
      if (!currentGrowlogPlantId) return;
      openEntryModal(currentGrowlogPlantId);
    });
  }

  document.getElementById('entry-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const dataEl = document.getElementById('entry-photo-data');
    const previewEl = document.getElementById('entry-photo-preview');
    if (!file || !file.type.startsWith('image/')) {
      dataEl.value = '';
      previewEl.innerHTML = '';
      return;
    }
    try {
      let dataUrl = await readFileAsDataUrl(file);
      dataUrl = await resizeImageDataUrl(dataUrl, MAX_IMAGE_SIZE);
      dataEl.value = dataUrl;
      previewEl.innerHTML = '<img src="' + dataUrl + '" alt="Fotografija" class="media-thumb" /> <button type="button" class="btn-remove-media">Ukloni</button>';
      previewEl.querySelector('.btn-remove-media').addEventListener('click', () => {
        dataEl.value = '';
        previewEl.innerHTML = '';
        document.getElementById('entry-photo').value = '';
      });
    } catch (err) {
      previewEl.innerHTML = '<span class="media-error">Greška pri učitavanju.</span>';
    }
  });

  document.getElementById('entry-video').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const dataEl = document.getElementById('entry-video-data');
    const previewEl = document.getElementById('entry-video-preview');
    if (!file || !file.type.startsWith('video/')) {
      dataEl.value = '';
      previewEl.innerHTML = '';
      return;
    }
    const maxBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      previewEl.innerHTML = '<span class="media-error">Video prevelik (max ' + MAX_VIDEO_SIZE_MB + ' MB za lokalno spremanje).</span>';
      dataEl.value = '';
      document.getElementById('entry-video').value = '';
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      dataEl.value = dataUrl;
      previewEl.innerHTML = '<video src="' + dataUrl + '" controls class="media-thumb-video"></video> <button type="button" class="btn-remove-media">Ukloni</button>';
      previewEl.querySelector('.btn-remove-media').addEventListener('click', () => {
        dataEl.value = '';
        previewEl.innerHTML = '';
        document.getElementById('entry-video').value = '';
      });
    } catch (err) {
      previewEl.innerHTML = '<span class="media-error">Greška pri učitavanju.</span>';
    }
  });

  document.getElementById('form-entry').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('entry-type').value;
    let meta = null;
    if (type === 'presadjivanje') {
      const soil = document.getElementById('entry-transplant-soil').value.trim();
      const age = document.getElementById('entry-transplant-age').value.trim();
      const condition = document.getElementById('entry-transplant-condition').value.trim();
      if (soil || age || condition) meta = { presadjivanje: { soilQuality: soil || null, plantAge: age || null, plantCondition: condition || null } };
    } else if (type === 'stresori') {
      const temp = document.getElementById('entry-stressor-temp').value.trim();
      const humidity = document.getElementById('entry-stressor-humidity').value.trim();
      const vpd = document.getElementById('entry-stressor-vpd').value.trim();
      const pests = document.getElementById('entry-stressor-pests').value.trim();
      if (temp || humidity || vpd || pests) meta = { stresori: { temperature: temp || null, humidity: humidity || null, vpd: vpd || null, pests: pests || null } };
    }
    const entries = getEntries();
    entries.push({
      id: uuid(),
      plantId: document.getElementById('entry-plant').value || null,
      date: document.getElementById('entry-date').value,
      type: type,
      note: document.getElementById('entry-note').value.trim(),
      photo: document.getElementById('entry-photo-data').value.trim() || null,
      video: document.getElementById('entry-video-data').value.trim() || null,
      meta: meta || undefined,
    });
    setEntries(entries);
    const plantSelect = document.getElementById('entry-plant');
    if (plantSelect) plantSelect.disabled = false;
    modalEntry.classList.remove('open');
    renderJournal();
    renderDashboard();
  });

  modalEntry.querySelector('.modal-close').addEventListener('click', () => {
    const plantSelect = document.getElementById('entry-plant');
    if (plantSelect) plantSelect.disabled = false;
    modalEntry.classList.remove('open');
  });
  modalEntry.querySelector('.modal-cancel').addEventListener('click', () => {
    const plantSelect = document.getElementById('entry-plant');
    if (plantSelect) plantSelect.disabled = false;
    modalEntry.classList.remove('open');
  });

  // --- Toolbox (Alati) ---
  const STORAGE_TOOLBOX = 'balpha-shop-toolbox';

  function getToolboxData() {
    try {
      const data = localStorage.getItem(STORAGE_TOOLBOX);
      const parsed = data ? JSON.parse(data) : {};
      return {
        watering: parsed.watering || [],
        feeding: parsed.feeding || [],
        environment: parsed.environment || [],
        transplant: parsed.transplant || [],
        stressors: parsed.stressors || [],
      };
    } catch {
      return { watering: [], feeding: [], environment: [], transplant: [], stressors: [] };
    }
  }

  function setToolboxData(data) {
    localStorage.setItem(STORAGE_TOOLBOX, JSON.stringify(data));
  }

  function openToolboxPanel(tool) {
    document.querySelectorAll('.toolbox-panel').forEach((p) => {
      const open = p.dataset.tool === tool;
      p.classList.toggle('open', open);
      p.setAttribute('aria-hidden', !open);
    });
    const today = new Date().toISOString().slice(0, 10);
    ['tool-watering-date', 'tool-feeding-date', 'tool-environment-date', 'tool-transplant-date', 'tool-stressors-date'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = today;
    });
    if (tool === 'watering' || tool === 'feeding' || tool === 'environment' || tool === 'transplant' || tool === 'stressors') fillToolboxPlantSelects();
    if (tool === 'graphs') {
      renderToolboxChart('watering', document.getElementById('overview-chart-watering'));
      renderToolboxChart('environment', document.getElementById('overview-chart-environment'));
    } else {
      renderToolboxList(tool);
      const chartEl = document.getElementById('toolbox-chart-' + tool);
      if (chartEl) renderToolboxChart(tool, chartEl);
    }
  }

  function fillToolboxPlantSelect() {
    // Back-compat: keep old function name, but fill all tool selects.
    fillToolboxPlantSelects();
  }

  function fillToolboxPlantSelects() {
    const plants = getPlants();
    const options = plants.map((p) => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
    ['tool-watering-value2', 'tool-feeding-plant', 'tool-environment-plant', 'tool-transplant-plant', 'tool-stressors-plant'].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const first = sel.options[0] ? sel.options[0].outerHTML : '<option value="">-- Odaberi biljku --</option>';
      sel.innerHTML = first + options;
    });

    const graphsSel = document.getElementById('tool-graphs-plant');
    if (graphsSel) {
      const first = graphsSel.options[0] ? graphsSel.options[0].outerHTML : '<option value="">Sve biljke</option>';
      graphsSel.innerHTML = first + options;
    }
  }

  function renderToolbox() {
    document.querySelectorAll('.toolbox-panel').forEach((p) => {
      p.classList.remove('open');
      p.setAttribute('aria-hidden', 'true');
    });
    fillToolboxPlantSelects();
  }

  function renderToolboxList(tool) {
    const listEl = document.getElementById('toolbox-list-' + tool);
    if (!listEl) return;
    const data = getToolboxData()[tool] || [];
    data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (data.length === 0) {
      listEl.innerHTML = '<p class="toolbox-empty">Nema unosa. Dodajte prvi.</p>';
      return;
    }
    const plants = getPlants();
    const plantById = new Map(plants.map((p) => [p.id, p.name]));
    const plantLabel = (plantId) => {
      if (!plantId) return '—';
      return plantById.get(plantId) || 'Biljka';
    };
    listEl.innerHTML = data
      .map((item) => {
        let valuesStr;
        if (tool === 'watering') {
          const val = escapeHtml(String(item.value1 || ''));
          valuesStr = val + ' mL · ' + escapeHtml(plantLabel(item.value2 || item.plantId));
        } else if (tool === 'feeding') {
          const parts = [];
          if (item.value1) parts.push(escapeHtml(String(item.value1)));
          if (item.value2) parts.push(escapeHtml(String(item.value2)));
          parts.push(escapeHtml(plantLabel(item.plantId)));
          valuesStr = parts.join(' · ');
        } else if (tool === 'environment') {
          valuesStr =
            escapeHtml(String(item.value1 || '')) +
            ' °C' +
            (item.value2 ? ' · ' + escapeHtml(String(item.value2)) + ' %' : '') +
            (item.value3 ? ' · pH ' + escapeHtml(String(item.value3)) : '') +
            ' · ' +
            escapeHtml(plantLabel(item.plantId));
        } else if (tool === 'transplant') {
          const parts = [];
          if (item.soilQuality) parts.push('Kvaliteta zemlje: ' + escapeHtml(String(item.soilQuality)));
          if (item.plantAge) parts.push('Starost: ' + escapeHtml(String(item.plantAge)));
          if (item.plantCondition) parts.push('Stanje: ' + escapeHtml(String(item.plantCondition)));
          parts.push('Biljka: ' + escapeHtml(plantLabel(item.plantId)));
          valuesStr = parts.join(' · ') || '-';
        } else if (tool === 'stressors') {
          const parts = [];
          if (item.temperature) parts.push('Temperatura: ' + escapeHtml(String(item.temperature)));
          if (item.humidity) parts.push('Vlaga: ' + escapeHtml(String(item.humidity)));
          if (item.vpd) parts.push('VPD: ' + escapeHtml(String(item.vpd)));
          if (item.pests) parts.push('Nametnici: ' + escapeHtml(String(item.pests)));
          parts.push('Biljka: ' + escapeHtml(plantLabel(item.plantId)));
          valuesStr = parts.join(' · ') || '-';
        } else {
          valuesStr = escapeHtml(String(item.value1 || '')) + (item.value2 ? ' · ' + escapeHtml(String(item.value2)) : '');
        }
        return (
          '<div class="toolbox-list-item" data-id="' +
          item.id +
          '"><span class="toolbox-list-date">' +
          (item.date ? new Date(item.date).toLocaleDateString('hr-HR') : '') +
          '</span><span class="toolbox-list-values">' +
          valuesStr +
          '</span><button type="button" class="toolbox-list-delete" aria-label="Obriši">×</button></div>'
        );
      })
      .join('');
    listEl.querySelectorAll('.toolbox-list-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.toolbox-list-item').dataset.id;
        const data = getToolboxData();
        data[tool] = data[tool].filter((x) => x.id !== id);
        setToolboxData(data);
        renderToolboxList(tool);
        const chartEl = document.getElementById('toolbox-chart-' + tool);
        if (chartEl) renderToolboxChart(tool, chartEl);
      });
    });
  }

  function resolveToolboxChartPlantId(tool, container) {
    if (!container) return null;
    const id = container.id || '';
    if (id === 'toolbox-chart-watering') return document.getElementById('tool-watering-value2')?.value || null;
    if (id === 'toolbox-chart-environment') return document.getElementById('tool-environment-plant')?.value || null;
    if (id === 'overview-chart-watering' || id === 'overview-chart-environment') return document.getElementById('tool-graphs-plant')?.value || null;
    // dashboard charts remain unfiltered
    return null;
  }

  function renderToolboxChart(tool, container, plantId) {
    if (!container) return;
    const data = getToolboxData()[tool] || [];
    const selectedPlantId = plantId !== undefined ? plantId : resolveToolboxChartPlantId(tool, container);
    const sortedAll = [...data].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const sorted = selectedPlantId
      ? sortedAll.filter((x) => {
          const pid = tool === 'watering' ? x.value2 || x.plantId : x.plantId;
          return pid === selectedPlantId;
        })
      : sortedAll;

    if (sorted.length === 0) {
      container.innerHTML = '<p class="toolbox-chart-empty">Nema podataka za graf.</p>';
      return;
    }
    const numVal = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
    if (tool === 'watering') {
      const max = Math.max(1, ...sorted.map((x) => numVal(x.value1)));
      container.innerHTML =
        '<div class="toolbox-bars">' +
        sorted
          .map((x) => {
            const val = numVal(x.value1);
            const pct = Math.round((val / max) * 100);
            const label = x.date ? new Date(x.date).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' }) : '';
            return '<div class="toolbox-bar-item"><span class="toolbox-bar-label">' + label + '</span><div class="toolbox-bar-track"><div class="toolbox-bar-fill" style="width:' + pct + '%"></div></div><span class="toolbox-bar-value">' + val + ' mL</span></div>';
          })
          .join('') +
        '</div>';
    } else if (tool === 'environment') {
      const temps = sorted.map((x) => numVal(x.value1));
      const hums = sorted.map((x) => numVal(x.value2));
      const phs = sorted.map((x) => numVal(x.value3));
      const maxT = Math.max(1, ...temps);
      const maxH = Math.max(1, ...hums);
      const maxPh = Math.max(1, ...phs.filter((p) => p > 0));
      const hasPh = phs.some((p) => p > 0);
      container.innerHTML =
        '<div class="toolbox-bars">' +
        sorted
          .map((x) => {
            const t = numVal(x.value1);
            const h = numVal(x.value2);
            const ph = numVal(x.value3);
            const pctT = Math.round((t / maxT) * 100);
            const label = x.date ? new Date(x.date).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' }) : '';
            let row =
              '<div class="toolbox-bar-item"><span class="toolbox-bar-label">' +
              label +
              '</span><div class="toolbox-bar-track"><div class="toolbox-bar-fill" style="width:' +
              pctT +
              '%" title="' +
              t +
              ' °C"></div></div><span class="toolbox-bar-value">' +
              t +
              ' °C</span>' +
              (h ? ' <span class="toolbox-bar-value toolbox-bar-value-alt">' + h + ' %</span>' : '') +
              (ph ? ' <span class="toolbox-bar-value toolbox-bar-value-alt">' + ph + ' pH</span>' : '') +
              '</div>';
            if (hasPh && ph > 0 && maxPh >= 1) {
              const pctPh = Math.round((ph / 14) * 100);
              row +=
                '<div class="toolbox-bar-item toolbox-bar-item-ph"><span class="toolbox-bar-label">pH</span><div class="toolbox-bar-track"><div class="toolbox-bar-fill toolbox-bar-fill-ph" style="width:' +
                pctPh +
                '%" title="' +
                ph +
                ' pH"></div></div><span class="toolbox-bar-value">' +
                ph +
                ' pH</span></div>';
            }
            return row;
          })
          .join('') +
        '</div>';
    } else if (tool === 'feeding') {
      container.innerHTML =
        '<div class="toolbox-timeline-list">' +
        sorted
          .map((x) => '<div class="toolbox-timeline-item"><span class="toolbox-list-date">' + (x.date ? new Date(x.date).toLocaleDateString('hr-HR') : '') + '</span> ' + escapeHtml(String(x.value1 || '')) + (x.value2 ? ' – ' + escapeHtml(String(x.value2)) : '') + '</div>')
          .join('') +
        '</div>';
    }
  }

  document.querySelectorAll('.toolbox-card-btn').forEach((btn) => {
    btn.addEventListener('click', () => openToolboxPanel(btn.dataset.tool));
  });

  const wateringPlantSel = document.getElementById('tool-watering-value2');
  if (wateringPlantSel) {
    wateringPlantSel.addEventListener('change', () => {
      renderToolboxList('watering');
      renderToolboxChart('watering', document.getElementById('toolbox-chart-watering'));
    });
  }

  const envPlantSel = document.getElementById('tool-environment-plant');
  if (envPlantSel) {
    envPlantSel.addEventListener('change', () => {
      renderToolboxList('environment');
      renderToolboxChart('environment', document.getElementById('toolbox-chart-environment'));
    });
  }

  const graphsPlantSel = document.getElementById('tool-graphs-plant');
  if (graphsPlantSel) {
    graphsPlantSel.addEventListener('change', () => {
      renderToolboxChart('watering', document.getElementById('overview-chart-watering'));
      renderToolboxChart('environment', document.getElementById('overview-chart-environment'));
    });
  }

  document.getElementById('toolbox-form-watering').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getToolboxData();
    data.watering.push({
      id: uuid(),
      date: document.getElementById('tool-watering-date').value,
      value1: document.getElementById('tool-watering-value1').value.trim(),
      value2: document.getElementById('tool-watering-value2').value.trim() || null,
    });
    setToolboxData(data);
    document.getElementById('toolbox-form-watering').reset();
    renderToolboxList('watering');
    renderToolboxChart('watering', document.getElementById('toolbox-chart-watering'));
  });

  document.getElementById('toolbox-form-feeding').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getToolboxData();
    data.feeding.push({
      id: uuid(),
      date: document.getElementById('tool-feeding-date').value,
      value1: document.getElementById('tool-feeding-value1').value.trim(),
      value2: document.getElementById('tool-feeding-value2').value.trim() || null,
      plantId: document.getElementById('tool-feeding-plant').value.trim() || null,
    });
    setToolboxData(data);
    document.getElementById('toolbox-form-feeding').reset();
    renderToolboxList('feeding');
    renderToolboxChart('feeding', document.getElementById('toolbox-chart-feeding'));
  });

  document.getElementById('toolbox-form-environment').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getToolboxData();
    data.environment.push({
      id: uuid(),
      date: document.getElementById('tool-environment-date').value,
      value1: document.getElementById('tool-environment-value1').value.trim(),
      value2: document.getElementById('tool-environment-value2').value.trim() || null,
      value3: document.getElementById('tool-environment-value3').value.trim() || null,
      plantId: document.getElementById('tool-environment-plant').value.trim() || null,
    });
    setToolboxData(data);
    document.getElementById('toolbox-form-environment').reset();
    renderToolboxList('environment');
    renderToolboxChart('environment', document.getElementById('toolbox-chart-environment'));
  });

  const transplantForm = document.getElementById('toolbox-form-transplant');
  if (transplantForm) {
    transplantForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = getToolboxData();
      data.transplant.push({
        id: uuid(),
        date: document.getElementById('tool-transplant-date').value,
        soilQuality: document.getElementById('tool-transplant-soil').value.trim() || null,
        plantAge: document.getElementById('tool-transplant-age').value.trim() || null,
        plantCondition: document.getElementById('tool-transplant-condition').value.trim() || null,
        plantId: document.getElementById('tool-transplant-plant').value.trim() || null,
      });
      setToolboxData(data);
      document.getElementById('toolbox-form-transplant').reset();
      renderToolboxList('transplant');
    });
  }

  const stressorsForm = document.getElementById('toolbox-form-stressors');
  if (stressorsForm) {
    stressorsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = getToolboxData();
      data.stressors.push({
        id: uuid(),
        date: document.getElementById('tool-stressors-date').value,
        temperature: document.getElementById('tool-stressors-temp').value.trim() || null,
        humidity: document.getElementById('tool-stressors-humidity').value.trim() || null,
        vpd: document.getElementById('tool-stressors-vpd').value.trim() || null,
        pests: document.getElementById('tool-stressors-pests').value.trim() || null,
        plantId: document.getElementById('tool-stressors-plant').value.trim() || null,
      });
      setToolboxData(data);
      document.getElementById('toolbox-form-stressors').reset();
      renderToolboxList('stressors');
    });
  }

  // Init
  fillEntryPlantSelect();
  fillJournalPlantFilter();
  const params = new URLSearchParams(window.location.search);
  const initialView = params.get('view');
  if (initialView && ['dashboard', 'plants', 'cpvo', 'toolbox'].includes(initialView)) {
    showView(initialView);
  } else {
    renderDashboard();
  }
})();
