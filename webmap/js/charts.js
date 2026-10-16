/* Graphiques des panneaux (D3, SVG). Chaque fonction dessine dans `el` et renvoie
   { cols, rows } : la vue tableau équivalente (accessibilité, bouton « Tableau »). */
(function () {
  const CH = {};
  const fr = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] });
  CH.fmt = (s) => fr.format(s);
  CH.n0 = fr.format(",.0f");
  CH.n1 = fr.format(",.1f");
  CH.n2 = fr.format(",.2f");
  CH.pct = fr.format(".0%");
  CH.pct1 = fr.format(".1%");

  // facteur d'échelle typographique (1 à 16 px de base ; ~1,15 au vidéoprojecteur)
  CH.k = () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
  CH.box = function (el, minH = 120) {
    const cs = getComputedStyle(el);
    const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return { w: Math.max(200, w), h: Math.max(minH, h) };
  };

  // Info-bulle partagée par panneau
  CH.tip = function (el) {
    const panel = el.closest(".panel") || document.body;
    let t = panel.querySelector(":scope > .charttip");
    if (!t) { t = document.createElement("div"); t.className = "charttip"; t.hidden = true; panel.appendChild(t); }
    return {
      show(html, ev) {
        t.innerHTML = html; t.hidden = false;
        const pr = panel.getBoundingClientRect();
        let x = ev.clientX - pr.left + 14, y = ev.clientY - pr.top + 14;
        const tw = t.offsetWidth, th = t.offsetHeight;
        if (x + tw > pr.width - 6) x = ev.clientX - pr.left - tw - 12;
        if (y + th > pr.height - 6) y = ev.clientY - pr.top - th - 12;
        t.style.left = x + "px"; t.style.top = y + "px";
      },
      hide() { t.hidden = true; },
    };
  };

  function svg(el, w, h) {
    return d3.select(el).append("svg").attr("class", "chart").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
  }
  // Barre horizontale à extrémité arrondie (4 px) côté valeur, ancrée à la ligne de base
  function hbar(x0, y, w, h, r = 3) {
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return `M${x0},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
  }
  function vbar(x, y0, w, h, r = 3) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    return `M${x},${y0}v${-(h - r)}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
  }
  CH.hbar = hbar;

  CH.title = function (el, txt) {
    const p = el.closest(".panel");
    let h = p.querySelector(":scope > .panel-title");
    if (!h) { h = document.createElement("h2"); h.className = "panel-title"; p.appendChild(h); }
    h.textContent = window.APP && APP.typo ? APP.typo(txt || "") : txt || "";
  };

  CH.table = function (el, cols, rows) {
    const t = d3.select(el).append("table").attr("class", "dtable");
    t.append("thead").append("tr").selectAll("th").data(cols).join("th").attr("class", (c) => (c.r ? "r" : null)).text((c) => c.label);
    t.append("tbody").selectAll("tr").data(rows).join("tr").selectAll("td")
      .data((r) => cols.map((c) => ({ c, v: r[c.key] }))).join("td")
      .attr("class", (d) => (d.c.r ? "r" : null))
      .html((d) => (d.c.html ? d.c.html(d.v) : d.v == null ? "—" : d.c.fmt ? d.c.fmt(d.v) : d.v));
    return t.node();
  };

  /* Barres horizontales étiquetées */
  CH.barsH = function (el, rows, o = {}) {
    const { w } = CH.box(el);
    const k = CH.k(), lw = (o.labelW || Math.min(190, w * 0.38)) * k, vw = 58 * k, bh = (o.barH || 13) * k, gap = (o.gap || 9) * k;
    const h = rows.length * (bh + gap) + 6;
    const s = svg(el, w, h), tip = CH.tip(el);
    const x = d3.scaleLinear().domain([0, o.max || d3.max(rows, (r) => r.value)]).range([0, w - lw - vw - 8]);
    const g = s.selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${i * (bh + gap) + 2})`);
    g.append("text").attr("class", "lbl").attr("x", 0).attr("y", bh / 2).attr("dy", ".35em").text((d) => d.label);
    g.append("rect").attr("x", lw).attr("y", 0).attr("width", x.range()[1]).attr("height", bh).attr("fill", "#eef0f2");
    g.append("path").attr("d", (d) => hbar(lw, 0, x(d.value), bh)).attr("fill", (d) => d.color || o.color || PAL.ink);
    g.append("text").attr("class", "val").attr("x", w - vw + 6).attr("y", bh / 2).attr("dy", ".35em").text((d) => (o.fmt || CH.pct)(d.value));
    g.append("rect").attr("class", "hit").attr("x", 0).attr("y", -gap / 2).attr("width", w).attr("height", bh + gap)
      .on("mousemove", (ev, d) => tip.show(`<b>${d.label}</b><br>${(o.fmt || CH.pct)(d.value)}${d.sub ? "<br>" + d.sub : ""}`, ev))
      .on("mouseleave", tip.hide);
    return { cols: [{ key: "label", label: o.colLabel || "Attribut" }, { key: "value", label: o.valLabel || "Valeur", r: 1, fmt: o.fmt || CH.pct }, { key: "sub", label: "Note" }], rows };
  };

  /* Histogramme coloré par la rampe de la carte, avec barre de couleur sous l'axe */
  CH.hist = function (el, values, o = {}) {
    const { w, h: H } = CH.box(el);
    const h = Math.min(o.h || 190, Math.max(140, H - (o.reserve || 0)));
    const k = CH.k(), m = { t: 8, r: 8, b: 44 * k, l: 40 * k };
    const dom = o.domain || [0, 1];
    const nb = o.bins || 20, pas = (dom[1] - dom[0]) / nb;
    const vals = values.filter((v) => v != null && !isNaN(v)).map((v) => Math.min(Math.max(v, dom[0]), dom[1] - pas * 1e-6));
    const bins = d3.bin().domain(dom).thresholds(d3.range(1, nb).map((i) => dom[0] + i * pas))(vals);
    const s = svg(el, w, h), tip = CH.tip(el);
    const x = d3.scaleLinear().domain(dom).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).nice().range([h - m.b, m.t]);
    s.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat("")).call((g) => g.select(".domain").remove());
    s.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(CH.n0).tickSizeOuter(0)).call((g) => g.select(".domain").remove());
    const bw = Math.max(1, x(bins[0].x1) - x(bins[0].x0) - 2);
    s.append("g").selectAll("path").data(bins).join("path")
      .attr("d", (b) => vbar(x(b.x0) + 1, h - m.b, bw, h - m.b - y(b.length), 2))
      .attr("fill", (b) => PAL.at(o.stops, ((b.x0 + b.x1) / 2 - dom[0]) / (dom[1] - dom[0])));
    s.append("g").selectAll("rect").data(bins).join("rect").attr("class", "hit")
      .attr("x", (b) => x(b.x0)).attr("width", (b) => x(b.x1) - x(b.x0)).attr("y", m.t).attr("height", h - m.b - m.t)
      .on("mousemove", (ev, b) => tip.show(`${(o.fmt || CH.n2)(b.x0)} – ${(o.fmt || CH.n2)(b.x1)}<br><b>${CH.n0(b.length)}</b> ${o.unit || "tronçons"}`, ev))
      .on("mouseleave", tip.hide);
    // barre de couleur
    const cb = s.append("g").attr("transform", `translate(0,${h - m.b + 6})`);
    const n = 60;
    cb.selectAll("rect").data(d3.range(n)).join("rect").attr("x", (i) => x(dom[0] + (dom[1] - dom[0]) * i / n)).attr("width", (w - m.l - m.r) / n + .6).attr("height", 7)
      .attr("fill", (i) => PAL.at(o.stops, i / (n - 1)));
    s.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b + 13})`).call(d3.axisBottom(x).ticks(5).tickFormat(o.fmt || CH.n1).tickSizeOuter(0)).call((g) => g.select(".domain").remove());
    if (o.xlab) s.append("text").attr("class", "muted").attr("x", w - m.r).attr("y", h - 2).attr("text-anchor", "end").text(o.xlab);
    if (o.mark != null) {
      s.append("line").attr("x1", x(o.mark)).attr("x2", x(o.mark)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", PAL.course).attr("stroke-width", 2);
      s.append("text").attr("x", x(o.mark) + 4).attr("y", m.t + 10).attr("class", "lbl").style("fill", PAL.course).text(o.markLabel || "");
    }
    return { cols: [{ key: "a", label: "Classe", fmt: (v) => v }, { key: "n", label: "Tronçons", r: 1, fmt: CH.n0 }],
      rows: bins.map((b) => ({ a: `${(o.fmt || CH.n2)(b.x0)} – ${(o.fmt || CH.n2)(b.x1)}`, n: b.length })) };
  };

  /* Matrice (carte de chaleur) avec valeurs */
  CH.matrix = function (el, o) {
    const { w } = CH.box(el);
    const k = CH.k(), lw = (o.rowW || 120) * k, th = (o.headH || 34) * k, ch = (o.cellH || 30) * k;
    const cw = (w - lw) / o.cols.length, h = th + o.rows.length * ch + 2;
    const s = svg(el, w, h), tip = CH.tip(el);
    s.selectAll("text.ch").data(o.cols).join("text").attr("class", "lbl").attr("x", (d, j) => lw + j * cw + cw / 2).attr("y", th - 8).attr("text-anchor", "middle")
      .each(function (d) {
        const parts = String(d).split("\n");
        d3.select(this).selectAll("tspan").data(parts).join("tspan").attr("x", d3.select(this).attr("x")).attr("dy", (p, i) => (i ? "1.1em" : parts.length > 1 ? "-0.9em" : 0)).text((p) => p);
      });
    const g = s.selectAll("g.r").data(o.rows).join("g").attr("transform", (d, i) => `translate(0,${th + i * ch})`);
    if (o.rowColor) g.append("rect").attr("x", 0).attr("y", ch / 2 - 5).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", (d, i) => o.rowColor(i));
    g.append("text").attr("class", "lbl").attr("x", o.rowColor ? 15 : 0).attr("y", ch / 2).attr("dy", ".35em").html((d) => d);
    o.rows.forEach((r, i) => {
      o.cols.forEach((c, j) => {
        const v = o.values[i][j];
        const fill = o.color(v, i, j);
        const gg = s.append("g").attr("transform", `translate(${lw + j * cw},${th + i * ch})`);
        gg.append("rect").attr("x", 1).attr("y", 1).attr("width", cw - 2).attr("height", ch - 2).attr("fill", fill);
        gg.append("text").attr("x", cw / 2).attr("y", ch / 2).attr("dy", ".35em").attr("text-anchor", "middle")
          .style("fill", PAL.textOn(fill)).style("font-weight", 600).style("font-variant-numeric", "tabular-nums").text(o.fmt(v));
        gg.append("rect").attr("class", "hit").attr("width", cw).attr("height", ch)
          .on("mousemove", (ev) => tip.show(o.tip ? o.tip(v, i, j) : `${r.replace(/<[^>]+>/g, "")} × ${c}<br><b>${o.fmt(v)}</b>`, ev)).on("mouseleave", tip.hide);
      });
    });
    return { cols: [{ key: "r", label: "", html: (v) => v }, ...o.cols.map((c, j) => ({ key: "c" + j, label: String(c).replace("\n", " "), r: 1 }))],
      rows: o.rows.map((r, i) => Object.assign({ r }, ...o.cols.map((c, j) => ({ ["c" + j]: o.fmt(o.values[i][j]) })))) };
  };

  /* Fourchettes d'hypothèses bas / central / haut : une colonne par paramètre */
  CH.ranges = function (el, o) {
    const { w } = CH.box(el);
    const k = CH.k(), n = o.params.length, gap = 18 * k, cw = (w - gap * (n - 1)) / n;
    const rowH = 21 * k, lw = 24 * k, top = 22 * k, h = top + o.items.length * rowH + 30 * k;
    const s = svg(el, w, h), tip = CH.tip(el);
    const rows = [];
    o.params.forEach((p, j) => {
      const g = s.append("g").attr("transform", `translate(${j * (cw + gap)},0)`);
      const x = d3.scaleLinear().domain(p.domain).range([lw, cw - 6]);
      g.append("text").attr("class", "lbl").attr("x", 0).attr("y", 12 * k).text(p.label);
      const yb = top + o.items.length * rowH;
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${yb})`).call(d3.axisBottom(x).ticks(3).tickSize(3).tickFormat(p.fmt)).call((a) => a.select(".domain").attr("stroke", PAL.hair));
      if (p.ref != null) {
        g.append("line").attr("x1", x(p.ref)).attr("x2", x(p.ref)).attr("y1", top - 4).attr("y2", yb).attr("stroke", PAL.ink).attr("stroke-width", 1.2).attr("stroke-dasharray", "2 2");
        g.append("text").attr("class", "muted sm").attr("x", x(p.ref)).attr("y", yb + 26 * k).attr("text-anchor", "middle").text("réf.");
      }
      o.items.forEach((it, i) => {
        const [lo, mid, hi] = it[p.key];
        const y = top + i * rowH + rowH / 2;
        g.append("text").attr("x", 0).attr("y", y).attr("dy", ".35em").attr("class", "lbl").text(it.code);
        g.append("line").attr("x1", x(lo)).attr("x2", x(hi)).attr("y1", y).attr("y2", y).attr("stroke", it.color).attr("stroke-width", 4).attr("stroke-linecap", "round");
        g.append("circle").attr("cx", x(mid)).attr("cy", y).attr("r", 5).attr("fill", it.color).attr("stroke", PAL.paper).attr("stroke-width", 2);
        g.append("rect").attr("class", "hit").attr("x", 0).attr("y", y - rowH / 2).attr("width", cw).attr("height", rowH)
          .on("mousemove", (ev) => tip.show(`<b>${it.code} ${it.court}</b> — ${p.label}<br>bas ${p.fmt(lo)} · central ${p.fmt(mid)} · haut ${p.fmt(hi)}${p.ref != null ? `<br>référence conventionnelle ${p.fmt(p.ref)}` : ""}`, ev)).on("mouseleave", tip.hide);
        rows.push({ p: p.label, m: `${it.code} ${it.court}`, lo: p.fmt(lo), mid: p.fmt(mid), hi: p.fmt(hi) });
      });
    });
    return { cols: [{ key: "p", label: "Paramètre" }, { key: "m", label: "Revêtement" }, { key: "lo", label: "Bas", r: 1 }, { key: "mid", label: "Central", r: 1 }, { key: "hi", label: "Haut", r: 1 }], rows };
  };

  /* Petits multiples des poids AHP : un panneau par profil */
  CH.weights = function (el, o) {
    const { w, h: H } = CH.box(el);
    const k = CH.k(), n = o.profiles.length, gap = 10 * k, lab = 64 * k, pw = (w - lab - gap * (n - 1)) / n;
    const head = 36 * k, foot = 18 * k;
    const rg = 6 * k, bh = Math.max(12 * k, Math.min(22 * k, (H - head - foot - 4) / o.enjeux.length - rg));
    const h = head + o.enjeux.length * (bh + rg) + foot;
    const s = svg(el, w, h), tip = CH.tip(el);
    o.enjeux.forEach((e, i) => s.append("text").attr("x", 0).attr("y", head + i * (bh + rg) + bh / 2).attr("dy", ".35em").text(o.lib[e]));
    const x = d3.scaleLinear().domain([0, 0.6]).range([0, pw - 32 * k]);
    const groups = [];
    o.profiles.forEach((p, j) => {
      const sel = p.id === o.selected;
      const g = s.append("g").attr("transform", `translate(${lab + j * (pw + gap)},0)`).style("cursor", "pointer");
      groups.push(g);
      g.append("rect").attr("x", -5).attr("y", 0).attr("width", pw + 6).attr("height", h).attr("fill", sel ? "#eef0f2" : "transparent");
      g.append("text").attr("class", "lbl").attr("x", 0).attr("y", 12 * k).text(p.nom).call(wrap, pw - 4);
      o.enjeux.forEach((e, i) => {
        const v = p.poids[e], y = head + i * (bh + rg);
        g.append("path").attr("d", hbar(0, y, x(v), bh)).attr("fill", sel ? PAL.ink : "#8a909a");
        g.append("text").attr("class", "val sm").attr("x", x(v) + 3).attr("y", y + bh / 2).attr("dy", ".35em").text(CH.n2(v));
      });
      g.append("text").attr("class", "muted sm").attr("x", 0).attr("y", h - 3).text(`RC ${CH.n2(p.cr)}`);
      g.append("rect").attr("class", "hit").attr("x", -5).attr("width", pw + 6).attr("height", h)
        .on("mouseenter", () => groups.forEach((gg, i2) => gg.classed("dim", i2 !== j)))
        .on("mousemove", (ev) => tip.show(`<b>${p.nom}</b><br>${p.acteur}<br>Cliquer pour cartographier ce profil`, ev))
        .on("mouseleave", () => { groups.forEach((gg) => gg.classed("dim", false)); tip.hide(); })
        .on("click", () => o.onSelect && o.onSelect(p.id));
    });
    return { cols: [{ key: "p", label: "Profil" }, ...o.enjeux.map((e) => ({ key: e, label: o.lib[e], r: 1, fmt: CH.n2 })), { key: "cr", label: "RC", r: 1, fmt: CH.n2 }],
      rows: o.profiles.map((p) => Object.assign({ p: p.nom, cr: p.cr }, p.poids)) };
  };
  function wrap(text, width) {
    text.each(function () {
      const t = d3.select(this), words = t.text().split(/\s+/), x = t.attr("x"), y = t.attr("y");
      t.text(null);
      let line = [], ts = t.append("tspan").attr("x", x).attr("y", y), ln = 0;
      words.forEach((wd) => {
        line.push(wd); ts.text(line.join(" "));
        if (ts.node().getComputedTextLength() > width && line.length > 1) {
          line.pop(); ts.text(line.join(" ")); line = [wd]; ln++;
          ts = t.append("tspan").attr("x", x).attr("y", +y + ln * 13 * CH.k()).text(wd);
        }
      });
    });
  }

  /* Barres empilées 100 % : part de surface par revêtement dans chaque classe */
  CH.stacked = function (el, o) {
    const { w } = CH.box(el);
    const k = CH.k(), lw = 40 * k, bh = 18 * k, gap = 12 * k, h = o.rows.length * (bh + gap) + 40 * k;
    const s = svg(el, w, h), tip = CH.tip(el);
    const x = d3.scaleLinear().domain([0, 1]).range([lw, w - 70 * k]);
    o.rows.forEach((r, i) => {
      const y = 4 + i * (bh + gap);
      s.append("text").attr("class", "lbl").attr("x", 0).attr("y", y + bh / 2).attr("dy", ".35em").text(r.label);
      let acc = 0;
      PAL.matCodes.forEach((m) => {
        const v = r.parts[m] || 0;
        if (v <= 0) return;
        const x0 = x(acc), x1 = x(acc + v);
        s.append("rect").attr("x", x0).attr("y", y).attr("width", Math.max(0, x1 - x0 - 2)).attr("height", bh).attr("fill", PAL.mat[m])
          .on("mousemove", (ev) => tip.show(`<b>${r.label}</b> · ${m} ${DG_META.materiaux[m].court}<br>${CH.pct(v)} de ${CH.n1(r.total)} ha`, ev)).on("mouseleave", tip.hide);
        if (x1 - x0 > 34) s.append("text").attr("x", x0 + 5).attr("y", y + bh / 2).attr("dy", ".35em").style("fill", PAL.textOn(PAL.mat[m])).style("font-weight", 700).style("pointer-events", "none").text(CH.pct(v));
        acc += v;
      });
      s.append("text").attr("class", "val").attr("x", w - 64 * k).attr("y", y + bh / 2).attr("dy", ".35em").text(`${CH.n0(r.total)} ha`);
    });
    const lg = s.append("g").attr("transform", `translate(${lw},${o.rows.length * (bh + gap) + 14 * k})`);
    let lx = 0;
    PAL.matCodes.forEach((m) => {
      const it = lg.append("g").attr("transform", `translate(${lx},0)`);
      it.append("rect").attr("width", 10).attr("height", 10).attr("y", -1).attr("fill", PAL.mat[m]);
      const tt = it.append("text").attr("x", 14).attr("y", 8).text(`${m} ${DG_META.materiaux[m].court}`);
      lx += tt.node().getComputedTextLength() + 28;
    });
    return { cols: [{ key: "label", label: "Classe" }, ...PAL.matCodes.map((m) => ({ key: m, label: m, r: 1, fmt: CH.pct })), { key: "total", label: "Surface (ha)", r: 1, fmt: CH.n1 }],
      rows: o.rows.map((r) => Object.assign({ label: r.label, total: r.total }, r.parts)) };
  };

  /* Tornade : sensibilité un-à-un */
  CH.tornado = function (el, o) {
    const { w } = CH.box(el);
    const k = CH.k(), lw = (o.labelW || 150) * k, bh = 12 * k, gap = 8 * k, h = o.rows.length * (bh + gap) + 28 * k;
    const s = svg(el, w, h), tip = CH.tip(el);
    const x = d3.scaleLinear().domain(o.domain).range([lw, w - 46 * k]);
    s.append("g").attr("class", "axis").attr("transform", `translate(0,${h - 22 * k})`).call(d3.axisBottom(x).ticks(4).tickFormat(o.fmt).tickSizeOuter(0)).call((g) => g.select(".domain").attr("stroke", PAL.hair));
    o.rows.forEach((r, i) => {
      const y = i * (bh + gap) + 2;
      s.append("text").attr("x", 0).attr("y", y + bh / 2).attr("dy", ".35em").text(r.label);
      const x0 = x(o.domain[1]), x1 = x(r.value);
      s.append("rect").attr("x", Math.min(x0, x1)).attr("y", y).attr("width", Math.abs(x0 - x1)).attr("height", bh).attr("fill", r.color || PAL.ink);
      s.append("text").attr("class", "val").attr("x", Math.min(x0, x1) - 4).attr("y", y + bh / 2).attr("dy", ".35em").attr("text-anchor", "end").text(o.fmt(r.value));
      s.append("rect").attr("class", "hit").attr("x", 0).attr("y", y - gap / 2).attr("width", w).attr("height", bh + gap)
        .on("mousemove", (ev) => tip.show(`<b>${r.label}</b><br>${r.tip || o.fmt(r.value)}`, ev)).on("mouseleave", tip.hide);
    });
    s.append("text").attr("class", "muted").attr("x", w - 4).attr("y", h - 2).attr("text-anchor", "end").text(o.xlab || "");
    return { cols: [{ key: "label", label: "Variation" }, { key: "value", label: o.valLabel || "Valeur", r: 1, fmt: o.fmt }], rows: o.rows };
  };

  /* Courbes temporelles : une série mise en avant, les autres en contexte, bande 10-90 %, réticule */
  CH.lines = function (el, o) {
    const { w, h: H } = CH.box(el);
    const h = Math.max(150, Math.min(o.h || 260, H - (o.reserve || 0)));
    const k = CH.k(), m = { t: 12, r: (o.endLabels === false ? 14 : 104) * k, b: 26 * k, l: 52 * k };
    const s = svg(el, w, h), tip = CH.tip(el);
    const x = d3.scaleLinear().domain(d3.extent(o.years)).range([m.l, w - m.r]);
    const all = o.series.flatMap((se) => se.values.flatMap((v) => [v.y, v.lo, v.hi])).filter((v) => v != null);
    const y = d3.scaleLinear().domain([o.zero === false ? d3.min(all) - 0.15 : Math.min(0, d3.min(all)), d3.max(all)]).nice().range([h - m.b, m.t]);
    s.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat("")).call((g) => g.select(".domain").remove());
    s.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(o.fmt).tickSizeOuter(0)).call((g) => g.select(".domain").remove());
    s.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")).tickSizeOuter(0));
    if (y.domain()[0] < 0) s.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", PAL.ink3).attr("stroke-width", 1);
    if (o.ylab) s.append("text").attr("class", "muted").attr("x", m.l).attr("y", m.t - 1).attr("dy", "-.1em").text("");
    const line = d3.line().x((d) => x(d.x)).y((d) => y(d.y));
    const area = d3.area().x((d) => x(d.x)).y0((d) => y(d.lo)).y1((d) => y(d.hi));
    const order = o.series.slice().sort((a, b) => (a.id === o.selected) - (b.id === o.selected));
    const labels = [];
    order.forEach((se) => {
      const sel = se.id === o.selected;
      if (sel && se.values[0].lo != null) s.append("path").attr("d", area(se.values)).attr("fill", PAL.ink).attr("opacity", 0.1);
      s.append("path").attr("d", line(se.values)).attr("fill", "none").attr("stroke", sel ? PAL.ink : "#a3a8b0").attr("stroke-width", sel ? 2.5 : 1.5);
      const last = se.values[se.values.length - 1];
      labels.push({ y: y(last.y), txt: se.label, sel, v: last.y });
    });
    // étiquettes directes en fin de courbe, sans chevauchement
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14 * k) labels[i].y = labels[i - 1].y + 14 * k;
    if (o.endLabels !== false) labels.forEach((l) => s.append("text").attr("x", w - m.r + 6).attr("y", l.y).attr("dy", ".35em").style("font-weight", l.sel ? 700 : 500).style("fill", l.sel ? PAL.ink : PAL.ink3).text(l.txt));
    if (o.year != null) {
      s.append("line").attr("x1", x(o.year)).attr("x2", x(o.year)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", PAL.ink).attr("stroke-dasharray", "3 3");
    }
    if (o.annot) o.annot(s, x, y);
    const cross = s.append("line").attr("y1", m.t).attr("y2", h - m.b).attr("stroke", PAL.ink3).attr("visibility", "hidden");
    s.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b)
      .on("mousemove", (ev) => {
        const [mx] = d3.pointer(ev);
        const yr = Math.round(x.invert(mx));
        cross.attr("x1", x(yr)).attr("x2", x(yr)).attr("visibility", "visible");
        const lines = o.series.map((se) => {
          const v = se.values.find((d) => d.x === yr);
          return v ? `<div${se.id === o.selected ? ' style="font-weight:700"' : ""}>${se.label} : ${o.fmt(v.y)}${v.lo != null && se.id === o.selected ? ` <span style="opacity:.75">[${o.fmt(v.lo)} ; ${o.fmt(v.hi)}]</span>` : ""}</div>` : "";
        }).join("");
        tip.show(`<b>${yr}</b>${lines}`, ev);
      })
      .on("mouseleave", () => { cross.attr("visibility", "hidden"); tip.hide(); })
      .on("click", (ev) => { const [mx] = d3.pointer(ev); o.onYear && o.onYear(Math.round(x.invert(mx))); });
    const rows = o.years.map((yr) => Object.assign({ an: yr }, ...o.series.map((se) => ({ [se.id]: (se.values.find((d) => d.x === yr) || {}).y }))));
    return { cols: [{ key: "an", label: "Année" }, ...o.series.map((se) => ({ key: se.id, label: se.label, r: 1, fmt: o.fmt }))], rows };
  };

  /* Schéma vertical de la chaîne de traitement (HTML) */
  CH.pipeline = function (el, steps) {
    const ol = d3.select(el).append("ol").attr("class", "pipeline");
    const li = ol.selectAll("li").data(steps).join("li");
    li.append("div").attr("class", "k").html((d) => `${d.k}<small>${d.n}</small>`);
    li.append("div").attr("class", "d").html((d) => `<b>${d.t}.</b> ${d.d}`);
    return { cols: [{ key: "k", label: "Étape" }, { key: "t", label: "Contenu" }, { key: "n", label: "Volume" }, { key: "d", label: "Détail" }], rows: steps };
  };

  window.CH = CH;
})();
