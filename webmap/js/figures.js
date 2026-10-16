/* Les figures de la démonstration (mode présentation) et l'atelier d'exploration.
   Chaque figure : no, mission, short, camera, enter(state) [carte + outils + panneaux + légende-figure]. */
(function () {
  const M = window.DG_META;
  const n0 = (v) => CH.n0(v), n1 = (v) => CH.n1(v), n2 = (v) => CH.n2(v), pct = (v) => CH.pct(v);
  const LIVE = (s) => `<span class="live">${s}</span>`;
  const STN = (k) => `<span class="stn">${APP.stationNo(k)}</span>`;
  const MATS = ["R1", "R2", "R3", "R4"];
  const matLab = (c) => `${c} ${M.materiaux[c].court.toLowerCase()}`;
  const matChip = (c) => `<span class="mat" style="--c:${PAL.mat[c]}">${c} ${M.materiaux[c].court}</span>`;
  const PROF_SHORT = { equilibre: "Équilibré", adaptation: "Adaptation", bas_carbone: "Bas-carbone", eau_sols: "Eau & sols", justice: "Justice env." };
  const WCLS = { 1: 2.7, 2: 1.75, 3: 1.05, 4: 0.55 };
  const LIB_N = ["Chaleur", "Santé", "Eau", "Carbone", "Usages"];

  // surface (ha) et moyennes sur le champ
  function surfHa(pred) { let s = 0; for (let i = 0; i < APP.N; i++) if (APP.CHAMP[i] && pred(APP.P[i], i)) s += APP.SURF[i]; return s / 1e4; }
  let _champ = null;
  const champHa = () => (_champ == null ? (_champ = surfHa(() => true)) : _champ);
  const posteP = (k) => APP.P[M.postes[k].i];
  const traj = (sc, an) => M.trajectoires.find((r) => r.scenario === sc && r.annee === an);
  const synth = (prof) => M.synthese_classes.filter((r) => r.profil === M.profils.find((p) => p.id === prof).nom);

  // carte miniature (petits multiples) dessinée sur canvas
  function miniMap(canvas, valueFn, stops) {
    const lon = M.bornes.lon, lat = M.bornes.lat, k = Math.cos((lat[0] + lat[1]) / 2 * Math.PI / 180);
    const W = canvas.width, H = canvas.height, sx = W / ((lon[1] - lon[0]) * k), sy = H / (lat[1] - lat[0]), s = Math.min(sx, sy) * 0.94;
    const ox = (W - (lon[1] - lon[0]) * k * s) / 2, oy = (H - (lat[1] - lat[0]) * s) / 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fcfcfb"; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, W / 260);
    const order = [];
    for (let i = 0; i < APP.N; i++) if (APP.CHAMP[i]) order.push(i);
    order.sort((a, b) => (valueFn(APP.P[a]) || 0) - (valueFn(APP.P[b]) || 0));
    for (const i of order) {
      const g = window.DG_TRONCONS.features[i].geometry;
      const parts = g.type === "LineString" ? [g.coordinates] : g.coordinates;
      ctx.strokeStyle = PAL.at(stops, valueFn(APP.P[i]));
      ctx.beginPath();
      parts.forEach((pts) => pts.forEach((c, j) => {
        const x = ox + (c[0] - lon[0]) * k * s, y = H - (oy + (c[1] - lat[0]) * s);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }));
      ctx.stroke();
    }
  }

  const priorityLegend = (title) => ({
    title, items: MATS.map((c) => ({ color: PAL.mat[c], label: `${c} ${M.materiaux[c].court}` })),
    widths: [{ w: 5, label: "P1 · 10 % de la surface la plus apte" }, { w: 3.4, label: "P2 · 10–30 %" }, { w: 2, label: "P3 · 30–60 %" }, { w: 1, label: "P4 · reste" }],
  });

  const FIGS = [];

  /* ======================================================== Fig. 0 — résumé graphique */
  FIGS.push({
    no: 0, mission: "Résumé", short: "Où, et avec quel revêtement ?", split: [1.18, 1],
    enter() {
      APP.paint({
        kind: "cat", colors: MATS.map((c) => PAL.mat[c]),
        value: (p) => (p.rb >= 3 ? APP.MATI[p.M[0]] ?? -1 : -1),
        width: (p) => (p.rb === 4 ? 2.4 : 1.1),
        hover: (p) => `${["", "rarement", "incertain", "probable", "robuste"][p.rb]} · P(top 20 %) ${pct(p.p20)} · ${p.M[0] !== "—" ? matLab(p.M[0]) : ""}`,
        legend: { title: "Priorités et revêtement recommandé", items: MATS.map((c) => ({ color: PAL.mat[c], label: `${c} ${M.materiaux[c].court}` })),
          widths: [{ w: 4.6, label: "Prioritaire robuste (≥ 80 % des tirages)" }, { w: 2, label: "Prioritaire probable (50–80 %)" }] },
      });
      APP.tools("");
      this.panels();
      const C = M.chiffres;
      APP.caption(`<span class="fig">Fig. 0 |</span> <span class="ttl">Où renouveler la voirie lyonnaise avec un revêtement biosourcé, et lequel ?</span>
        <b>a,</b> Tronçons prioritaires dans plus de 80 % (trait épais) ou 50 à 80 % (trait fin) des 3&nbsp;000 simulations Monte-Carlo, colorés selon le revêtement recommandé par le profil équilibré : ${LIVE(n0(C.robuste) + " tronçons robustes, " + n0(C.robuste_ha) + " ha de chaussée")}.
        <b>b,</b> Chaîne de traitement, de la donnée à la prospective. <b>c,</b> Chiffres clés.`, true);
    },
    panels() {
      APP.panel("b", "Chaîne de traitement", (el) => CH.pipeline(el, [
        { k: "1 · Données", t: "Base multi-sources", n: `${M.chiffres.couches} couches`, d: "IGN, INSEE, Cerema, Métropole de Lyon, Géorisques ; services web, catalogue, contrôle qualité." },
        { k: "2 · Indicateurs", t: "Besoins N par tronçon", n: "5 enjeux", d: "Ombrage des houppiers, rapport H/L, ICU, imperméabilisation, population sensible, usages." },
        { k: "3 · Matrice", t: "Matériau × territoire", n: "4 revêtements", d: "Performances P et compatibilités C (trafic PL, bus, pente, inondation)." },
        { k: "4 · AMC", t: "Poids AHP, 5 profils", n: "RC < 0,01", d: "Score = Σ poids × C × P × N ; classes P1–P4 par part de surface." },
        { k: "5 · Robustesse", t: "Monte-Carlo, OAT", n: "3 000 tirages", d: "Préférences (Dirichlet) et matériaux (triangulaire) ; sensibilité un-à-un." },
        { k: "6 · Prospective", t: "2026–2050, 4 scénarios", n: "TRACC +2,7 °C", d: "Renouvellements simulés, trajectoires territoriales, GES évités, bénéficiaires." },
      ]));
      APP.panel("c", "Chiffres clés", (el) => {
        const C = M.chiffres, p1 = synth("equilibre").find((r) => r.classe === "P1");
        const s2 = traj("S2", 2050), sm = M.sensibilite_materiaux.slice().sort((a, b) => a.jaccard_top20 - b.jaccard_top20)[0];
        const rows = [
          { k: "Territoire", v: `Lyon, 9 arrondissements, ${n0(Math.round(C.population / 1000))} 000 habitants fiscaux (Filosofi 2021)` },
          { k: "Données", v: `${C.couches} couches, 5 producteurs, ${n0(C.batiments)} bâtiments, ${n0(C.arbres)} arbres d'alignement` },
          { k: "Voirie analysée", v: `${n0(C.troncons)} tronçons, ${n0(C.km)} km, ${n2(C.surface_km2)} km² (${n0(C.troncons_champ)} dans le champ)` },
          { k: "Priorités robustes", v: `${n0(C.robuste)} tronçons, ${n0(C.robuste_ha)} ha` },
          { k: "Revêtement en P1", v: `${pct(p1.part_R2)} en enrobé clair (profil équilibré)` },
          { k: "Paramètre clé", v: `albédo de ${matLab(sm.materiau)} (${pct(1 - sm.jaccard_top20)} du top 20 % modifié)` },
          { k: "GES évités 2026–2050", v: `${n1(s2.ges_evites_tco2e / 1000)} kt CO₂e en massification (S2), intervalle ${n1(s2.ges_evites_tco2e_p10 / 1000)}–${n1(s2.ges_evites_tco2e_p90 / 1000)}` },
        ];
        CH.table(el, [{ key: "k", label: "Table 1 · Indicateur" }, { key: "v", label: "Valeur" }], rows);
        return { cols: [{ key: "k", label: "Indicateur" }, { key: "v", label: "Valeur" }], rows };
      });
    },
  });

  /* ======================================================== Fig. 1 — données */
  FIGS.push({
    no: 1, mission: "1 · Données", short: "Un territoire décrit tronçon par tronçon",
    enter() {
      const IDX = { TS: 0, T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
      const cols = ["#14181f", "#26356a", "#43548a", "#6576a9", "#8d9cc6", "#b9c3de"];
      APP.paint({
        kind: "cat", colors: cols, dash: true,
        value: (p) => IDX[p.pl], width: (p) => [2, 1.7, 1.4, 1.15, 1, 0.85][IDX[p.pl]],
        hover: (p) => `Classe ${p.pl} (${p.pls ? "imputée" : "relevé Métropole"}) · ${n0(p.tm)} véh./j ${p.tms ? "comptés" : "estimés"}`,
        legend: { title: "Trafic poids lourds (PL/jour/sens)", items: [
          { color: cols[0], label: "T0 · plus de 750" }, { color: cols[1], label: "T1 · 301 à 750" }, { color: cols[2], label: "T2 · 151 à 300" },
          { color: cols[3], label: "T3 · 51 à 150" }, { color: cols[4], label: "T4 · 26 à 50" }, { color: cols[5], label: "T5 · 0 à 25" },
          { color: "#6576a9", label: "tireté : classe imputée", dash: true }, { color: "#cfd2d6", label: "hors champ (privé, pavés, dalles)" }] },
      });
      APP.tools("");
      this.panels();
      APP.caption(`<span class="fig">Fig. 1 |</span> <span class="ttl">Un territoire décrit tronçon par tronçon.</span>
        <b>a,</b> Classe de trafic poids lourds des ${n0(M.chiffres.troncons)} tronçons de la voirie métropolitaine (${n0(M.chiffres.km)} km) ; en tireté, classe imputée par le mode des tronçons de même réseau PL, hiérarchie et desserte bus (${LIVE(pct(M.chiffres.pl_imputee))} des tronçons).
        <b>b,</b> Catalogue des ${M.chiffres.couches} couches extraites par services web (WFS, API) ou archives officielles, horodatées et tracées. <b>c,</b> Complétude à la source des attributs critiques et traitement des manques.`, true);
    },
    panels() {
      APP.panel("b", `Catalogue des données (${M.catalogue.length} couches, 5 producteurs)`, (el) => {
        const ORD = ["Administratif", "Réseau routier", "Mobilités", "Réglementation", "Relief", "Bâti", "Végétation", "Climat urbain", "Socio-économie", "Équipements", "Risques", "Hydrographie"];
        const all = M.catalogue.map((r) => ({ t: r.theme, i: r.intitule, p: r.producteur.replace(" / SYTRAL", "").replace("MTECT / DREAL (Géorisques)", "Géorisques"), n: +r.nb_objets || null }))
          .sort((a, b) => ORD.indexOf(a.t) - ORD.indexOf(b.t) || a.i.localeCompare(b.i, "fr"));
        const COURT = { "Métropole de Lyon": "voirie (trafic PL, largeurs, pentes, revêtements), îlots de chaleur, arbres, comptages, bus, tram, arrêts, cyclable, ZFE, canopée",
          IGN: "bâtiments, végétation, établissements, surfaces en eau, arrondissements, altitudes RGE ALTI",
          INSEE: "carreaux 200 m Filosofi 2021 : population, âges, revenus, pauvreté", Cerema: "zones climatiques locales et morphologie (SPOT 2022)",
          "Géorisques": "aléa inondation par débordement, scénarios moyen et extrême" };
        const rows = d3.groups(all, (r) => r.p).map(([p, l]) => ({ p, c: l.length, i: COURT[p] || l.map((r) => r.i).join(", "), n: d3.sum(l, (r) => r.n) }))
          .sort((a, b) => b.c - a.c);
        CH.table(el, [{ key: "p", label: "Producteur" }, { key: "c", label: "Couches", r: 1 }, { key: "i", label: "Contenu utile au projet" }, { key: "n", label: "Objets", r: 1, fmt: n0 }], rows);
        d3.select(el).append("p").attr("class", "note").text("Bouton « Tableau » : liste détaillée des couches, avec thème et volume.");
        return { cols: [{ key: "t", label: "Thème" }, { key: "i", label: "Couche" }, { key: "p", label: "Producteur" }, { key: "n", label: "Objets", r: 1, fmt: n0 }], rows: all };
      });
      APP.panel("c", "Complétude à la source", (el) => {
        const share = (f) => APP.P.filter(f).length / APP.N;
        const res = CH.barsH(el, [
          { label: "Classe de trafic PL", value: share((p) => !p.pls), sub: "manque : mode des tronçons semblables" },
          { label: "Surface de chaussée", value: share((p) => p.ss), sub: "manque : longueur × largeur type" },
          { label: "Pente moyenne", value: share((p) => p.ps), sub: "manque : RGE ALTI (IGN), 3 points" },
          { label: "Trafic compté (< 25 m)", value: share((p) => p.tms), sub: "manque : médiane du type de voie" },
        ], { max: 1, colLabel: "Attribut", valLabel: "Renseigné" });
        d3.select(el).append("p").attr("class", "note").html("Contrôle croisé des pentes Métropole / RGE ALTI sur 5&nbsp;700 tronçons de plus de 30 m : ρ de Spearman = 0,69, écart médian 0,5 point. Hauteurs de bâti estimées : 1,7 %. Crèches absentes de la BD TOPO : la petite enfance passe par les 0–5 ans de Filosofi.");
        return res;
      });
    },
  });

  /* ======================================================== Fig. 2 — besoins */
  const NEEDS = [{ v: 0, t: "Chaleur" }, { v: 1, t: "Santé" }, { v: 2, t: "Eau" }, { v: 4, t: "Usages" }];
  const FORMULE = {
    0: "N<sub>chaleur</sub> = norm[ besoin × (0,3 + 0,7 × insolation) ]. Besoin = 0,45 exposition de jour + 0,25 exposition de nuit (ICU Métropole) + 0,30 potentiel LCZ (Cerema). Insolation = (1 − canopée des houppiers) × (0,4 + 0,6 × SVF), SVF = cos(arctan 2H/L).",
    1: "N<sub>santé</sub> = norm[ vulnérabilité × (0,3 + 0,7 × insolation) × (0,5 + 0,5 × besoin chaleur) ]. Vulnérabilité = 0,35 densité des 0–5 ans et 65 ans et plus + 0,25 précarité + 0,20 proximité d'un établissement sensible + 0,20 vulnérabilité ICU.",
    2: "N<sub>eau</sub> = norm[ part imperméable (bâti + voirie) du voisinage de 100 m, d'après les indicateurs morphologiques des LCZ du Cerema ].",
    4: "N<sub>usages</sub> = norm[ 0,30 apaisement (zone 30, rencontre, piétonne) + 0,15 aménagement cyclable + 0,20 arrêts TC à 150 m + 0,35 densité de population ].",
  };
  const needRamp = (k) => (k === 0 ? PAL.ramps.chaleur : PAL.ramps.indic);
  FIGS.push({
    no: 2, mission: "2 · Indicateurs", short: "Quatre besoins territoriaux",
    enter(st) {
      const draw = () => {
        const k = st.need, lib = LIB_N[k];
        APP.paint({
          kind: "seq", stops: needRamp(k), domain: [0, 1], value: (p) => p.N[k],
          hover: (p) => `N ${lib.toLowerCase()} ${n2(p.N[k])} · insolation ${n2(p.ins)} · H/L ${n2(p.hl)}`,
          legend: { title: `Besoin « ${lib} » (N, normalisé)`, min: "0 · le plus faible", max: "1 · le plus fort" },
        });
        APP.stations(k === 0 ? ["chaleur"] : [], { chaleur: `<b>${STN("chaleur")} ${M.postes.chaleur.nom}</b><br>N chaleur ${n2(posteP("chaleur").N[0])}, insolation ${n2(posteP("chaleur").ins)}` });
        this.panels(st);
        const hi = surfHa((p) => p.N[k] > 0.7);
        APP.caption(`<span class="fig">Fig. 2 |</span> <span class="ttl">Quatre besoins territoriaux, de 0 (le plus faible) à 1 (le plus fort de Lyon).</span>
          <b>a,</b> Besoin « ${lib.toLowerCase()} » par tronçon, normalisé entre les 2<sup>e</sup> et 98<sup>e</sup> centiles des ${n0(M.chiffres.troncons_champ)} tronçons du champ : ${LIVE(pct(hi / champHa()) + " de la surface de chaussée dépasse 0,7")}.
          ${k === 0 ? `${STN("chaleur")} ${M.postes.chaleur.nom} cumule exposition forte et absence d'ombrage.` : ""}
          <b>b,</b> Les quatre besoins en petits multiples : cliquer pour changer la carte. <b>c,</b> Formule et distribution.`, true);
      };
      APP.tools(APP.seg("need", NEEDS, st.need, "Besoin"), (r) => APP.onSeg(r, "need", (v) => { st.need = +v; draw(); }));
      draw();
    },
    panels(st) {
      APP.panel("b", "Les quatre besoins (petits multiples)", (el) => {
        const wrap = d3.select(el).append("div").attr("class", "multiples");
        const box = CH.box(el);
        const cw = Math.floor((box.w - 10) / 2), chh = Math.max(90, Math.min(Math.floor((box.h - 24) / 2), Math.round(cw * 0.92)));
        NEEDS.forEach((nd) => {
          const b = wrap.append("button").attr("type", "button").attr("class", "mini").attr("aria-pressed", String(nd.v === st.need))
            .attr("aria-label", "Afficher le besoin " + nd.t);
          const cv = b.append("canvas").attr("width", cw * 2).attr("height", chh * 2).style("height", chh + "px").node();
          b.append("span").text(nd.t);
          miniMap(cv, (p) => p.N[nd.v], needRamp(nd.v));
          b.on("click", () => { st.need = nd.v; document.querySelectorAll('[data-seg="need"] button').forEach((x) => x.setAttribute("aria-checked", String(+x.dataset.v === nd.v))); FIGS[2].enter(st); });
        });
        return null;
      });
      APP.panel("c", "Formule et distribution", (el) => {
        d3.select(el).append("p").style("margin", "0 0 8px").style("font-size", ".82rem").html(FORMULE[st.need]);
        const vals = []; for (let i = 0; i < APP.N; i++) if (APP.CHAMP[i]) vals.push(APP.P[i].N[st.need]);
        const ps = st.need === 0 ? posteP("chaleur").N[0] : null;
        return CH.hist(el, vals, { stops: needRamp(st.need), domain: [0, 1], bins: 20, xlab: `N ${LIB_N[st.need].toLowerCase()}`, reserve: 70, mark: ps, markLabel: ps != null ? String(APP.stationNo("chaleur")) : "" });
      });
    },
  });

  /* ======================================================== Fig. 3 — matrice matériau-territoire */
  FIGS.push({
    no: 3, mission: "2 · Indicateurs", short: "La matrice matériau-territoire",
    enter(st) {
      const draw = () => {
        const m = st.mat, code = MATS[m];
        APP.paint({
          kind: "seq", stops: PAL.ramps[code], domain: [0, 1], value: (p) => p.A[m],
          hover: (p) => `Aptitude ${code} ${n2(p.A[m])} · compatibilité C ${n2(p.C[m])} · ${p.pl}, pente ${n1(p.pe)} %`,
          legend: { title: `Aptitude propre · ${code} ${M.materiaux[code].court}`, min: "0 · incompatible", max: "1 · aptitude maximale",
            note: "Gris : hors champ. Aptitude = C × moyenne des bénéfices P·N" },
        });
        const tags = {
          pente: `<b>${STN("pente")} ${M.postes.pente.nom}</b><br>pente ${n1(posteP("pente").pe)} % : drainant exclu (C<sub>R3</sub> = ${n2(posteP("pente").C[2])})`,
          inondation: `<b>${STN("inondation")} ${M.postes.inondation.nom}</b><br>zone inondable : C<sub>R3</sub> = ${n2(posteP("inondation").C[2])}`,
        };
        APP.stations(code === "R3" ? ["pente", "inondation"] : [], tags);
        APP.context({ inond: code === "R3" });
        this.panels(st);
        const zero = surfHa((p) => p.C[m] === 0), hi = surfHa((p) => p.A[m] >= 0.6);
        APP.caption(`<span class="fig">Fig. 3 |</span> <span class="ttl">La matrice matériau-territoire.</span>
          <b>a,</b> Aptitude propre de ${matChip(code)} : compatibilité technique C × bénéfices P·N, enjeux à poids égaux, rapportée au maximum atteignable par ce revêtement ; ${LIVE(pct(zero / champHa()) + " de la surface lui est fermée (C = 0), " + pct(hi / champHa()) + " très favorable (≥ 0,6)")}.
          ${code === "R3" ? `${STN("pente")} pente excessive, ${STN("inondation")} zone inondable (aplat bleu) : deux contraintes qui excluent l'enrobé drainant.` : ""}
          <b>b,</b> Indices de performance P par enjeu et compatibilité selon la classe de trafic poids lourds. <b>c,</b> Hypothèses bas / central / haut : ordres de grandeur à consolider par les essais des partenaires matériaux.`, true);
      };
      APP.tools(APP.seg("mat", MATS.map((c, i) => ({ v: i, t: `${c} ${M.materiaux[c].court}` })), st.mat, "Revêtement"), (r) => APP.onSeg(r, "mat", (v) => { st.mat = +v; draw(); }));
      draw();
    },
    panels() {
      APP.panel("b", "Performances P et compatibilité trafic C", (el) => {
        const tc = d3.select(el).append("div").attr("class", "twocol");
        const a = tc.append("div"), b = tc.append("div");
        a.append("p").attr("class", "subhead").text("Performance P par enjeu (0 à 1)");
        const r1 = CH.matrix(a.node(), { rows: MATS, cols: ["Chaleur", "Santé", "Eau", "Carbone", "Usages"], values: M.P, rowColor: (i) => PAL.mat[MATS[i]],
          color: (v) => PAL.at(PAL.ramps.gris, v * 0.45), fmt: n2, rowW: 40, cellH: 30, headH: 22,
          tip: (v, i, j) => `<b>${MATS[i]} ${M.materiaux[MATS[i]].court}</b><br>${M.lib_enjeux[M.enjeux[j]]} : P = ${n2(v)}` });
        b.append("p").attr("class", "subhead").text("Compatibilité C selon le trafic PL");
        const cl = ["T0", "T1", "T2", "T3", "T4", "T5"];
        CH.matrix(b.node(), { rows: MATS, cols: cl, values: MATS.map((c) => cl.map((t) => M.materiaux[c].trafic[t])), rowColor: (i) => PAL.mat[MATS[i]],
          color: (v, i) => (v === 0 ? "#f2f3f4" : PAL.at(PAL.ramps[MATS[i]], 0.08 + v * 0.47)), fmt: (v) => (v === 0 ? "—" : n2(v)), rowW: 40, cellH: 30, headH: 22,
          tip: (v, i, j) => `<b>${MATS[i]} ${M.materiaux[MATS[i]].court}</b> en classe ${cl[j]} : ${v === 0 ? "exclu" : "C = " + n2(v)}<br>${M.materiaux[MATS[i]].logique}` });
        d3.select(el).append("p").attr("class", "note").html("Autres contraintes de C : ligne de bus (R2 × 0,5, R3 × 0,3), vitesse ≥ 50 km/h (R2 × 0,7), pente (R3 nul au-delà de 6 %), zone inondable (R3 × 0,3), encrassement par le trafic (R2, R3), petits chantiers (R4 × 0,8).");
        return r1;
      });
      APP.panel("c", "Hypothèses matériaux (bas, central, haut)", (el) => CH.ranges(el, {
        items: MATS.map((c) => ({ code: c, court: M.materiaux[c].court, color: PAL.mat[c], ...M.materiaux[c] })),
        params: [
          { key: "albedo", label: "Albédo", domain: [0.05, 0.5], fmt: d3.format(".2f"), ref: 0.10 },
          { key: "reduction_ges", label: "Réduction des GES par tonne", domain: [0, 0.7], fmt: CH.pct },
          { key: "duree_vie", label: "Durée de vie (ans)", domain: [6, 18], fmt: d3.format("d"), ref: 15 },
        ],
      }));
    },
  });

  /* ======================================================== Fig. 4 — AHP et priorités */
  FIGS.push({
    no: 4, mission: "3 · Analyse multicritère", short: "Cinq profils d'acteurs",
    enter(st) {
      const draw = () => {
        const k = st.prof, id = APP.PROF[k], pr = M.profils[k];
        APP.paint({
          kind: "cat", colors: MATS.map((c) => PAL.mat[c]),
          value: (p) => (p.K[k] ? APP.MATI[p.M[k]] ?? -1 : -1), width: (p) => WCLS[p.K[k]] || 0.5,
          hover: (p) => `Profil ${PROF_SHORT[id]} : P${p.K[k]} · ${p.M[k] !== "—" ? matLab(p.M[k]) : "—"} · score ${n2(p.S[k])}`,
          legend: priorityLegend(`Priorité · profil ${pr.nom}`),
        });
        APP.stations(["eau"], { eau: `<b>${STN("eau")} ${M.postes.eau.nom}</b><br>${matLab("R3")} en P1 du profil Eau & sols : rue plate, voisinage imperméable à ${pct(posteP("eau").imp)}` });
        this.panels(st);
        const p1 = synth(id).find((r) => r.classe === "P1");
        const dom = MATS.slice().sort((a, b) => p1["part_" + b] - p1["part_" + a])[0];
        const ahp = M.ahp.find((r) => r.profil === pr.nom);
        APP.caption(`<span class="fig">Fig. 4 |</span> <span class="ttl">Cinq profils d'acteurs, cinq cartes de priorité.</span>
          <b>a,</b> Revêtement recommandé (couleur) et classe de priorité (épaisseur) pour le profil « ${pr.nom} », porté par : ${pr.acteur.replace(/\s*\(.*?\)/, "").toLowerCase()}. En P1, ${LIVE(n1(p1.surface_ha) + " ha dont " + pct(p1["part_" + dom]) + " en " + matLab(dom))}.
          ${STN("eau")} ${M.postes.eau.nom} bascule vers l'enrobé drainant dès que l'eau pèse davantage.
          <b>b,</b> Poids des enjeux par comparaison par paires (AHP, échelle de Saaty) ; ratio de cohérence ${n2(ahp.ratio_coherence)} (seuil 0,10). <b>c,</b> Composition des classes : P1 = 10 % de la surface de chaussée la plus apte, P2 = 10–30 %, P3 = 30–60 %, P4 = reste.`, true);
      };
      APP.tools(APP.seg("prof", M.profils.map((p, i) => ({ v: i, t: PROF_SHORT[p.id] })), st.prof, "Profil"), (r) => APP.onSeg(r, "prof", (v) => { st.prof = +v; draw(); }));
      this._draw = draw;
      draw();
    },
    panels(st) {
      APP.panel("b", "Poids AHP des cinq enjeux, par profil", (el) => CH.weights(el, {
        enjeux: M.enjeux, lib: { chaleur: "Chaleur", sante: "Santé", eau: "Eau", carbone: "Carbone", usages: "Usages" },
        profiles: M.profils.map((p) => ({ ...p, cr: M.ahp.find((r) => r.profil === p.nom).ratio_coherence })), selected: APP.PROF[st.prof],
        onSelect: (id) => { st.prof = APP.PROF.indexOf(id); document.querySelectorAll('[data-seg="prof"] button').forEach((x) => x.setAttribute("aria-checked", String(+x.dataset.v === st.prof))); FIGS[4]._draw(); },
      }));
      APP.panel("c", "Surface par classe et par revêtement", (el) => CH.stacked(el, {
        rows: synth(APP.PROF[st.prof]).map((r) => ({ label: r.classe, total: r.surface_ha, parts: { R1: r.part_R1, R2: r.part_R2, R3: r.part_R3, R4: r.part_R4 } })),
      }));
    },
  });

  /* ======================================================== Fig. 5 — deux logiques */
  FIGS.push({
    no: 5, mission: "3 · Analyse multicritère", short: "Deux logiques de priorité",
    enter() {
      const tA = APP.profileTop[1], tC = APP.profileTop[2];
      APP.paint({
        kind: "cat", colors: [PAL.ink, PAL.mat.R2, PAL.mat.R4],
        value: (p, i) => (tA[i] && tC[i] ? 0 : tA[i] ? 1 : tC[i] ? 2 : -1), width: () => 1.7,
        hover: (p, i) => (tA[i] && tC[i] ? "Prioritaire pour les deux profils" : tA[i] ? "Prioritaire « adaptation » seulement" : tC[i] ? "Prioritaire « bas-carbone » seulement" : "Hors des 20 % prioritaires") + ` · ${p.h}`,
        legend: { title: "20 % de la surface la plus prioritaire", items: [
          { color: PAL.mat.R2, label: "Adaptation chaleur & santé seulement" }, { color: PAL.mat.R4, label: "Bas-carbone seulement" }, { color: PAL.ink, label: "Les deux profils" }] },
      });
      APP.tools("");
      APP.stations(["carbone"], { carbone: `<b>${STN("carbone")} ${M.postes.carbone.nom}</b><br>P1 bas-carbone (${matLab("R4")}), P${posteP("carbone").K[1]} en adaptation` });
      this.panels();
      const both = surfHa((p, i) => tA[i] && tC[i]), a = surfHa((p, i) => tA[i]);
      const rho = M.spearman.adaptation.bas_carbone;
      APP.caption(`<span class="fig">Fig. 5 |</span> <span class="ttl">Deux logiques de priorité.</span>
        <b>a,</b> Les 20 % de surface les plus prioritaires pour « Adaptation chaleur & santé » et pour « Bas-carbone » ne partagent que ${LIVE(n1(both) + " ha sur " + n0(a))}.
        Le gain carbone, uniforme par mètre carré et annualisé sur la durée de vie, favorise les grands chantiers des axes structurants en enrobé recyclé ${STN("carbone")} ; l'adaptation cible les rues résidentielles ensoleillées et densément habitées.
        <b>b,</b> Corrélations de rang de Spearman : quatre profils convergent (ρ ≥ 0,90), le bas-carbone s'en écarte (ρ = ${n2(rho)} avec l'adaptation). <b>c,</b> Recouvrement surfacique des 20 % prioritaires (indice de Jaccard).`, true);
    },
    panels() {
      const ids = APP.PROF, lab = ids.map((k) => PROF_SHORT[k]);
      APP.panel("b", "Corrélation de rang entre profils (ρ de Spearman)", (el) => CH.matrix(el, { rows: lab, cols: lab, values: ids.map((a) => ids.map((b) => M.spearman[a][b])),
        color: (v) => PAL.at(PAL.corr, (v + 1) / 2), fmt: n2, rowW: 92, cellH: 30, headH: 26 }));
      APP.panel("c", "Recouvrement des 20 % prioritaires (Jaccard)", (el) => CH.matrix(el, { rows: lab, cols: lab, values: ids.map((a) => ids.map((b) => M.recouvrement[a][b])),
        color: (v) => PAL.at(PAL.ramps.gris, v * 0.95), fmt: n2, rowW: 92, cellH: 30, headH: 26 }));
    },
  });

  /* ======================================================== Fig. 6 — robustesse */
  const ROBK = [{ v: "p20", t: "Préférences + matériaux" }, { v: "pp", t: "Préférences seules" }, { v: "pm", t: "Matériaux seuls" }];
  FIGS.push({
    no: 6, mission: "3 · Analyse multicritère", short: "Ce qui résiste à l'incertitude",
    enter(st) {
      const draw = () => {
        const key = st.rob;
        APP.paint({
          kind: "seq", stops: PAL.ramps.gris, domain: [0, 1], value: (p) => p[key], width: (p) => 0.45 + 2.6 * p[key],
          hover: (p) => `P(top 20 %) ${pct(p[key])} · rang ${pct(p.q5)}–${pct(p.q95)} · revêtement modal ${p.mm}`,
          legend: { title: "Probabilité d'être dans le top 20 %", min: "0 %", max: "100 %", note: "Gris et épaisseur croissent avec la probabilité (canal non chromatique)" },
        });
        APP.stations(["incertain"], { incertain: `<b>${STN("incertain")} ${M.postes.incertain.nom}</b><br>P(top 20 %) = ${pct(posteP("incertain").p20)} : le classement dépend des poids` });
        this.panels(st);
        const lab = ROBK.find((r) => r.v === key).t.toLowerCase();
        const rob = APP.P.filter((p) => p.ch && p[key] >= 0.8).length;
        APP.caption(`<span class="fig">Fig. 6 |</span> <span class="ttl">Ce qui résiste à l'incertitude.</span>
          <b>a,</b> Probabilité qu'un tronçon figure dans les 20 % prioritaires sur 1&nbsp;000 tirages (${lab}) : poids des enjeux tirés uniformément sur le simplexe (Dirichlet) et paramètres matériaux tirés dans leurs fourchettes (lois triangulaires). ${LIVE(n0(rob) + " tronçons sont prioritaires dans au moins 80 % des tirages")}.
          <b>b,</b> Distribution. <b>c,</b> Sensibilité un-à-un : ±25 % sur chaque poids (Jaccard du top 20 % contre la référence) et valeurs basses ou hautes des paramètres matériaux. L'albédo réel de l'enrobé clair est le paramètre le plus influent : c'est l'essai à prioriser.`, true);
      };
      APP.tools(APP.seg("rob", ROBK, st.rob, "Incertitude"), (r) => APP.onSeg(r, "rob", (v) => { st.rob = v; draw(); }));
      draw();
    },
    panels(st) {
      APP.panel("b", "Répartition de la chaussée par statut", (el) => {
        const cls = [["Prioritaire robuste", 0.8, 1.01, PAL.ramps.gris[5]], ["Prioritaire probable", 0.5, 0.8, PAL.ramps.gris[4]], ["Prioritaire incertain", 0.2, 0.5, PAL.ramps.gris[3]], ["Rarement prioritaire", -1, 0.2, PAL.ramps.gris[1]]];
        const rows = cls.map(([lab, a, b, col]) => {
          const sel = APP.P.filter((p) => p.ch && p[st.rob] >= a && p[st.rob] < b);
          return { label: lab, value: sel.reduce((t, p) => t + p.sf, 0) / 1e4, color: col, sub: `${n0(sel.length)} tronçons, P(top 20 %) ${a < 0 ? "< 20 %" : b > 1 ? "≥ 80 %" : pct(a) + "–" + pct(b)}` };
        });
        const r = CH.barsH(el, rows, { fmt: (v) => n0(v) + " ha", colLabel: "Statut", valLabel: "Surface", labelW: 150, barH: 13, gap: 7 });
        d3.select(el).append("p").attr("class", "subhead").text("Paramètres matériaux les plus influents (Jaccard du top 20 %, 1 = inchangé)");
        const sm = M.sensibilite_materiaux.slice().sort((a, b) => a.jaccard_top20 - b.jaccard_top20).slice(0, 3);
        const LIBP = { albedo: "albédo", reduction_ges: "réduction GES", duree_vie: "durée de vie" };
        CH.tornado(el, { rows: sm.map((s) => ({ label: `${s.materiau} ${LIBP[s.parametre]} ${s.niveau}`, value: s.jaccard_top20, color: PAL.mat[s.materiau],
          tip: `${s.materiau} ${LIBP[s.parametre]} = ${s.valeur} : Jaccard ${n2(s.jaccard_top20)}, ${pct(s.part_surface_changeant_de_materiau)} de la surface change de revêtement` })),
          domain: [0.6, 1], fmt: n2, labelW: 150 });
        return r;
      });
      APP.panel("c", "Sensibilité un-à-un", (el) => {
        d3.select(el).append("p").attr("class", "subhead").text("Poids d'un enjeu ±25 % : pire cas (Jaccard du top 20 %, 1 = inchangé)");
        const parE = d3.groups(M.sensibilite, (s) => s.enjeu).map(([e, l]) => {
          const worst = l.reduce((a, b) => (a.jaccard_top20 < b.jaccard_top20 ? a : b));
          return { label: e.split(" (")[0], value: worst.jaccard_top20, tip: l.map((s) => `${s.variation_poids} : Jaccard ${n2(s.jaccard_top20)}, ${n1(s.surface_sortante_m2 / 1e4)} ha sortent`).join("<br>") };
        });
        const r = CH.tornado(el, { rows: parE, domain: [0.8, 1], fmt: n2, labelW: 150 });
        d3.select(el).append("p").attr("class", "note").text("Un poids modifié de ±25 % déplace au plus 11 % du top 20 % : le classement tient aux préférences, beaucoup moins aux hypothèses sur l'enrobé clair.");
        return r;
      });
    },
  });

  /* ======================================================== Fig. 7 — prospective */
  const SC = ["S0", "S1", "S2", "S3"];
  const scenSeg = (st) => APP.seg("scen", SC.map((s, i) => ({ v: i, t: `${s} ${M.scenarios[s].nom}` })), st.scen, "Scénario");
  FIGS.push({
    no: 7, mission: "4 · Prospective", short: "Quatre trajectoires 2026–2050",
    enter(st) {
      let timer = null;
      const draw = (light) => {
        const s = st.scen, sc = SC[s], y = st.year;
        APP.paint({
          kind: "cat", colors: MATS.map((c) => PAL.mat[c]),
          value: (p) => (p.PA[s] && p.PA[s] <= y ? APP.MATI[p.PM[s]] ?? -1 : -1), width: () => 1.9, faintColor: "#e2e4e7",
          hover: (p) => (p.PA[s] ? `${sc} : traité en ${p.PA[s]} · ${matLab(p.PM[s])}` : `${sc} : pas de traitement innovant avant 2050`),
          legend: { title: `Chaussées traitées en ${y} · ${sc} ${M.scenarios[sc].nom}`, items: MATS.map((c) => ({ color: PAL.mat[c], label: `${c} ${M.materiaux[c].court}` })).concat([{ color: "#e2e4e7", label: "non encore traitée" }]) },
        });
        APP.stations(["anticipation"], { anticipation: `<b>${STN("anticipation")} ${M.postes.anticipation.nom}</b><br>en S1, renouvelée par anticipation en ${posteP("anticipation").PA[1]} (${matLab(posteP("anticipation").PM[1])})` });
        if (!light) this.panels(st); else this.panels(st, true);
        const r = traj(sc, y);
        APP.caption(`<span class="fig">Fig. 7 |</span> <span class="ttl">Quatre trajectoires de déploiement, 2026–2050.</span>
          <b>a,</b> Scénario ${sc} « ${M.scenarios[sc].nom} » en ${y} : ${M.scenarios[sc].recit} ${LIVE(n0(r.surface_totale_ha) + " ha traités (" + pct(r.part_chaussee_traitee) + " de la chaussée), " + n0(r.ges_evites_tco2e) + " t CO₂e évitées en cumul")}.
          ${STN("anticipation")} ${M.postes.anticipation.nom} illustre l'anticipation du scénario S1.
          <b>b,</b> GES évités en cumul par rapport à un renouvellement 100 % conventionnel : médiane et intervalle 10–90 % sur 150 tirages (paramètres matériaux, facteur d'émission, calendrier). <b>c,</b> Indicateurs d'impact à l'horizon choisi.`, !light);
      };
      APP.tools(scenSeg(st) + `<div class="year"><label for="yr">Année</label><input id="yr" type="range" min="2026" max="2050" step="1" value="${st.year}"><output id="yro">${st.year}</output>
        <button type="button" class="btn" id="play" aria-label="Animer de 2026 à 2050">Animer</button></div>`, (root) => {
        APP.onSeg(root, "scen", (v) => { st.scen = +v; draw(); });
        const yr = root.querySelector("#yr"), yo = root.querySelector("#yro");
        yr.addEventListener("input", () => { st.year = +yr.value; yo.textContent = yr.value; draw(true); });
        root.querySelector("#play").addEventListener("click", () => {
          clearInterval(timer); st.year = 2026;
          timer = setInterval(() => { yr.value = st.year; yo.textContent = st.year; draw(true); if (st.year >= 2050) clearInterval(timer); else st.year++; }, 380);
        });
      });
      this._draw = draw;
      draw();
    },
    panels(st, light) {
      const s = SC[st.scen];
      APP.panel("b", "GES évités en cumul (t CO₂e)", (el) => CH.lines(el, {
        years: d3.range(2026, 2051), selected: s, year: st.year, fmt: CH.n0, reserve: 6,
        series: SC.map((sc) => ({ id: sc, label: `${sc} ${M.scenarios[sc].nom.split(" ")[0]}`, values: d3.range(2026, 2051).map((y) => { const r = traj(sc, y); return { x: y, y: r.ges_evites_tco2e, lo: r.ges_evites_tco2e_p10, hi: r.ges_evites_tco2e_p90 }; }) })),
        onYear: (y) => { st.year = Math.max(2026, Math.min(2050, y)); const yr = document.getElementById("yr"); if (yr) { yr.value = st.year; document.getElementById("yro").textContent = st.year; } FIGS[7]._draw(true); },
      }));
      if (light && document.querySelector("#pc table")) { fillTable(st); return; }
      APP.panel("c", `Impacts en ${st.year}`, (el) => { fillTable(st, el); return null; });
    },
  });
  function fillTable(st, el) {
    el = el || document.getElementById("pc");
    el.innerHTML = "";
    CH.title(el, `Impacts en ${st.year}`);
    const rows = SC.map((sc) => { const r = traj(sc, st.year); return { s: `${sc} ${M.scenarios[sc].nom}`, sel: SC[st.scen] === sc, ha: r.surface_totale_ha, ges: r.ges_evites_tco2e, pop: r.population_beneficiaire_adaptation, ru: r.ruissellement_evite_m3_an, cov: r.couverture_priorites_P1P2 }; });
    const t = CH.table(el, [{ key: "s", label: "Scénario" }, { key: "ha", label: "Traité (ha)", r: 1, fmt: n0 }, { key: "ges", label: "GES évités (t)", r: 1, fmt: n0 },
      { key: "pop", label: "Hab. bénéficiaires*", r: 1, fmt: (v) => n0(Math.round(v / 100) * 100) }, { key: "ru", label: "Ruiss. évité (m³/an)", r: 1, fmt: (v) => n0(Math.round(v / 100) * 100) }, { key: "cov", label: "P1–P2 couverts", r: 1, fmt: pct }], rows);
    d3.select(t).selectAll("tbody tr").style("font-weight", (d, i) => (rows[i].sel ? 700 : 400)).style("background", (d, i) => (rows[i].sel ? "#f2f3f4" : null));
    d3.select(el).append("p").attr("class", "note").html("* population riveraine pondérée par la part de chaussée de son carreau traitée en enrobé clair ou drainant. Ruissellement : pluie annuelle 0,83 m, coefficients 0,90 / 0,30.");
  }

  /* ======================================================== Fig. 8 — 2050 */
  const SC_PROF = [0, 1, 2, 0];
  FIGS.push({
    no: 8, mission: "4 · Prospective", short: "2050 : un besoin qui s'intensifie",
    enter(st) {
      const draw = () => {
        const s = st.scen, sc = SC[s], k = SC_PROF[s];
        const d = APP.P.map((p) => (p.ch && p.S50[s] != null && p.S[k] != null ? p.S50[s] - p.S[k] : null));
        const m = d3.quantile(d.filter((v) => v != null).map(Math.abs).sort(d3.ascending), 0.98) || 0.1;
        APP.paint({
          kind: "seq", stops: PAL.diverge, domain: [-m, m], value: (p, i) => d[i], width: (p, i) => 0.6 + 2.4 * Math.min(1, Math.abs(d[i] || 0) / m),
          hover: (p, i) => `Score ${n2(p.S[k])} → ${n2(p.S50[s])} en 2050 (${d[i] >= 0 ? "+" : ""}${n2(d[i])})`,
          legend: { title: `Évolution de l'aptitude 2025 → 2050 · ${sc}`, min: `−${n2(m)} (baisse)`, max: `+${n2(m)} (hausse)`, note: "Gris neutre : pas d'évolution" },
        });
        this.panels(st);
        const up = APP.P.filter((p, i) => d[i] != null && d[i] > 0.02).length;
        APP.caption(`<span class="fig">Fig. 8 |</span> <span class="ttl">2050 : un besoin qui s'intensifie.</span>
          <b>a,</b> Évolution du score d'aptitude entre aujourd'hui et 2050 sous ${sc} « ${M.scenarios[sc].nom} » : réchauffement de référence TRACC (+2,7 °C en France en 2050), vieillissement (+25 % de vulnérabilité)${sc === "S3" ? ", trafic −30 %, apaisement des rues de desserte, plan canopée" : ""} ; ${LIVE(n0(up) + " tronçons gagnent plus de 0,02")}.
          <b>b,</b> Trajectoire de réchauffement de référence (TRACC). <b>c,</b> Dette carbone de l'anticipation : renouveler tôt les rues prioritaires (S1) émet plus que le calendrier normal jusqu'à ce que la durée de vie gagnée compense.`, true);
      };
      APP.tools(scenSeg(st), (r) => APP.onSeg(r, "scen", (v) => { st.scen = +v; draw(); }));
      draw();
    },
    panels() {
      APP.panel("b", "Réchauffement de référence TRACC (°C, France)", (el) => CH.lines(el, {
        years: d3.range(2025, 2051), selected: "t", fmt: (v) => "+" + CH.n1(v) + " °C", h: 220, reserve: 4, zero: false, endLabels: false,
        series: [{ id: "t", label: "TRACC", values: d3.range(2025, 2051).map((y) => ({ x: y, y: y <= 2030 ? 1.8 + 0.04 * (y - 2025) : 2.0 + 0.035 * (y - 2030) })) }],
        annot: (s, x, y) => { [[2030, 2.0], [2050, 2.7]].forEach(([a, v]) => { s.append("circle").attr("cx", x(a)).attr("cy", y(v)).attr("r", 4.5).attr("fill", PAL.ink); s.append("text").attr("x", x(a) - 6).attr("y", y(v) - 9).attr("text-anchor", "end").attr("class", "lbl").text(`+${CH.n1(v)} °C en ${a}`); }); },
      }));
      APP.panel("c", "GES évités en cumul, 2026–2040 (t CO₂e)", (el) => CH.lines(el, {
        years: d3.range(2026, 2041), selected: "S1", fmt: CH.n0, reserve: 4,
        series: ["S0", "S1"].map((sc) => ({ id: sc, label: `${sc} ${M.scenarios[sc].nom.split(" ")[0]}`, values: d3.range(2026, 2041).map((y) => { const r = traj(sc, y); return { x: y, y: r.ges_evites_tco2e, lo: r.ges_evites_tco2e_p10, hi: r.ges_evites_tco2e_p90 }; }) })),
      }));
    },
  });

  /* ======================================================== Fig. 9 — où commencer */
  FIGS.push({
    no: 9, mission: "5 · Synthèse", short: "Où commencer",
    enter() {
      APP.paint({
        kind: "cat", colors: MATS.map((c) => PAL.mat[c]),
        value: (p) => (p.rb >= 3 ? APP.MATI[p.mm] ?? -1 : -1), width: (p) => (p.rb === 4 ? 2.4 : 1.1),
        hover: (p) => `P(top 20 %) ${pct(p.p20)} · revêtement modal ${p.mm} (stabilité ${pct(p.st)})`,
        legend: { title: "Programme de départ", items: MATS.map((c) => ({ color: PAL.mat[c], label: `${c} ${M.materiaux[c].court}` })).concat([{ color: PAL.course, label: "parcours des postes de la démonstration", dash: true }]),
          widths: [{ w: 4.6, label: "Prioritaire robuste" }, { w: 2, label: "Prioritaire probable" }] },
      });
      APP.tools("");
      APP.stations(["chaleur", "pente", "inondation", "eau", "carbone", "incertain", "anticipation"]);
      APP.course(true);
      this.panels();
      APP.caption(`<span class="fig">Fig. 9 |</span> <span class="ttl">Où commencer.</span>
        <b>a,</b> Tronçons prioritaires robustes (trait épais) ou probables (trait fin), colorés selon le revêtement le plus souvent recommandé sur les 1&nbsp;000 tirages ; en vermillon, le parcours des sept postes de la démonstration ${["chaleur", "pente", "inondation", "eau", "carbone", "incertain", "anticipation"].map(STN).join("")}.
        <b>b,</b> Quatre enseignements. <b>c,</b> Limites et suites à donner avec les partenaires du projet.`, true);
    },
    panels() {
      APP.panel("b", "Enseignements", (el) => {
        const p1 = synth("equilibre").find((r) => r.classe === "P1");
        const s2 = traj("S2", 2050), s1 = traj("S1", 2030), s3 = traj("S3", 2050);
        d3.select(el).append("ol").attr("class", "findings").html(APP.typo(`
          <li><span>Un <b>noyau robuste de ${n0(M.chiffres.robuste)} tronçons (${n0(M.chiffres.robuste_ha)} ha)</b> reste prioritaire quels que soient les poids et les hypothèses matériaux : c'est le programme de départ.</span></li>
          <li><span>Sur les rues chaudes et habitées, l'<b>enrobé clair</b> domine (${pct(p1.part_R2)} de la P1 du profil équilibré) ; l'<b>enrobé recyclé + régénérant</b> porte les axes structurants.</span></li>
          <li><span>Le carbone plaide pour la <b>massification</b> (${n1(s2.ges_evites_tco2e / 1000)} kt CO₂e évitées d'ici 2050 en S2), l'adaptation pour le <b>ciblage</b> : anticiper crée une dette carbone (${n0(s1.ges_evites_tco2e)} t en 2030 pour S1).</span></li>
          <li><span>La <b>transition intégrée</b> (S3) concilie les deux : ${pct(s3.part_chaussee_traitee)} de la chaussée traitée et ${n0(Math.round(s3.population_beneficiaire_adaptation / 1000))} 000 habitants bénéficiaires en 2050.</span></li>`));
        return null;
      });
      APP.panel("c", "Limites et suites", (el) => {
        d3.select(el).append("ol").attr("class", "findings").html(APP.typo(`
          <li><span><b>Essais matériaux</b> : mesurer l'albédo de l'enrobé clair et son vieillissement (encrassement), paramètre le plus influent du classement.</span></li>
          <li><span><b>État des chaussées</b> : remplacer le calendrier simulé par les dates de renouvellement et l'indice de dégradation du gestionnaire.</span></li>
          <li><span><b>Sols supports</b> : vérifier par sondages la perméabilité sous les tronçons aptes à l'enrobé drainant.</span></li>
          <li><span><b>Mesures thermiques</b> : les LCZ et l'exposition ICU sont des pré-diagnostics ; valider par thermographie ou capteurs sur les postes.</span></li>`));
        return null;
      });
    },
  });

  /* ======================================================== exploration libre */
  const LAYERS = [
    { g: "Données", items: [
      { id: "pl", t: "Trafic PL", kind: "seq", stops: PAL.ramps.indic, v: (p) => ({ TS: 1, T0: 1, T1: 0.8, T2: 0.6, T3: 0.4, T4: 0.2, T5: 0 })[p.pl], min: "T5", max: "T0", h: (p) => `classe ${p.pl}` },
      { id: "tm", t: "Trafic tous véhicules", kind: "seq", stops: PAL.ramps.indic, v: (p) => Math.log10(Math.max(100, p.tm)) / 4.7 - 0.4, min: "≈ 100 véh./j", max: "≈ 50 000", h: (p) => `${n0(p.tm)} véh./j` },
      { id: "pe", t: "Pente", kind: "seq", stops: PAL.ramps.indic, v: (p) => p.pe / 10, min: "0 %", max: "≥ 10 %", h: (p) => `${n1(p.pe)} %` },
    ] },
    { g: "Indicateurs", items: [
      { id: "bc", t: "Besoin chaleur", stops: PAL.ramps.chaleur, v: (p) => p.bc, gv: (c) => c.bc, h: (p) => n2(p.bc) },
      { id: "ins", t: "Insolation", stops: PAL.ramps.chaleur, v: (p) => p.ins, gv: (c) => c.ins, h: (p) => n2(p.ins) },
      { id: "can", t: "Canopée sur la rue", stops: PAL.ramps.R1, v: (p) => p.can / 0.6, max: "≥ 60 %", h: (p) => pct(p.can) },
      { id: "hl", t: "Rapport H/L", stops: PAL.ramps.indic, v: (p) => p.hl / 3, max: "≥ 3", h: (p) => n2(p.hl) },
      { id: "vu", t: "Vulnérabilité", stops: PAL.ramps.indic, v: (p) => p.vu, gv: (c) => c.vu, h: (p) => n2(p.vu) },
      { id: "imp", t: "Imperméabilisation", stops: PAL.ramps.indic, v: (p) => (p.imp - 0.3) / 0.65, gv: (c) => c.imp, min: "≤ 30 %", max: "95 %", h: (p) => pct(p.imp) },
      { id: "dh", t: "Densité de population", stops: PAL.ramps.indic, v: (p) => p.dh / 350, gv: (c) => c.dh / 350, max: "≥ 350 hab/ha", h: (p) => `${n0(p.dh)} hab/ha` },
      { id: "pv", t: "Ménages pauvres", stops: PAL.ramps.indic, v: (p) => (p.pv == null ? null : p.pv / 0.4), gv: (c) => (c.pv == null ? null : c.pv / 0.4), max: "≥ 40 %", h: (p) => (p.pv == null ? "—" : pct(p.pv)) },
      { id: "us", t: "Usages", stops: PAL.ramps.indic, v: (p) => p.us, gv: (c) => c.us, h: (p) => n2(p.us) },
    ] },
    { g: "Aptitude par revêtement", items: MATS.map((c, m) => ({ id: "apt" + c, t: `${c} ${M.materiaux[c].court}`, stops: PAL.ramps[c], v: (p) => p.A[m], gv: (g) => g.A[m], h: (p) => `aptitude ${n2(p.A[m])} · C ${n2(p.C[m])}` })) },
    { g: "Priorités", items: M.profils.map((pr, k) => ({ id: "prio" + k, t: PROF_SHORT[pr.id], prio: k })).concat([{ id: "custom", t: "Pondération libre", prio: "custom" }]) },
    { g: "Robustesse", items: [
      { id: "p20", t: "P(top 20 %)", stops: PAL.ramps.gris, v: (p) => p.p20, gv: (g) => g.p20, w: (p) => 0.45 + 2.6 * p.p20, h: (p) => pct(p.p20), max: "100 %", min: "0 %" },
      { id: "cs", t: "Consensus des profils", stops: PAL.ramps.gris, v: (p) => p.cs / 5, w: (p) => 0.5 + p.cs * 0.45, h: (p) => `${p.cs} / 5 profils`, min: "0 profil", max: "5 profils" },
    ] },
  ];
  const ALL = LAYERS.flatMap((g) => g.items);
  window.EXPLORE = {
    no: "E", mission: "Exploration", short: "Exploration libre", split: [1.15, 1],
    enter(st) {
      if (!st.w) st.w = M.profils[0].poids ? M.enjeux.map((e) => M.profils[0].poids[e]) : [0.2, 0.2, 0.2, 0.2, 0.2];
      if (!ALL.find((l) => l.id === st.layer)) st.layer = "prio0";
      this.render(st);
    },
    render(st) {
      const L = ALL.find((l) => l.id === st.layer);
      let custom = null;
      if (L.prio === "custom") custom = APP.custom(st.w);
      const gridOK = !!L.gv || L.prio != null && L.prio !== "custom";
      if (!gridOK) st.rep = "troncons";
      if (L.prio != null) {
        const k = L.prio;
        APP.paint({
          kind: "cat", colors: MATS.map((c) => PAL.mat[c]),
          value: (p, i) => (k === "custom" ? (custom.cls[i] ? custom.mat[i] : -1) : p.K[k] ? APP.MATI[p.M[k]] ?? -1 : -1),
          width: (p, i) => WCLS[k === "custom" ? custom.cls[i] : p.K[k]] || 0.5,
          grid: k === "custom" ? null : (c) => (c.M[k] ? APP.MATI[c.M[k]] ?? -1 : -1),
          gridHover: (c) => `${n0(c.pop)} hab. · revêtement dominant ${c.M[k] || "—"} · score moyen ${n2(c.S[k])}`,
          hover: (p, i) => (k === "custom" ? `Pondération libre : P${custom.cls[i]} · ${custom.mat[i] >= 0 ? matLab(MATS[custom.mat[i]]) : "—"} · ${n2(custom.apt[i])}` : `P${p.K[k]} · ${p.M[k] !== "—" ? matLab(p.M[k]) : "—"} · score ${n2(p.S[k])}`),
          legend: priorityLegend(k === "custom" ? "Priorité · pondération libre" : `Priorité · profil ${M.profils[k].nom}`),
        });
      } else {
        APP.paint({
          kind: "seq", stops: L.stops, domain: [0, 1], value: (p) => { const v = L.v(p); return v == null ? null : Math.max(0, Math.min(1, v)); }, width: L.w,
          grid: L.gv ? (c) => { const v = L.gv(c); return v == null ? null : Math.max(0, Math.min(1, v)); } : null,
          gridHover: L.gv ? (c) => `${L.t} : ${n2(L.gv(c))} · ${n0(c.pop)} hab.` : null,
          hover: (p) => `${L.t} : ${L.h(p)}`,
          legend: { title: L.t, min: L.min || "0", max: L.max || "1" },
        });
      }
      APP.context(st.ctx);
      const CTX = [["icu", "Chaleur (ICU)"], ["inond", "Zone inondable"], ["etab", "Établissements sensibles"], ["arbres", "Arbres"], ["tram", "Tramway"]];
      APP.tools(APP.seg("rep", [{ v: "troncons", t: "Tronçons" }, { v: "grille", t: "Grille 200 m" }], st.rep, "Représentation") +
        `<div class="toggles" role="group" aria-label="Couches de contexte"><label style="font-weight:600">Contextes</label>${CTX.map(([k, t]) =>
          `<label><input type="checkbox" data-ctx="${k}"${st.ctx[k] ? " checked" : ""}><span>${t}</span></label>`).join("")}</div>`,
        (r) => {
          APP.onSeg(r, "rep", (v) => { st.rep = gridOK ? v : "troncons"; this.render(st); });
          if (!gridOK) { const g = r.querySelectorAll('[data-seg="rep"] button')[1]; g.disabled = true; g.title = "Couche disponible par tronçon seulement"; }
          r.querySelectorAll("[data-ctx]").forEach((c) => c.addEventListener("change", () => { st.ctx[c.dataset.ctx] = c.checked; APP.context(st.ctx); }));
        });
      this.panels(st, custom);
      const mean = d3.mean(APP.P.filter((p) => p.ch), (p) => (L.v ? L.v(p) : null));
      let live = "";
      if (L.prio != null) {
        const cls = L.prio === "custom" ? custom.cls : APP.P.map((p) => p.K[L.prio]);
        const mats = L.prio === "custom" ? Array.from(custom.mat, (m) => MATS[m]) : APP.P.map((p) => p.M[L.prio]);
        const ha = {}; let tot = 0;
        APP.P.forEach((p, i) => { if (cls[i] === 1) { ha[mats[i]] = (ha[mats[i]] || 0) + p.sf / 1e4; tot += p.sf / 1e4; } });
        live = `En P1 : ${n1(tot)} ha, dont ${MATS.filter((c) => ha[c]).map((c) => `${pct(ha[c] / tot)} ${c}`).join(", ")}.`;
      } else if (mean != null) live = `Moyenne sur le champ : ${n2(mean)} (échelle de la carte).`;
      APP.caption(`<span class="fig">Fig. E |</span> <span class="ttl">Exploration libre : ${L.t.toLowerCase()}.</span>
        <b>a,</b> ${st.rep === "grille" ? "Moyenne pondérée par la surface de chaussée, carreaux INSEE de 200 m." : "Valeur par tronçon ; cliquer un tronçon pour sa fiche complète."} ${LIVE(live)}
        <b>b,</b> Couches et recherche d'une rue ; contextes au-dessus de la carte. <b>c,</b> Pondération libre des enjeux : la carte et ce texte se recalculent en direct.`, false);
    },
    panels(st, custom) {
      APP.panel("b", "Couches", (el) => {
        const d = d3.select(el);
        const s = d.append("div").attr("class", "search");
        s.append("input").attr("type", "search").attr("placeholder", "Rechercher une rue (ex. cours Lafayette)").attr("aria-label", "Rechercher une rue");
        const res = d.append("ul").attr("class", "results");
        s.select("input").on("input", function () {
          const q = this.value.trim().toLowerCase();
          res.html("");
          if (q.length < 3) return;
          const seen = new Set();
          APP.P.forEach((p, i) => { if (p.n.toLowerCase().includes(q) && !seen.has(p.n + p.a) && seen.size < 12) { seen.add(p.n + p.a); res.append("li").append("button").attr("type", "button").text(`${p.n} · ${p.a}`).on("click", () => { APP.map.flyTo({ center: APP.center(i), zoom: 16 }); APP.select(i); }); } });
        });
        const ll = d.append("div").attr("class", "layerlist");
        LAYERS.forEach((g) => {
          const fs = ll.append("fieldset");
          fs.append("legend").text(g.g);
          fs.append("div").attr("class", "chips").selectAll("button").data(g.items).join("button").attr("type", "button").attr("class", "chip")
            .attr("aria-pressed", (l) => String(l.id === st.layer)).text((l) => l.t)
            .on("click", (ev, l) => { st.layer = l.id; this.render(st); });
        });
        return null;
      });
      APP.panel("c", "Pondération libre des enjeux", (el) => {
        const d = d3.select(el);
        const presets = d.append("div").attr("class", "chips").style("margin-bottom", "10px");
        presets.append("span").attr("class", "note").style("margin", "0 6px 0 0").text("Partir de :");
        M.profils.forEach((pr) => presets.append("button").attr("type", "button").attr("class", "chip").text(PROF_SHORT[pr.id]).on("click", () => {
          st.w = M.enjeux.map((e) => pr.poids[e]); st.layer = "custom"; this.render(st);
        }));
        const sl = d.append("div").attr("class", "sliders");
        const tot = st.w.reduce((a, b) => a + b, 0);
        let raf = null;
        M.enjeux.forEach((e, g) => {
          sl.append("label").attr("for", "w" + g).attr("title", M.lib_enjeux[e]).text({ chaleur: "Chaleur", sante: "Santé", eau: "Eau et sols", carbone: "Carbone", usages: "Usages" }[e]);
          sl.append("input").attr("type", "range").attr("id", "w" + g).attr("min", 0).attr("max", 1).attr("step", 0.01).property("value", st.w[g])
            .on("input", function () {
              st.w[g] = +this.value;
              const t2 = st.w.reduce((a, b) => a + b, 0) || 1;
              sl.selectAll("output").text((x, j) => pct(st.w[j] / t2));
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(() => { st.layer = "custom"; EXPLORE.repaintCustom(st); });
            });
          sl.append("output").datum(g).text(pct(st.w[g] / (tot || 1)));
        });
        d.append("div").attr("id", "customStack").style("margin-top", "12px");
        if (custom) drawCustomStack(custom);
        else d.select("#customStack").append("p").attr("class", "note").text("Déplacer un curseur affiche la priorité recalculée (couche « Pondération libre »).");
        return null;
      });
    },
    repaintCustom(st) {
      const c = APP.custom(st.w.map((v) => v / (st.w.reduce((a, b) => a + b, 0) || 1)));
      APP.paint({
        kind: "cat", colors: MATS.map((m) => PAL.mat[m]),
        value: (p, i) => (c.cls[i] ? c.mat[i] : -1), width: (p, i) => WCLS[c.cls[i]] || 0.5,
        hover: (p, i) => `Pondération libre : P${c.cls[i]} · ${c.mat[i] >= 0 ? matLab(MATS[c.mat[i]]) : "—"} · ${n2(c.apt[i])}`,
        legend: priorityLegend("Priorité · pondération libre"),
      });
      document.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === "Pondération libre")));
      drawCustomStack(c);
      const ha = {}; let tot = 0;
      APP.P.forEach((p, i) => { if (c.cls[i] === 1) { const m = MATS[c.mat[i]]; ha[m] = (ha[m] || 0) + p.sf / 1e4; tot += p.sf / 1e4; } });
      const ttl = document.querySelector("#caption .ttl");
      if (ttl) ttl.textContent = "Exploration libre : pondération libre.";
      const live = document.querySelector("#caption .live");
      if (live) live.textContent = `En P1 : ${n1(tot)} ha, dont ${MATS.filter((m) => ha[m]).map((m) => `${pct(ha[m] / tot)} ${m}`).join(", ")}.`;
    },
  };
  function drawCustomStack(c) {
    const el = document.getElementById("customStack");
    if (!el) return;
    el.innerHTML = "";
    const rows = [1, 2, 3, 4].map((k) => {
      const parts = {}; let tot = 0;
      APP.P.forEach((p, i) => { if (c.cls[i] === k) { const m = MATS[c.mat[i]]; parts[m] = (parts[m] || 0) + p.sf; tot += p.sf; } });
      MATS.forEach((m) => { parts[m] = (parts[m] || 0) / (tot || 1); });
      return { label: "P" + k, total: tot / 1e4, parts };
    });
    CH.stacked(el, { rows });
  }

  window.FIGS = FIGS;
})();
