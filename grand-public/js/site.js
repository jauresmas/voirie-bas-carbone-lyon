/* Version grand public : la ville comme un plan de réseau.
   Les chapitres sont les stations d'une ligne ; les quatre revêtements sont quatre lignes colorées. */
(function () {
  const M = window.GP_META, FEATS = window.GP_RUES.features, P = FEATS.map((f) => f.properties), N = P.length, IDX = window.GP_INDEX;
  const MATS = ["R1", "R2", "R3", "R4"];
  const COL = { R1: "#17a6a0", R2: "#c98500", R3: "#3987e5", R4: "#f0506e" };
  const NOM = { R1: "Liant végétal", R2: "Enrobé clair", R3: "Enrobé drainant", R4: "Recyclé + régénérant" };
  const CHALEUR = ["#1d2558", "#3a2d6c", "#64357a", "#9a4178", "#cf5a6b", "#f28b68", "#ffc49a"];
  const PORC = "#f4f6fb";
  const fr = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", ""] });
  const n0 = fr.format(",.0f"), n1 = fr.format(",.1f");
  const pct = (v) => Math.round(v * 100) + " %";
  const reduit = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = () => window.matchMedia("(max-width: 900px)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : on continue sans */ } },
  };
  const $ = (s) => document.querySelector(s);
  const pastille = (m) => `<span class="pastille" style="--c:${COL[m]}">${m}</span>`;

  const RUE_DE = new Int32Array(N).fill(-1);
  IDX.forEach((r, k) => r.s.forEach((i) => (RUE_DE[i] = k)));

  /* ---------------------------------------------------------------- carte */
  const IGN = "https://data.geopf.fr";
  const map = new maplibregl.Map({
    container: "carte", attributionControl: false, minZoom: 10.5, maxZoom: 18, dragRotate: false, pitchWithRotate: false,
    bounds: [[M.bornes.lon[0], M.bornes.lat[0]], [M.bornes.lon[1], M.bornes.lat[1]]], fitBoundsOptions: { padding: 24 },
    style: {
      version: 8, glyphs: IGN + "/annexes/ressources/vectorTiles/fonts/{fontstack}/{range}.pbf",
      sources: { plan: { type: "vector", tiles: [IGN + "/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf"], maxzoom: 18 } },
      layers: [
        { id: "fond", type: "background", paint: { "background-color": "#0b1230" } },
        { id: "veg", type: "fill", source: "plan", "source-layer": "ocs_vegetation_surf", paint: { "fill-color": "#0f1d3a" } },
        { id: "eau", type: "fill", source: "plan", "source-layer": "hydro_surf", paint: { "fill-color": "#0e2757" } },
        { id: "bati", type: "fill", source: "plan", "source-layer": "bati_surf", minzoom: 13, paint: { "fill-color": "#121b45" } },
        { id: "routes", type: "line", source: "plan", "source-layer": "routier_route", paint: { "line-color": "#1b2556", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.3, 16, 2] } },
      ],
    },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.on("error", () => {});
  const largeur = (base) => ["interpolate", ["exponential", 1.5], ["zoom"],
    11, ["*", ["coalesce", ["feature-state", "w"], 1], base * 0.8], 13, ["*", ["coalesce", ["feature-state", "w"], 1], base * 1.7],
    15, ["*", ["coalesce", ["feature-state", "w"], 1], base * 3.4], 17.5, ["*", ["coalesce", ["feature-state", "w"], 1], base * 8]];

  let pret = false, spec = null, selection = null, marqueur = null;
  map.on("load", () => {
    const C = window.GP_CONTEXTE;
    map.addSource("eau-locale", { type: "geojson", data: C.eau });
    map.addLayer({ id: "eau-locale", type: "fill", source: "eau-locale", paint: { "fill-color": "#0e2757" } }, "bati");
    map.addSource("rues", { type: "geojson", data: window.GP_RUES, promoteId: "i" });
    map.addLayer({ id: "rues-fond", type: "line", source: "rues", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PORC, "line-opacity": 0.14, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 2.4] } });
    map.addLayer({ id: "rues", type: "line", source: "rues", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PORC, "line-opacity": ["case", ["boolean", ["feature-state", "off"], false], 0, 1], "line-width": largeur(1) } });
    map.addLayer({ id: "rue-sel", type: "line", source: "rues", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PORC, "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, 0], "line-gap-width": largeur(1.3) } });
    map.addLayer({ id: "rues-clic", type: "line", source: "rues", paint: { "line-color": "#000", "line-opacity": 0, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 18] } });
    map.addSource("territoire", { type: "geojson", data: C.territoire });
    map.addLayer({ id: "territoire", type: "line", source: "territoire", paint: { "line-color": PORC, "line-opacity": 0.5, "line-width": 1.2, "line-dasharray": [3, 2] } });
    map.addLayer({ id: "quartiers", type: "symbol", source: "plan", "source-layer": "toponyme_localite_ponc", minzoom: 12.5,
      filter: ["in", "txt_typo", "BAT_QUARTIER", "BAT_QUARTIER_T"],
      layout: { "text-field": ["upcase", ["get", "texte"]], "text-font": ["Source Sans Pro Semibold"], "text-size": 11, "text-letter-spacing": 0.12 },
      paint: { "text-color": "#9aa4c2", "text-halo-color": "#0b1230", "text-halo-width": 1.5 } });
    map.addLayer({ id: "noms-rues", type: "symbol", source: "plan", "source-layer": "toponyme_routier_odonyme_lin", minzoom: 15.2,
      layout: { "symbol-placement": "line", "text-field": "{texte}", "text-font": ["Source Sans Pro Regular"], "text-size": 11.5 },
      paint: { "text-color": "#c4cbe0", "text-halo-color": "#0b1230", "text-halo-width": 1.6 } });
    lierCarte();
    pret = true;
    $("#chargement").classList.add("fini");
    allerA(actif || "ch-depart", true);
  });

  /* spec : { type: "plain" | "seq" | "cat", v(p,i), w(p,i), off(p,i), legende } */
  function peindre(s) {
    spec = s;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      const off = !p.ch || (s.off ? s.off(p, i) : false);
      map.setFeatureState({ source: "rues", id: i }, { off, v: off ? null : s.v ? s.v(p, i) : 0, w: s.w ? s.w(p, i) : 1 });
    }
    let couleur;
    if (s.type === "seq") {
      couleur = ["interpolate", ["linear"], ["coalesce", ["feature-state", "v"], 0]];
      s.rampe.forEach((c, k) => couleur.push(k / (s.rampe.length - 1), c));
    } else if (s.type === "cat") {
      couleur = ["match", ["coalesce", ["feature-state", "v"], ""]];
      MATS.forEach((m) => couleur.push(m, COL[m]));
      couleur.push(PORC);
    } else couleur = s.couleur || "rgba(244,246,251,0.55)";
    map.setPaintProperty("rues", "line-color", couleur);
    legende(s.legende);
  }
  function legende(L) {
    const el = $("#legende");
    if (!L) { el.innerHTML = ""; return; }
    let h = `<h4>${L.titre}</h4>`;
    if (L.rampe) h += `<div class="rampe" style="background:linear-gradient(90deg,${L.rampe.join(",")})"></div><div class="bornes"><span>${L.min}</span><span>${L.max}</span></div>`;
    (L.lignes || []).forEach(([c, t, court]) => { h += `<div class="l"><span class="trait" style="--c:${c}"></span><span class="long">${t}</span><span class="court">${court || t}</span></div>`; });
    if (L.note) h += `<div class="bornes note-leg" style="margin-top:4px"><span>${L.note}</span></div>`;
    el.innerHTML = h;
  }
  const COURT = { R1: "Végétal", R2: "Clair", R3: "Drainant", R4: "Recyclé" };
  const lignesLegende = (titre, note) => ({ titre, lignes: MATS.map((m) => [COL[m], `${m} · ${NOM[m]}`, COURT[m]]), note });
  function cadrer() {
    map.fitBounds([[M.bornes.lon[0], M.bornes.lat[0]], [M.bornes.lon[1], M.bornes.lat[1]]], { padding: mobile() ? 12 : 40, duration: reduit() ? 0 : 1100 });
  }

  /* ---------------------------------------------------------------- chapitres → carte */
  const CK = { 1: 2.5, 2: 1.7, 3: 1.05, 4: 0.6 };
  const SCEN = [{ id: "S2", t: "Miser sur le carbone", d: "Tous les chantiers passent au biosourcé d'ici 2040, en commençant par les grands axes.", k: 1 },
    { id: "S1", t: "Cibler la chaleur", d: "On refait tôt les rues les plus chaudes et habitées, avec des revêtements qui rafraîchissent.", k: 0 },
    { id: "S3", t: "Transition", d: "Moins de voitures, plus d'arbres : on cible d'abord, puis on généralise.", k: 2 }];
  let scen = 2, annee = 2040;
  const CARTES = {
    reseau: () => peindre({ type: "plain", couleur: "rgba(244,246,251,0.62)", w: () => 0.8, legende: null }),
    chaleur: () => peindre({ type: "seq", rampe: CHALEUR, v: (p) => p.nc, w: (p) => 0.6 + 1.6 * (p.nc || 0),
      legende: { titre: "Besoin de rafraîchissement", rampe: CHALEUR, min: "faible", max: "très fort" } }),
    revetements: () => peindre({ type: "cat", v: (p) => p.m, off: (p) => !p.k || !p.m, w: (p) => CK[p.k] || 0.6,
      legende: lignesLegende("Revêtement conseillé", "Trait épais : rue la plus prioritaire") }),
    priorites: () => peindre({ type: "cat", v: (p) => p.mm, off: (p) => p.rb < 3 || !p.mm, w: (p) => (p.rb === 4 ? 2.6 : 1.1),
      legende: lignesLegende("Où commencer", "Épais : 8 fois sur 10 · fin : 5 à 8 fois") }),
    "ma-rue": () => peindre({ type: "cat", v: (p) => p.m, off: (p) => !p.k || !p.m, w: (p) => (CK[p.k] || 0.6) * 0.8,
      legende: lignesLegende("Revêtement conseillé", "Touchez une rue pour sa fiche") }),
    "2050": () => {
      const s = SCEN[scen].k;
      peindre({ type: "cat", v: (p) => p.ym[s], off: (p) => !(p.y[s] && p.y[s] <= annee && p.ym[s]), w: () => 1.6,
        legende: lignesLegende(`Rues refaites en ${annee}`, SCEN[scen].t) });
    },
    avis: () => carteAvis(),
  };

  /* ---------------------------------------------------------------- ligne du récit et défilement */
  const chapitres = [...document.querySelectorAll(".chap")];
  let actif = store.get("rues_lyon_station", null);
  const ligneMob = $("#ligne-mobile");
  ligneMob.innerHTML = chapitres.map((c) => `<li><a href="#${c.id}" aria-label="${c.dataset.station}" title="${c.dataset.station}"></a></li>`).join("");
  function placerAnneau(id) {
    const c = document.getElementById(id), dot = c.querySelector(".dot"), ligne = $(".ligne");
    if (!dot) return;
    const y = dot.getBoundingClientRect().top + dot.offsetHeight / 2 - ligne.getBoundingClientRect().top;
    $("#anneau").style.top = y + "px";
    ligneMob.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + id)));
  }
  function allerA(id, init) {
    if (!pret) return;
    const c = document.getElementById(id);
    placerAnneau(id);
    (CARTES[c.dataset.carte] || CARTES.reseau)();
    if (c.dataset.carte === "ma-rue" && selection != null) volerVers(selection);
    else if (!init || c.dataset.carte !== "ma-rue") cadrer();
    store.set("rues_lyon_station", id);
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting && e.target.id !== actif) { actif = e.target.id; allerA(actif); } });
  }, { rootMargin: mobile() ? "-62% 0px -30% 0px" : "-40% 0px -55% 0px" });
  chapitres.forEach((c) => obs.observe(c));
  window.addEventListener("resize", () => actif && placerAnneau(actif));
  const repris = store.get("rues_lyon_station", null);
  if (repris && repris !== "ch-depart" && document.getElementById(repris)) {
    const el = $("#reprise");
    el.hidden = false;
    el.innerHTML = `<a class="btn btn-contour btn-petit" href="#${repris}">Reprendre à la station « ${document.getElementById(repris).dataset.station} »</a>`;
  }
  actif = "ch-depart";

  /* ---------------------------------------------------------------- station 1 : chaleur */
  $("#chaud-part").textContent = pct(M.chiffres.chaud_part);
  const ex = M.exemples;
  $("#duo").innerHTML = [["chaud", "En plein soleil", "#f28b68", "Aucun arbre au-dessus de la chaussée et presque pas d'ombre des immeubles : besoin très fort."],
    ["frais", "À l'ombre", "#9aa4c2", `${pct(ex.frais.can)} de la chaussée sous les arbres : la rue chauffe beaucoup moins.`]]
    .map(([k, tag, c, txt]) => `<button type="button" class="carton exemple" data-i="${ex[k].i}"><span class="tag" style="color:${c}">${tag}</span><span class="nom">${ex[k].n}</span><p>${ex[k].a} · ${txt}</p></button>`).join("");
  document.querySelectorAll(".exemple").forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.i;
    map.flyTo({ center: centre(i), zoom: 16, duration: reduit() ? 0 : 1400 });
    surligner(RUE_DE[i]);
  }));

  /* ---------------------------------------------------------------- station 2 : les quatre lignes */
  const REV = {
    R1: { d: "Le bitume issu du pétrole est remplacé par un liant d'origine végétale. Même aspect, même chantier.", atout: "Jusqu'à moitié moins de CO₂ pour fabriquer la couche (estimation).", limite: "Encore peu éprouvé sous des poids lourds très nombreux.", ou: "Rues de quartier, avenues" },
    R2: { d: "Un liant végétal transparent laisse voir des graviers clairs : la rue renvoie le soleil.", atout: "Une surface nettement moins chaude au soleil.", limite: "Se salit sous les pneus : à éviter sur les grands axes et les lignes de bus.", ou: "Rues ensoleillées, zones 30, rues piétonnes" },
    R3: { d: "Un enrobé poreux qui laisse passer la pluie vers le sol.", atout: "Moins d'eau qui ruisselle, moins de bruit de roulement.", limite: "Pas sur les pentes ni en zone inondable ; se bouche avec le trafic.", ou: "Quartiers très bétonnés, rues plates et calmes" },
    R4: { d: "On réutilise l'ancien enrobé, ravivé par un produit d'origine végétale.", atout: "Le plus faible bilan carbone, solide sous les camions et les bus.", limite: "Il reste sombre : il ne rafraîchit pas la rue.", ou: "Grands axes, lignes de bus" },
  };
  function coupe(m) {
    // coupe de chaussée : couche de surface (le revêtement), couche de base, sol
    const top = { R1: "#2b2f3a", R2: "#d8cdb4", R3: "#2b2f3a", R4: "#2f2c33" }[m];
    let grains = "";
    const rnd = d3.randomLcg(m.charCodeAt(1) / 10);
    for (let k = 0; k < 22; k++) {
      const x = 6 + rnd() * 98, y = 8 + rnd() * 14, r = 1.2 + rnd() * 1.8;
      const c = m === "R2" ? (rnd() > 0.5 ? "#f4f0e4" : "#bfb293") : m === "R4" ? (rnd() > 0.6 ? "#5b5560" : "#47434d") : "#4a4f5c";
      grains += m === "R3" && k % 3 === 0 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 0.6).toFixed(1)}" fill="#0b1230"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/>`;
    }
    const pluie = m === "R3" ? `<path d="M30 30v8M55 30v10M80 30v8" stroke="${COL.R3}" stroke-width="2" stroke-linecap="round"/>` : "";
    const soleil = m === "R2" ? `<path d="M14 2 l8 4 M40 0 l4 5 M70 1 l6 5" stroke="#f4f6fb" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>` : "";
    return `<svg class="coupe" viewBox="0 0 110 58" role="img" aria-label="Coupe de chaussée : ${NOM[m]}">
      ${soleil}<rect x="2" y="6" width="106" height="20" rx="3" fill="${top}" stroke="${COL[m]}" stroke-width="2"/>${grains}
      <rect x="2" y="28" width="106" height="12" rx="2" fill="#262b3b"/>${pluie}<rect x="2" y="42" width="106" height="14" rx="2" fill="#1a2040"/></svg>`;
  }
  $("#lignes").innerHTML = MATS.map((m) => `<article class="carton ligne-rev">${coupe(m)}<div>
      <h3><span class="troncon" style="--c:${COL[m]}" aria-hidden="true"></span>${pastille(m)} ${NOM[m]}</h3><p>${REV[m].d}</p>
      <dl><dt>Atout</dt><dd>${REV[m].atout}</dd><dt>Limite</dt><dd>${REV[m].limite}</dd><dt>Pour</dt><dd>${REV[m].ou}</dd></dl></div></article>`).join("");

  /* ---------------------------------------------------------------- station 3 : où commencer */
  $("#robuste-ha").textContent = n0(M.chiffres.robuste_ha) + " ha";
  $("#robuste-txt").textContent = `de chaussée (${n0(M.chiffres.robuste_n)} tronçons) restent prioritaires plus de 8 fois sur 10.`;
  $("#compo").innerHTML = Object.entries(M.chiffres.robuste_mat).sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `<span>${pastille(m)} ${NOM[m]} : ${pct(v)}</span>`).join("");

  /* ---------------------------------------------------------------- station 4 : et ma rue ? */
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const NOMS = IDX.map((r) => norm(r.n));
  function chercher(q) {
    q = norm(q);
    if (q.length < 2) return [];
    const mots = q.split(" ");
    const res = [];
    for (let k = 0; k < IDX.length && res.length < 40; k++) if (mots.every((w) => NOMS[k].includes(w))) res.push(k);
    return res.sort((a, b) => (NOMS[a].startsWith(q) ? 0 : 1) - (NOMS[b].startsWith(q) ? 0 : 1) || IDX[b].sf - IDX[a].sf).slice(0, 8);
  }
  function brancherRecherche(form, input, liste, versStation) {
    let res = [], sel = -1;
    const afficher = () => {
      liste.innerHTML = res.map((k, j) => `<li role="option" id="${liste.id}-${j}" aria-selected="${j === sel}" data-k="${k}">${IDX[k].n}<span>${IDX[k].a}</span></li>`).join("");
      liste.hidden = !res.length;
      input.setAttribute("aria-activedescendant", sel >= 0 ? `${liste.id}-${sel}` : "");
    };
    const choisir = (k) => { liste.hidden = true; input.value = IDX[k].n; ouvrirRue(k, versStation); };
    input.addEventListener("input", () => { res = chercher(input.value); sel = -1; afficher(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { sel = Math.min(res.length - 1, sel + 1); afficher(); e.preventDefault(); }
      if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); afficher(); e.preventDefault(); }
      if (e.key === "Escape") { liste.hidden = true; }
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); if (res.length) choisir(res[Math.max(0, sel)]); });
    liste.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) choisir(+li.dataset.k); });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) liste.hidden = true; });
  }
  brancherRecherche($("#search-top"), $("#q-top"), $("#sugg-top"), true);
  brancherRecherche($("#search-main"), $("#q-main"), $("#sugg-main"), false);

  const PRIO = { 1: ["Très forte", "parmi les 10 % de chaussées les plus utiles"], 2: ["Forte", "parmi les 30 % les plus utiles"], 3: ["Moyenne", "dans la moitié la plus utile"], 4: ["Faible", "d'autres rues passent avant"] };
  const CERT = { 4: ["Sûre", "prioritaire plus de 8 fois sur 10"], 3: ["Probable", "prioritaire 5 à 8 fois sur 10"], 2: ["Incertaine", "dépend des choix faits"], 1: ["Peu probable", "rarement prioritaire"], 0: ["—", ""] };
  function raisons(r) {
    const c = [];
    if (r.nc >= 0.7) c.push(["chaleur", "Elle chauffe beaucoup en été : le besoin de rafraîchissement est fort."]);
    else if (r.nc >= 0.45) c.push(["chaleur", "Elle chauffe en été : le besoin de rafraîchissement est moyen."]);
    if (r.can >= 0.3) c.push(["ombre", `Elle est déjà ombragée : ${pct(r.can)} de la chaussée est sous les arbres.`]);
    else if (r.ins >= 0.7) c.push(["soleil", "Presque aucun arbre n'ombrage la chaussée."]);
    if (r.ds >= 40) c.push(["fragiles", "Beaucoup d'enfants et de personnes âgées vivent autour."]);
    if (r.imp >= 0.8) c.push(["eau", "Le quartier est très bétonné : la pluie ruisselle au lieu de s'infiltrer."]);
    if (r.bus) c.push(["lourd", "Des bus y passent : il faut un revêtement très résistant."]);
    else if (["TS", "T0", "T1", "T2"].includes(r.pl)) c.push(["lourd", "Beaucoup de poids lourds : il faut un revêtement très résistant."]);
    if (r.pe > 6) c.push(["pente", "La rue est en pente : l'enrobé drainant n'y est pas adapté."]);
    if (r.inond) c.push(["inond", "La rue est en zone inondable : l'enrobé drainant n'y est pas adapté."]);
    if (["Zone 30", "Zone de rencontre", "Aire Piétonne"].includes(r.zca)) c.push(["calme", "C'est une rue apaisée, très fréquentée à pied."]);
    const ordre = { R2: ["chaleur", "soleil", "fragiles", "calme", "ombre", "eau", "lourd", "pente", "inond"], R3: ["eau", "calme", "chaleur", "fragiles", "soleil", "ombre", "lourd", "pente", "inond"],
      R4: ["lourd", "chaleur", "eau", "soleil", "fragiles", "ombre", "calme", "pente", "inond"], R1: ["calme", "ombre", "lourd", "chaleur", "eau", "soleil", "fragiles", "pente", "inond"] }[r.m] || ["chaleur", "soleil", "eau", "fragiles", "calme", "lourd", "ombre", "pente", "inond"];
    return c.sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0])).slice(0, 3).map((x) => x[1]);
  }
  function ouvrirRue(k, versStation) {
    const r = IDX[k], el = $("#fiche");
    selection = k;
    if (!r.ch) {
      el.innerHTML = `<article class="station-card hors"><div class="ligne-carte" aria-hidden="true"></div><div class="tete"><h3>${r.n}</h3><div class="arr">${r.a} · hors de l'étude : ${r.hors}</div></div></article>`;
    } else {
      const pr = PRIO[r.k] || ["—", ""], ce = CERT[r.rb] || CERT[0];
      const fut = r.y && r.y[2] ? `Dans la stratégie « transition », elle serait refaite vers <b>${r.y[2]}</b>.` : "Dans les stratégies étudiées, elle ne serait pas refaite avec un revêtement innovant avant 2050.";
      el.innerHTML = `<article class="station-card" style="--c:${COL[r.m] || "#9aa4c2"}">
        <div class="ligne-carte" aria-hidden="true"></div><div class="tete"><h3>${r.n}</h3><div class="arr">${r.a}</div></div>
        <div class="grille"><div class="case"><span class="k">Priorité</span><span class="v">${pr[0]}</span><small>${pr[1]}</small></div>
          <div class="case"><span class="k">Certitude</span><span class="v">${ce[0]}</span><small>${ce[1]}</small></div></div>
        <div class="pourquoi"><span class="k">Pourquoi</span><ol>${raisons(r).map((t) => `<li><span>${t}</span></li>`).join("") || "<li><span>Une rue sans enjeu marqué : elle passera après les autres.</span></li>"}</ol></div>
        <div class="quatre"><span class="k">Revêtement conseillé</span><div class="rang">${MATS.map((m) => `<span class="opt${m === r.m ? " on" : ""}" style="--c:${COL[m]}">${pastille(m)} ${NOM[m]}</span>`).join("")}</div></div>
        <p class="futur">${fut}</p></article>`;
    }
    surligner(k);
    if (versStation) document.getElementById("ch-ma-rue").scrollIntoView({ behavior: reduit() ? "auto" : "smooth" });
    else volerVers(k);
  }
  function centre(i) { const c = FEATS[i].geometry.coordinates; return c[Math.floor(c.length / 2)]; }
  function volerVers(k) { if (pret) map.flyTo({ center: IDX[k].c, zoom: 16, duration: reduit() ? 0 : 1400, padding: mobile() ? 0 : { left: 0, right: 0, top: 0, bottom: 0 } }); }
  let surlignes = [];
  function surligner(k) {
    surlignes.forEach((i) => map.setFeatureState({ source: "rues", id: i }, { sel: false }));
    surlignes = k == null ? [] : IDX[k].s;
    surlignes.forEach((i) => map.setFeatureState({ source: "rues", id: i }, { sel: true }));
    if (marqueur) marqueur.remove();
    if (k != null) {
      const el = document.createElement("div");
      el.className = "marqueur-station";
      marqueur = new maplibregl.Marker({ element: el }).setLngLat(IDX[k].c).addTo(map);
    }
  }

  /* ---------------------------------------------------------------- station 5 : 2050 */
  const TRAJ = M.trajectoires;
  const tr = (s, a) => TRAJ.find((r) => r.scenario === s && r.annee === a);
  $("#strategies").innerHTML = SCEN.map((s, j) => `<button type="button" role="radio" aria-checked="${j === scen}" data-j="${j}">${s.t}</button>`).join("") + `<p class="note" id="strat-d" style="flex-basis:100%;margin:6px 0 0"></p>`;
  document.querySelectorAll("#strategies button").forEach((b) => b.addEventListener("click", () => {
    scen = +b.dataset.j;
    document.querySelectorAll("#strategies button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    maj2050(true);
  }));
  const an = $("#an");
  let raf = null;
  an.addEventListener("input", () => { annee = +an.value; $("#an-out").textContent = annee; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => maj2050(true)); });
  function maj2050(carte) {
    const s = SCEN[scen], r = tr(s.id, annee);
    $("#strat-d").textContent = s.d;
    const t = r.ges_evites_tco2e, eq = Math.round(Math.abs(t) / 9 / 10) * 10;
    const co2 = t >= 0
      ? `<span class="v">${n0(t)} t</span><span class="k">de CO₂ évitées depuis 2026, soit l'empreinte carbone annuelle d'environ ${n0(eq)} Français (≈ 9 t chacun)</span>`
      : `<span class="v">${n0(t)} t</span><span class="k">de CO₂ : refaire les rues plus tôt que prévu émet d'abord plus qu'on n'économise</span>`;
    $("#bilan").innerHTML = `<div class="carton"><span class="v">${pct(r.part_chaussee_traitee)}</span><span class="k">des chaussées refaites en revêtement innovant (${n0(r.surface_totale_ha)} ha)</span></div>
      <div class="carton">${co2}</div>
      <div class="carton" style="grid-column:1/-1"><span class="v">${n0(Math.round(r.population_beneficiaire_adaptation / 1000) * 1000)}</span><span class="k">habitants vivent près d'une rue rafraîchie ou drainante</span></div>`;
    graphique();
    if (carte && actif === "ch-2050") CARTES["2050"]();
  }
  function graphique() {
    const el = $("#graph-co2"), w = Math.max(300, el.clientWidth), h = 190, m = { t: 14, r: 104, b: 24, l: 50 };
    const ans = d3.range(2026, 2051), sel = SCEN[scen].id;
    const series = SCEN.map((s) => ({ id: s.id, t: s.t, v: ans.map((a) => tr(s.id, a)) }));
    const all = TRAJ.flatMap((r) => [r.ges_evites_tco2e_p10, r.ges_evites_tco2e_p90]);
    const x = d3.scaleLinear().domain([2026, 2050]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([Math.min(0, d3.min(all)), d3.max(all)]).nice().range([h - m.b, m.t]);
    const svg = d3.create("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", "CO₂ évité en cumul selon la stratégie, de 2026 à 2050");
    svg.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")).tickSize(0)).call((g) => g.select(".domain").attr("stroke", "rgba(244,246,251,.25)"));
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => n0(v / 1000) + " kt").tickSize(-(w - m.l - m.r)))
      .call((g) => g.select(".domain").remove()).call((g) => g.selectAll(".tick line").attr("stroke", "rgba(244,246,251,.08)"));
    svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "rgba(244,246,251,.35)");
    const s0 = series.find((s) => s.id === sel);
    svg.append("path").attr("d", d3.area().x((r) => x(r.annee)).y0((r) => y(r.ges_evites_tco2e_p10)).y1((r) => y(r.ges_evites_tco2e_p90))(s0.v)).attr("fill", "rgba(244,246,251,.12)");
    const lab = [];
    series.sort((a, b) => (a.id === sel) - (b.id === sel)).forEach((s) => {
      const on = s.id === sel;
      svg.append("path").attr("d", d3.line().x((r) => x(r.annee)).y((r) => y(r.ges_evites_tco2e))(s.v)).attr("fill", "none").attr("stroke", on ? PORC : "rgba(244,246,251,.35)").attr("stroke-width", on ? 3 : 1.6);
      lab.push({ y: y(s.v[s.v.length - 1].ges_evites_tco2e), t: s.t, on });
    });
    lab.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
    lab.forEach((l) => svg.append("text").attr("class", "lab").attr("x", w - m.r + 8).attr("y", l.y).attr("dy", ".35em").style("fill", l.on ? PORC : "#9aa4c2").text(l.t));
    svg.append("line").attr("x1", x(annee)).attr("x2", x(annee)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", PORC).attr("stroke-dasharray", "3 3");
    svg.append("circle").attr("cx", x(annee)).attr("cy", y(tr(sel, annee).ges_evites_tco2e)).attr("r", 6).attr("fill", "#0b1230").attr("stroke", PORC).attr("stroke-width", 3);
    el.innerHTML = "";
    el.appendChild(svg.node());
    el.insertAdjacentHTML("beforeend", `<p class="note" style="margin-top:6px">CO₂ évité en cumul par rapport à des chantiers classiques. Zone claire : fourchette selon les incertitudes.</p>`);
  }

  /* ---------------------------------------------------------------- station 6 : votre avis */
  const AVIS = [["chaleur", "Rafraîchir les rues en été"], ["sante", "Protéger les plus fragiles (enfants, personnes âgées)"], ["eau", "Mieux absorber la pluie"],
    ["carbone", "Réduire le CO₂ des chantiers"], ["usages", "Des rues agréables à pied et à vélo"]];
  const CLE = "rues_lyon_avis_v1";
  $("#avis-options").innerHTML = AVIS.map(([k, t]) => `<label class="opt"><input type="checkbox" name="avis" value="${k}"><span>${t}</span></label>`).join("");
  const cases = [...document.querySelectorAll('#avis input[name="avis"]')];
  cases.forEach((c) => c.addEventListener("change", () => {
    const n = cases.filter((x) => x.checked).length;
    cases.forEach((x) => { x.disabled = !x.checked && n >= 2; });
    $("#avis-envoyer").disabled = n === 0;
  }));
  $("#avis").addEventListener("submit", (e) => {
    e.preventDefault();
    const choix = cases.filter((x) => x.checked).map((x) => x.value);
    if (!choix.length) return;
    const liste = store.get(CLE, []);
    liste.push({ t: new Date().toISOString(), c: choix });
    store.set(CLE, liste);
    cases.forEach((x) => { x.checked = false; x.disabled = false; });
    $("#avis-envoyer").disabled = true;
    resultatsAvis(true);
    carteAvis();
  });
  function comptes() {
    const liste = store.get(CLE, []);
    const n = {};
    AVIS.forEach(([k]) => (n[k] = 0));
    liste.forEach((r) => r.c.forEach((k) => (n[k] = (n[k] || 0) + 1)));
    return { liste, n };
  }
  function resultatsAvis(merci) {
    const { liste, n } = comptes(), el = $("#avis-resultats");
    if (!liste.length) { el.innerHTML = ""; return; }
    const max = Math.max(1, ...Object.values(n));
    el.innerHTML = `${merci ? `<p><b>Merci !</b> Votre avis est enregistré sur cet appareil.</p>` : ""}
      <p class="note" style="margin-bottom:6px">${liste.length} avis recueilli${liste.length > 1 ? "s" : ""} sur cet appareil :</p>
      ${AVIS.map(([k, t]) => `<div class="barre"><span>${t}<span class="t"><i style="width:${(100 * n[k]) / max}%"></i></span></span><b>${n[k]}</b></div>`).join("")}
      <div class="outils"><button type="button" class="btn btn-contour btn-petit" id="avis-export">Exporter les réponses (CSV)</button>
      <button type="button" class="btn btn-contour btn-petit" id="avis-effacer">Effacer les réponses de cet appareil</button></div>`;
    $("#avis-export").addEventListener("click", () => {
      const lignes = ["date;choix_1;choix_2"].concat(liste.map((r) => [r.t, r.c[0] || "", r.c[1] || ""].join(";")));
      const url = URL.createObjectURL(new Blob(["﻿" + lignes.join("\n")], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "avis_rues_lyon.csv" });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    $("#avis-effacer").addEventListener("click", () => {
      if (!confirm("Effacer tous les avis enregistrés sur cet appareil ?")) return;
      store.set(CLE, []);
      resultatsAvis(false);
      carteAvis();
    });
  }
  function carteAvis() {
    if (!pret || actif !== "ch-avis") return;
    const { liste, n } = comptes();
    const tot = Object.values(n).reduce((a, b) => a + b, 0);
    const w = M.enjeux.map((e) => (n[e] + 1) / (tot + 5));
    const apt = new Float32Array(N), mat = new Array(N).fill("");
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (!p.ch) continue;
      let best = 0, bm = "";
      for (let m = 0; m < 4; m++) {
        let s = 0;
        for (let g = 0; g < 5; g++) s += w[g] * M.P[m][g] * p.N[g];
        s *= p.C[m];
        if (s > best) { best = s; bm = MATS[m]; }
      }
      apt[i] = best; mat[i] = bm;
    }
    const ordre = [...Array(N).keys()].filter((i) => P[i].ch && apt[i] > 0).sort((a, b) => apt[b] - apt[a]);
    const garde = new Uint8Array(N);
    ordre.slice(0, Math.round(ordre.length * 0.2)).forEach((i) => (garde[i] = 1));
    peindre({ type: "cat", v: (p, i) => mat[i], off: (p, i) => !garde[i], w: () => 1.6,
      legende: lignesLegende(liste.length ? `Rues prioritaires selon ${liste.length} avis` : "Rues prioritaires (enjeux à égalité)", liste.length ? "Recalculé à chaque avis" : "Donnez votre avis pour la modifier") });
  }

  /* ---------------------------------------------------------------- interactions carte */
  function lierCarte() {
    const bulle = $("#bulle");
    map.on("mousemove", "rues-clic", (e) => {
      const i = e.features[0] && e.features[0].id;
      if (i == null) return;
      const k = RUE_DE[i];
      map.getCanvas().style.cursor = "pointer";
      bulle.innerHTML = `<b>${IDX[k].n}</b><br>${IDX[k].ch && IDX[k].m ? `${NOM[IDX[k].m]} conseillé` : IDX[k].ch ? "Priorité faible" : "Hors de l'étude"}`;
      bulle.hidden = false;
      const r = map.getContainer().getBoundingClientRect();
      let x = e.point.x + 14, y = e.point.y + 14;
      if (x + bulle.offsetWidth > r.width - 8) x = e.point.x - bulle.offsetWidth - 12;
      bulle.style.left = x + "px"; bulle.style.top = y + "px";
    });
    map.on("mouseleave", "rues-clic", () => { bulle.hidden = true; map.getCanvas().style.cursor = ""; });
    map.on("click", "rues-clic", (e) => { const i = e.features[0] && e.features[0].id; if (i != null) ouvrirRue(RUE_DE[i], actif !== "ch-ma-rue"); });
  }

  maj2050(false);
  resultatsAvis(false);
  window.GP = { ouvrirRue, allerA, map, IDX };
})();
