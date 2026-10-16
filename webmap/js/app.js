/* Moteur de la planche : carte, états des tronçons, panneaux, légendes, navigation. */
(function () {
  const META = window.DG_META;
  const FEATS = window.DG_TRONCONS.features;
  const P = FEATS.map((f) => f.properties);
  const N = P.length;
  const CHAMP = P.map((p) => p.ch === 1);
  const SURF = P.map((p) => p.sf);
  const MATI = { R1: 0, R2: 1, R3: 2, R4: 3 };
  const PROF = META.profils.map((p) => p.id);

  const APP = {
    META, P, N, CHAMP, SURF, MATI, PROF,
    state: { fig: 0, mode: "presentation", need: 0, mat: 2, prof: 0, scen: 3, year: 2040, rob: "p20", rep: "troncons",
      layer: "prio_equilibre", ctx: { icu: false, inond: false, etab: false, arbres: false, tram: false }, w: null, sel: null },
  };
  window.APP = APP;

  /* ---------------------------------------------------------- géométrie utile */
  const CENTER = FEATS.map((f) => {
    const c = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates.flat();
    return c[Math.floor(c.length / 2)];
  });
  APP.center = (i) => CENTER[i];

  /* ---------------------------------------------------------- calculs AMC côté navigateur */
  APP.classes = function (score) {
    const idx = [];
    for (let i = 0; i < N; i++) if (CHAMP[i] && score[i] > 0) idx.push(i);
    idx.sort((a, b) => score[b] - score[a]);
    const tot = idx.reduce((s, i) => s + SURF[i], 0);
    const cl = new Int8Array(N);
    let cum = 0;
    for (const i of idx) { cum += SURF[i]; const f = cum / tot; cl[i] = f <= 0.1 ? 1 : f <= 0.3 ? 2 : f <= 0.6 ? 3 : 4; }
    return cl;
  };
  APP.top = function (score, part = 0.2) {
    const cl = new Uint8Array(N);
    const idx = [];
    for (let i = 0; i < N; i++) if (CHAMP[i] && score[i] > 0) idx.push(i);
    idx.sort((a, b) => score[b] - score[a]);
    const tot = idx.reduce((s, i) => s + SURF[i], 0);
    let cum = 0;
    for (const i of idx) { cum += SURF[i]; if (cum / tot <= part) cl[i] = 1; }
    return cl;
  };
  // Score personnalisé : S[m] = C[m] * sum_g w_g P[m][g] N[g]
  APP.custom = function (w) {
    const Pm = META.P, apt = new Float32Array(N), mat = new Int8Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const p = P[i];
      let best = 0, bm = -1;
      for (let m = 0; m < 4; m++) {
        let s = 0;
        for (let g = 0; g < 5; g++) s += w[g] * Pm[m][g] * p.N[g];
        s *= p.C[m];
        if (s > best) { best = s; bm = m; }
      }
      apt[i] = best; mat[i] = bm;
    }
    return { apt, mat, cls: APP.classes(apt) };
  };
  APP.profileTop = PROF.map((k, j) => APP.top(P.map((p) => p.S[j] || 0)));

  /* ---------------------------------------------------------- carte */
  const IGN = "https://data.geopf.fr";
  const style = {
    version: 8,
    glyphs: IGN + "/annexes/ressources/vectorTiles/fonts/{fontstack}/{range}.pbf",
    sources: { plan: { type: "vector", tiles: [IGN + "/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf"], maxzoom: 18 } },
    layers: [
      { id: "fond", type: "background", paint: { "background-color": "#fcfcfb" } },
      { id: "ign-veg", type: "fill", source: "plan", "source-layer": "ocs_vegetation_surf", paint: { "fill-color": "#e8eee5" } },
      { id: "ign-eau", type: "fill", source: "plan", "source-layer": "hydro_surf", paint: { "fill-color": "#dbe5ec" } },
      { id: "ign-bati", type: "fill", source: "plan", "source-layer": "bati_surf", minzoom: 13,
        paint: { "fill-color": "#efefec", "fill-outline-color": "#e2e2de" } },
      { id: "ign-routes", type: "line", source: "plan", "source-layer": "routier_route",
        paint: { "line-color": "#e4e4e0", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.3, 16, 2.2] } },
      { id: "ign-fer", type: "line", source: "plan", "source-layer": "ferre", paint: { "line-color": "#d3d5d8", "line-width": 0.8 } },
    ],
  };
  const map = new maplibregl.Map({
    container: "map", style, attributionControl: false, minZoom: 10.5, maxZoom: 18.5, dragRotate: false, pitchWithRotate: false,
    bounds: [[META.bornes.lon[0], META.bornes.lat[0]], [META.bornes.lon[1], META.bornes.lat[1]]], fitBoundsOptions: { padding: 30 },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");
  map.on("error", (e) => { if (!/PLAN\.IGN|fonts/.test(String(e && e.error && e.error.message))) console.warn(e.error); });
  APP.map = map;

  const widthExpr = (base) => ["interpolate", ["exponential", 1.55], ["zoom"],
    11, ["*", ["coalesce", ["feature-state", "w"], 1], base * 0.75],
    13, ["*", ["coalesce", ["feature-state", "w"], 1], base * 1.5],
    15, ["*", ["coalesce", ["feature-state", "w"], 1], base * 3.2],
    17.5, ["*", ["coalesce", ["feature-state", "w"], 1], base * 8]];

  map.on("load", () => {
    const C = window.DG_CONTEXTE;
    map.addSource("eau-local", { type: "geojson", data: C.eau });
    map.addLayer({ id: "eau-local", type: "fill", source: "eau-local", paint: { "fill-color": "#dbe5ec" } }, "ign-bati");
    map.addSource("icu", { type: "geojson", data: C.icu_jour });
    map.addLayer({ id: "icu", type: "fill", source: "icu", layout: { visibility: "none" }, paint: {
      "fill-color": ["match", ["get", "expo_jour"], "effet rafraîchissant", "#cfe0ee", "faible", "#f6ddd2", "moyen", "#e9a58c", "fort", "#b8402f", "#eee"],
      "fill-opacity": 0.55 } });
    map.addSource("inond", { type: "geojson", data: C.inondation });
    map.addLayer({ id: "inond", type: "fill", source: "inond", layout: { visibility: "none" }, paint: { "fill-color": "#0072B2", "fill-opacity": 0.14 } });
    map.addLayer({ id: "inond-l", type: "line", source: "inond", layout: { visibility: "none" }, paint: { "line-color": "#0072B2", "line-width": 1, "line-opacity": 0.7 } });
    map.addSource("grille", { type: "geojson", data: window.DG_GRILLE, promoteId: "id" });
    map.addLayer({ id: "grille", type: "fill", source: "grille", layout: { visibility: "none" }, paint: { "fill-color": "#ddd", "fill-opacity": 0.88, "fill-outline-color": "#fcfcfb" } });
    map.addSource("arr", { type: "geojson", data: C.arrondissements });
    map.addLayer({ id: "arr", type: "line", source: "arr", paint: { "line-color": "#14181f", "line-opacity": 0.45, "line-width": 1, "line-dasharray": [4, 2] } });
    map.addSource("terr", { type: "geojson", data: C.territoire });
    map.addLayer({ id: "terr", type: "line", source: "terr", paint: { "line-color": "#14181f", "line-width": 1.6 } });
    map.addSource("tram", { type: "geojson", data: C.tram });
    map.addLayer({ id: "tram", type: "line", source: "tram", layout: { visibility: "none" }, paint: { "line-color": "#5f6672", "line-width": 1.2, "line-dasharray": [1, 1.5] } });

    map.addSource("tr", { type: "geojson", data: window.DG_TRONCONS, promoteId: "i" });
    const lineLayout = { "line-cap": "round", "line-join": "round" };
    map.addLayer({ id: "tr-out", type: "line", source: "tr", layout: lineLayout, filter: ["==", ["get", "ch"], 0],
      paint: { "line-color": "#cfd2d6", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 16, 1.6] } });
    map.addLayer({ id: "tr-case", type: "line", source: "tr", layout: lineLayout, filter: ["==", ["get", "ch"], 1],
      paint: { "line-color": "#14181f", "line-opacity": ["case", ["boolean", ["feature-state", "faint"], false], 0, 0.3],
        "line-gap-width": widthExpr(1), "line-width": 0.7 } });
    map.addLayer({ id: "tr", type: "line", source: "tr", layout: lineLayout, filter: ["all", ["==", ["get", "ch"], 1], ["==", ["get", "pls"], 0]],
      paint: { "line-color": "#999", "line-width": widthExpr(1) } });
    map.addLayer({ id: "tr-dash", type: "line", source: "tr", layout: { "line-cap": "butt", "line-join": "round" }, filter: ["all", ["==", ["get", "ch"], 1], ["==", ["get", "pls"], 1]],
      paint: { "line-color": "#999", "line-width": widthExpr(1) } });
    map.addLayer({ id: "tr-sel", type: "line", source: "tr", layout: lineLayout,
      paint: { "line-color": "#14181f", "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, 0], "line-gap-width": widthExpr(1.2) } });
    map.addLayer({ id: "tr-hit", type: "line", source: "tr", paint: { "line-color": "#000", "line-opacity": 0, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 16] } });

    map.addSource("etab", { type: "geojson", data: C.etablissements });
    map.addLayer({ id: "etab", type: "circle", source: "etab", layout: { visibility: "none" }, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.2, 16, 5], "circle-color": "#fcfcfb", "circle-stroke-color": "#14181f", "circle-stroke-width": 1.4 } });
    map.addSource("arbres", { type: "geojson", data: { type: "FeatureCollection", features: C.arbres.map((a) => ({ type: "Feature", geometry: { type: "Point", coordinates: [a[0], a[1]] }, properties: { r: a[2] } })) } });
    map.addLayer({ id: "arbres", type: "circle", source: "arbres", minzoom: 13.5, layout: { visibility: "none" }, paint: {
      "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 14, ["*", ["get", "r"], 0.35], 18, ["*", ["get", "r"], 5.5]],
      "circle-color": "#3f8f5a", "circle-opacity": 0.28 } });
    map.addSource("course", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "course", type: "line", source: "course", paint: { "line-color": PAL.course, "line-width": 2.2, "line-dasharray": [2, 1.6] } });

    map.addLayer({ id: "ign-quartiers", type: "symbol", source: "plan", "source-layer": "toponyme_localite_ponc", minzoom: 13,
      filter: ["in", "txt_typo", "BAT_QUARTIER", "BAT_QUARTIER_T"],
      layout: { "text-field": "{texte}", "text-font": ["Source Sans Pro Italic"], "text-size": 11.5 },
      paint: { "text-color": "#6f7680", "text-halo-color": "#fcfcfb", "text-halo-width": 1.4 } });
    map.addLayer({ id: "ign-odonymes", type: "symbol", source: "plan", "source-layer": "toponyme_routier_odonyme_lin", minzoom: 15.3,
      layout: { "symbol-placement": "line", "text-field": "{texte}", "text-font": ["Source Sans Pro Regular"], "text-size": 11.5 },
      paint: { "text-color": "#3f4652", "text-halo-color": "#fcfcfb", "text-halo-width": 1.6 } });

    C.arrondissements_labels.features.forEach((f) => {
      const el = document.createElement("div");
      el.className = "arr-label";
      el.textContent = f.properties.label;
      new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map);
    });
    bindMapEvents();
    APP.ready = true;
    document.getElementById("loading").classList.add("gone");
    APP.go(APP.state.fig, true);
  });

  /* ---------------------------------------------------------- rendu des tronçons */
  // spec : { kind: "seq"|"cat", value(p,i), stops, domain, colors, width(p,i), faint(p,i), dash, hover(p,i), legend }
  APP.paint = function (spec) {
    APP.spec = spec;
    const grid = spec.grid && APP.state.rep === "grille";
    map.setLayoutProperty("grille", "visibility", grid ? "visible" : "none");
    ["tr", "tr-dash", "tr-case", "tr-out"].forEach((l) => map.setLayoutProperty(l, "visibility", grid ? "none" : "visible"));
    if (grid) return paintGrid(spec);
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (!CHAMP[i]) continue;
      const v = spec.value(p, i);
      const faint = spec.faint ? spec.faint(p, i) : v == null || (spec.kind === "cat" && v < 0);
      map.setFeatureState({ source: "tr", id: i }, { v: faint ? null : v, faint, w: faint ? 0.5 : spec.width ? spec.width(p, i) : 1 });
    }
    let color;
    if (spec.kind === "cat") {
      color = ["match", ["coalesce", ["feature-state", "v"], -1]];
      spec.colors.forEach((c, k) => color.push(k, c));
      color.push(PAL.none);
    } else color = PAL.expr(spec.stops, "v", spec.domain);
    color = ["case", ["boolean", ["feature-state", "faint"], false], spec.faintColor || PAL.none, color];
    map.setPaintProperty("tr", "line-color", color);
    map.setPaintProperty("tr-dash", "line-color", color);
    map.setPaintProperty("tr-dash", "line-dasharray", spec.dash ? [1.2, 0.9] : [1, 0]);
    APP.legend(spec);
  };
  function paintGrid(spec) {
    const G = window.DG_GRILLE.features;
    G.forEach((f) => {
      const v = spec.grid(f.properties);
      map.setFeatureState({ source: "grille", id: f.properties.id }, { v: v == null ? null : v, faint: v == null || (spec.kind === "cat" && v < 0) });
    });
    let color;
    if (spec.kind === "cat") { color = ["match", ["coalesce", ["feature-state", "v"], -1]]; spec.colors.forEach((c, k) => color.push(k, c)); color.push("rgba(0,0,0,0)"); }
    else color = PAL.expr(spec.stops, "v", spec.domain);
    map.setPaintProperty("grille", "fill-color", ["case", ["boolean", ["feature-state", "faint"], false], "rgba(0,0,0,0)", color]);
    APP.legend(spec);
  }

  /* ---------------------------------------------------------- légende */
  APP.legend = function (spec) {
    const el = document.getElementById("legend");
    const L = spec.legend || {};
    let h = `<h3>${APP.typo(L.title || "")}</h3>`;
    if (spec.kind === "cat") {
      (L.items || []).forEach((it) => { h += `<div class="row"><span class="sw${it.dash ? " dash" : ""}" style="border-top-color:${it.color}"></span><span>${it.label}</span></div>`; });
    } else {
      const id = "lg" + Math.random().toString(36).slice(2, 7);
      h += `<svg width="220" height="34" viewBox="0 0 220 34" aria-hidden="true"><defs><linearGradient id="${id}">${spec.stops.map((c, k) => `<stop offset="${k / (spec.stops.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient></defs>
        <rect x="0" y="2" width="220" height="10" fill="url(#${id})"/>
        <text x="0" y="28" style="font-size:.7rem" fill="#3f4652">${L.min || ""}</text><text x="220" y="28" style="font-size:.7rem" fill="#3f4652" text-anchor="end">${L.max || ""}</text></svg>`;
    }
    (L.widths || []).forEach((it) => { h += `<div class="row"><span class="sw" style="border-top-width:${it.w}px;border-top-color:${it.color || "#14181f"}"></span><span>${it.label}</span></div>`; });
    if (L.note) h += `<div class="sub">${L.note}</div>`;
    el.innerHTML = h;
  };

  /* ---------------------------------------------------------- couches de contexte */
  APP.context = function (ctx) {
    Object.assign(APP.state.ctx, ctx);
    const c = APP.state.ctx, vis = (b) => (b ? "visible" : "none");
    if (!map.getLayer("icu")) return;
    map.setLayoutProperty("icu", "visibility", vis(c.icu));
    map.setLayoutProperty("inond", "visibility", vis(c.inond));
    map.setLayoutProperty("inond-l", "visibility", vis(c.inond));
    map.setLayoutProperty("etab", "visibility", vis(c.etab));
    map.setLayoutProperty("arbres", "visibility", vis(c.arbres));
    map.setLayoutProperty("tram", "visibility", vis(c.tram));
  };

  /* ---------------------------------------------------------- postes du parcours */
  const ORDRE_POSTES = ["chaleur", "pente", "inondation", "eau", "carbone", "incertain", "anticipation"];
  const markers = {};
  APP.stationNo = (k) => ORDRE_POSTES.indexOf(k) + 1;
  APP.stations = function (list, tags = {}) {
    Object.values(markers).forEach((m) => m.remove());
    for (const k in markers) delete markers[k];
    list = list || [];
    const max = list.reduce((a, k) => Math.max(a, APP.stationNo(k)), 0);
    // postes déjà parcourus (rappel discret) puis postes de la figure
    const passes = ORDRE_POSTES.filter((k) => APP.stationNo(k) < max && !list.includes(k));
    passes.concat(list).forEach((k) => {
      const ps = META.postes[k];
      if (!ps) return;
      const past = !list.includes(k);
      const el = document.createElement("div");
      el.innerHTML = `<div class="station${past ? " past" : ""}" title="${ps.nom}">${APP.stationNo(k)}</div>` + (!past && tags[k] ? `<div class="station-tag">${tags[k]}</div>` : "");
      el.querySelector(".station").addEventListener("click", (ev) => { ev.stopPropagation(); APP.focusStation(k); });
      markers[k] = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(CENTER[ps.i]).addTo(map);
    });
    if (max > 1) APP.course(max);
    declutter();
  };
  // Écarte les pastilles qui se chevauchent à l'écran
  function declutter() {
    const placed = [];
    ORDRE_POSTES.forEach((k) => {
      const m = markers[k];
      if (!m) return;
      const p = map.project(m.getLngLat());
      let dx = 0;
      while (placed.some((q) => Math.hypot(q.x - (p.x + dx), q.y - p.y) < 26)) dx += 26;
      m.setOffset([dx, 0]);
      placed.push({ x: p.x + dx, y: p.y });
    });
  }
  map.on("zoomend", declutter);
  map.on("moveend", declutter);
  let focused = null;
  APP.focusStation = function (k) {
    const ps = META.postes[k];
    if (focused === k) { focused = null; APP.camera("all"); return; }
    focused = k;
    map.flyTo({ center: CENTER[ps.i], zoom: 16, duration: reduce() ? 0 : 1500, essential: true });
    APP.select(ps.i);
  };
  APP.course = function (on) {
    const n = on === true ? ORDRE_POSTES.length : on || 0;
    const coords = ORDRE_POSTES.slice(0, n).map((k) => META.postes[k] && CENTER[META.postes[k].i]).filter(Boolean);
    map.getSource("course").setData({ type: "FeatureCollection", features: n > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }] : [] });
  };

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  APP.camera = function (c) {
    if (!c || c === "all") {
      map.fitBounds([[META.bornes.lon[0], META.bornes.lat[0]], [META.bornes.lon[1], META.bornes.lat[1]]],
        { padding: { top: 60, bottom: 40, left: 30, right: 30 }, duration: reduce() ? 0 : 1300 });
    } else if (c.poste) {
      map.flyTo({ center: CENTER[META.postes[c.poste].i], zoom: c.zoom || 15.5, duration: reduce() ? 0 : 1500 });
    }
  };

  /* ---------------------------------------------------------- survol et sélection */
  function bindMapEvents() {
    const tip = document.getElementById("hovertip");
    let hov = null;
    map.on("mousemove", "tr-hit", (e) => {
      if (APP.state.rep === "grille" && APP.spec && APP.spec.grid) return;
      const f = e.features[0];
      if (!f) return;
      const i = f.id, p = P[i];
      map.getCanvas().style.cursor = "pointer";
      if (hov !== i) hov = i;
      const val = APP.spec && APP.spec.hover ? APP.spec.hover(p, i) : "";
      tip.innerHTML = `<b>${p.n}</b> <span style="opacity:.75">· ${p.a}</span>${val ? `<br><span class="v">${val}</span>` : ""}`;
      tip.hidden = false;
      const r = map.getContainer().getBoundingClientRect();
      let x = e.point.x + 14, y = e.point.y + 14;
      if (x + tip.offsetWidth > r.width - 8) x = e.point.x - tip.offsetWidth - 12;
      if (y + tip.offsetHeight > r.height - 8) y = e.point.y - tip.offsetHeight - 12;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    });
    map.on("mouseleave", "tr-hit", () => { tip.hidden = true; map.getCanvas().style.cursor = ""; hov = null; });
    map.on("click", "tr-hit", (e) => { if (e.features[0]) APP.select(e.features[0].id); });
    map.on("mousemove", "grille", (e) => {
      if (APP.state.rep !== "grille" || !APP.spec || !APP.spec.gridHover) return;
      const p = e.features[0].properties;
      tip.innerHTML = `<b>Carreau 200 m</b><br><span class="v">${APP.spec.gridHover(JSON.parse(JSON.stringify(window.DG_GRILLE.features.find((g) => g.properties.id === p.id).properties)))}</span>`;
      tip.hidden = false;
      tip.style.left = e.point.x + 14 + "px"; tip.style.top = e.point.y + 14 + "px";
    });
    map.on("mouseleave", "grille", () => { tip.hidden = true; });
  }

  let selected = null;
  APP.select = function (i) {
    if (selected != null) map.setFeatureState({ source: "tr", id: selected }, { sel: false });
    selected = i;
    APP.state.sel = i;
    document.body.classList.toggle("fiche-open", i != null);
    if (i == null) { document.getElementById("fiche").hidden = true; return; }
    map.setFeatureState({ source: "tr", id: i }, { sel: true });
    APP.fiche(i);
  };

  /* ---------------------------------------------------------- fiche tronçon */
  const f2 = (v) => (v == null ? "—" : CH.n2(v));
  APP.fiche = function (i) {
    const p = P[i], el = document.getElementById("fiche");
    const m = (code) => (code && code !== "—" ? `<span class="mat" style="--c:${PAL.mat[code]}">${code} ${META.materiaux[code].court}</span>` : "—");
    const bar = (lab, v, col) => `<span class="lab">${lab}</span><span class="track"><span class="fill" style="width:${Math.round((v || 0) * 100)}%;background:${col}"></span></span><span class="num">${f2(v)}</span>`;
    const robLab = ["Hors champ", "Rarement prioritaire", "Prioritaire incertain", "Prioritaire probable", "Prioritaire robuste"][p.rb];
    const cls = (k) => (k ? "P" + k : "—");
    const sc = ["S0", "S1", "S2", "S3"];
    el.innerHTML = `
      <header><h2>${p.n}</h2><div class="meta">${p.a} · tronçon ${p.id} · ${CH.n0(p.lg)} m · ${CH.n0(p.sf)} m² de chaussée</div>
        <button type="button" class="close" aria-label="Fermer la fiche"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3 3 13"/></svg></button></header>
      ${p.ch ? "" : `<h3>Hors champ de l'étude</h3><div class="cell" style="border:0">${p.dom === "Privé" ? "Voie privée" : "Revêtement non bitumineux : " + p.rv}</div>`}
      <h3>Voirie</h3>
      <div class="grid">
        <div class="cell"><span class="k">Trafic PL</span><span class="v">${p.pl} <small>${p.pls ? "imputé" : "relevé"}</small></span></div>
        <div class="cell"><span class="k">Trafic tous véh.</span><span class="v">${CH.n0(p.tm)} <small>${p.tms ? "compté" : "estimé"}</small></span></div>
        <div class="cell"><span class="k">Pente</span><span class="v">${CH.n1(p.pe)} %</span></div>
        <div class="cell"><span class="k">Hiérarchie</span><span class="v" title="${p.h}">${p.h}</span></div>
        <div class="cell"><span class="k">Vitesse · zone</span><span class="v" title="${p.z}">${p.v || "—"} km/h · ${p.z}</span></div>
        <div class="cell"><span class="k">Bus</span><span class="v" title="${p.b}">${p.b}</span></div>
        <div class="cell"><span class="k">Revêtement actuel</span><span class="v" title="${p.rv}">${p.rv}</span></div>
        <div class="cell"><span class="k">Zone inondable</span><span class="v">${p.inm ? "aléa moyen" : p.ine ? "aléa extrême" : "non"}</span></div>
        <div class="cell"><span class="k">Arrêts TC à 150 m</span><span class="v">${p.tc}</span></div>
      </div>
      <h3>Indicateurs</h3>
      <div class="grid">
        <div class="cell"><span class="k">Canopée sur la rue</span><span class="v">${CH.pct(p.can)}</span></div>
        <div class="cell"><span class="k">Rapport H/L</span><span class="v">${f2(p.hl)}</span></div>
        <div class="cell"><span class="k">Insolation</span><span class="v">${f2(p.ins)}</span></div>
        <div class="cell"><span class="k">Expo. chaleur jour</span><span class="v">${f2(p.ej)}</span></div>
        <div class="cell"><span class="k">Expo. chaleur nuit</span><span class="v">${f2(p.en)}</span></div>
        <div class="cell"><span class="k">Imperméabilisation</span><span class="v">${CH.pct(p.imp)}</span></div>
        <div class="cell"><span class="k">Densité</span><span class="v">${CH.n0(p.dh)} <small>hab/ha</small></span></div>
        <div class="cell"><span class="k">Pop. sensible</span><span class="v">${CH.n0(p.ds)} <small>hab/ha</small></span></div>
        <div class="cell"><span class="k">Ménages pauvres</span><span class="v">${p.pv == null ? "—" : CH.pct(p.pv)}</span></div>
      </div>
      <h3>Besoins du territoire (N) et compatibilité (C)</h3>
      <div class="bars">
        ${bar("Chaleur", p.N[0], "#a12e27")}${bar("Santé", p.N[1], "#43548a")}${bar("Eau", p.N[2], "#43548a")}${bar("Carbone", p.N[3], "#43548a")}${bar("Usages", p.N[4], "#43548a")}
        ${PAL.matCodes.map((c, k) => bar(c + " " + META.materiaux[c].court, p.C[k], PAL.mat[c])).join("")}
      </div>
      <h3>Priorité selon le profil d'acteurs</h3>
      <table><thead><tr><th>Profil</th><th class="r">Score</th><th class="r">Classe</th><th>Revêtement</th></tr></thead><tbody>
        ${META.profils.map((pr, k) => `<tr><td>${pr.nom}</td><td class="r">${p.S[k] == null ? "—" : CH.n2(p.S[k])}</td><td class="r">${cls(p.K[k])}</td><td>${m(p.M[k])}</td></tr>`).join("")}
      </tbody></table>
      <h3>Robustesse (3 000 tirages)</h3>
      <div class="grid">
        <div class="cell"><span class="k">P(top 20 %)</span><span class="v">${CH.pct(p.p20)}</span></div>
        <div class="cell"><span class="k">Statut</span><span class="v" title="${robLab}">${robLab}</span></div>
        <div class="cell"><span class="k">Rang (5-95 %)</span><span class="v">${CH.pct(p.q5)}–${CH.pct(p.q95)}</span></div>
        <div class="cell"><span class="k">Revêtement modal</span><span class="v">${m(p.mm)}</span></div>
        <div class="cell"><span class="k">Stabilité du choix</span><span class="v">${CH.pct(p.st)}</span></div>
        <div class="cell"><span class="k">Profils en top 20 %</span><span class="v">${p.cs} / 5</span></div>
      </div>
      <h3>Prospective : premier traitement innovant</h3>
      <table><tbody>${sc.map((s, k) => `<tr><td>${s} ${META.scenarios[s].nom}</td><td class="r">${p.PA[k] || "—"}</td><td>${m(p.PM[k])}</td></tr>`).join("")}</tbody></table>`;
    el.hidden = false;
    el.querySelector(".close").addEventListener("click", () => APP.select(null));
  };

  /* ---------------------------------------------------------- panneaux b / c */
  const tables = { b: null, c: null };
  APP.panel = function (k, title, draw) {
    const el = document.getElementById("p" + k);
    const btn = document.querySelector(`.tabletoggle[data-panel="${k}"]`);
    btn.setAttribute("aria-pressed", "false");
    el.innerHTML = "";
    CH.title(el, title);
    el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal");
    const res = draw ? draw(el) : null;
    tables[k] = { res, draw, title };
    btn.hidden = !(res && res.rows);
  };
  document.querySelectorAll(".tabletoggle").forEach((btn) => btn.addEventListener("click", () => {
    const k = btn.dataset.panel, t = tables[k], el = document.getElementById("p" + k);
    if (!t || !t.res) return;
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", on);
    el.innerHTML = "";
    if (on) CH.table(el, t.res.cols, t.res.rows); else t.res = t.draw(el);
  }));

  /* ---------------------------------------------------------- outils au-dessus de la carte */
  APP.tools = function (html, bind) {
    const el = document.getElementById("maptools");
    el.innerHTML = html || "";
    if (bind) bind(el);
  };
  APP.seg = function (name, options, value, label) {
    return `${label ? `<label>${label}</label>` : ""}<div class="seg small" role="radiogroup" data-seg="${name}">${options.map((o) =>
      `<button type="button" role="radio" data-v="${o.v}" aria-checked="${String(o.v) === String(value)}">${o.t}</button>`).join("")}</div>`;
  };
  APP.onSeg = function (root, name, fn) {
    root.querySelectorAll(`[data-seg="${name}"] button`).forEach((b) => b.addEventListener("click", () => {
      root.querySelectorAll(`[data-seg="${name}"] button`).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      fn(b.dataset.v);
    }));
  };

  /* ---------------------------------------------------------- légende-figure */
  // Typographie française : espaces fines insécables avant : ; ? ! % et dans les guillemets, séparateur de milliers
  APP.typo = (h) => h.replace(/ ([:;?!»])/g, " $1").replace(/« /g, "« ").replace(/(\d)%/g, "$1 %").replace(/ %/g, " %");
  APP.caption = function (html, focus) {
    const el = document.getElementById("caption");
    el.innerHTML = APP.typo(html);
    if (focus) { el.classList.remove("focus"); void el.offsetWidth; el.classList.add("focus"); }
  };

  /* ---------------------------------------------------------- navigation */
  const FIGS = window.FIGS;
  function buildRail() {
    const rail = document.getElementById("rail");
    const missions = [];
    FIGS.forEach((f, i) => {
      let m = missions.find((x) => x.name === f.mission);
      if (!m) { m = { name: f.mission, figs: [] }; missions.push(m); }
      m.figs.push(i);
    });
    rail.innerHTML = missions.map((m) => `<div class="mission" style="flex:${m.figs.length} 1 0" data-figs="${m.figs.join(",")}">
        <button type="button" class="mname" data-go="${m.figs[0]}">${m.name}</button>
        <span class="ticks">${m.figs.map((i) => `<button type="button" class="tick" data-go="${i}" aria-label="Fig. ${FIGS[i].no} — ${FIGS[i].short}" title="Fig. ${FIGS[i].no} — ${FIGS[i].short}"></button>`).join("")}</span>
      </div>`).join("") +
      `<div class="mission explore"><button type="button" class="mname" data-explore="1">Exploration libre</button></div>`;
    rail.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { setMode("presentation"); APP.go(+b.dataset.go); }));
    rail.querySelector("[data-explore]").addEventListener("click", () => setMode("exploration"));
    document.getElementById("figtot").textContent = FIGS[FIGS.length - 1].no;
  }
  function updateRail() {
    const ex = APP.state.mode === "exploration";
    document.querySelectorAll(".mission[data-figs]").forEach((m) => {
      const figs = m.dataset.figs.split(",").map(Number);
      m.classList.toggle("active", figs.includes(APP.state.fig));
      m.querySelectorAll(".tick").forEach((t) => t.setAttribute("aria-current", String(!ex && +t.dataset.go === APP.state.fig)));
    });
  }
  APP.go = function (i, first) {
    if (!APP.ready) { APP.state.fig = i; return; }
    i = Math.max(0, Math.min(FIGS.length - 1, i));
    const changed = i !== APP.state.fig || first;
    APP.state.fig = i;
    APP.select(null);
    APP.stations([]);
    APP.course(false);
    APP.context({ icu: false, inond: false, etab: false, arbres: false, tram: false });
    APP.state.rep = "troncons";
    const f = APP.state.mode === "exploration" ? window.EXPLORE : FIGS[i];
    document.getElementById("figno").textContent = f.no === "E" ? "Exploration" : "Fig. " + f.no;
    APP.split(f.split);
    f.enter(APP.state);
    if (changed || first) APP.camera(f.camera || "all");
    updateRail();
    const nx = FIGS[i + 1], pv = FIGS[i - 1];
    document.getElementById("prev").disabled = !pv;
    document.getElementById("next").disabled = false;
    document.getElementById("next").querySelector(".nb-label").textContent = nx ? "Suivant" : "Fin de la démonstration";
    document.getElementById("nbnext").textContent = nx ? `Fig. ${nx.no} · ${nx.short}` : "Passer en exploration libre";
    document.getElementById("nbwhere").innerHTML = `<b>${FIGS[i].mission}</b> · Fig. ${FIGS[i].no} — ${FIGS[i].short} <span class="kbd">←</span><span class="kbd">→</span> pour naviguer`;
  };
  function setMode(mode) {
    APP.state.mode = mode;
    document.body.dataset.mode = mode;
    document.documentElement.dataset.mode = mode;
    document.querySelectorAll('.head-controls .seg button').forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
    setTimeout(() => { map.resize(); APP.go(APP.state.fig, true); }, 30);
  }
  APP.setMode = setMode;
  document.querySelectorAll(".head-controls .seg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.getElementById("next").addEventListener("click", () => (APP.state.fig >= FIGS.length - 1 ? setMode("exploration") : APP.go(APP.state.fig + 1)));
  // Répartition des hauteurs des panneaux b / c propre à chaque figure
  APP.split = function (r) {
    const [b, c] = r || [1.08, 1];
    document.querySelector(".column").style.gridTemplateRows = `minmax(0, ${b}fr) minmax(0, ${c}fr) auto`;
  };
  document.getElementById("prev").addEventListener("click", () => APP.go(APP.state.fig - 1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "Escape") { APP.select(null); return; }
    if (e.key === "e" || e.key === "E") { setMode(APP.state.mode === "exploration" ? "presentation" : "exploration"); return; }
    if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); return; }
    if (APP.state.mode !== "presentation") return;
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); APP.go(APP.state.fig + 1); }
    if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); APP.go(APP.state.fig - 1); }
    if (e.key === "Home") APP.go(0);
    if (e.key === "End") APP.go(FIGS.length - 1);
  });
  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { const f = APP.state.mode === "exploration" ? window.EXPLORE : FIGS[APP.state.fig]; f.panels && f.panels(APP.state); }, 200); });

  document.documentElement.dataset.mode = "presentation";
  buildRail();
})();
