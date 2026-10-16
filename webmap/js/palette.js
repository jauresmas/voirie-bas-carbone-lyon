/* Palette et rampes de la planche.
   Catégoriel (revêtements) : Okabe-Ito, ordre fixe R1-R4, validé (CVD ΔE ≥ 9,6 entre voisins).
   Séquentiel : une teinte, du clair au foncé ; l'aptitude d'un revêtement prend la teinte de ce revêtement.
   Robustesse : gris + épaisseur (canal non chromatique). Vermillon réservé au parcours guidé. */
(function () {
  const MAT = { R1: "#009E73", R2: "#E69F00", R3: "#0072B2", R4: "#CC79A7" };
  const ramp = (stops) => stops;
  const P = {
    paper: "#fcfcfb", ink: "#14181f", ink2: "#3f4652", ink3: "#5f6672", hair: "#d5d8dc", wash: "#f2f3f4",
    course: "#D55E00", out: "#cfd2d6", none: "#d9dbdf",
    mat: MAT, matCodes: ["R1", "R2", "R3", "R4"],
    ramps: {
      chaleur: ramp(["#f6ddd2", "#eeb59f", "#e0846b", "#c85544", "#a12e27", "#6e1414"]),
      indic: ramp(["#dfe4f0", "#b9c3de", "#8d9cc6", "#6576a9", "#43548a", "#26356a"]),
      gris: ramp(["#d9dbdf", "#b3b7be", "#8a909a", "#5e6570", "#363c46", "#14181f"]),
      R1: ramp(["#d3ece3", "#a3d6c3", "#6cbda0", "#36a27d", "#0b8462", "#055a43"]),
      R2: ramp(["#f8e7c2", "#f2d08c", "#ecb84f", "#d99a0d", "#a87405", "#6f4c02"]),
      R3: ramp(["#d4e4f1", "#a6c8e3", "#71a7d2", "#3c85bd", "#0b66a2", "#08446d"]),
      R4: ramp(["#f3dde9", "#e8bfd6", "#db9ec1", "#c879a8", "#a4588a", "#6f3a5d"]),
    },
    diverge: ["#2f62a3", "#7d9cc9", "#c9d3e3", "#e3e4e6", "#ecc9bf", "#d4836f", "#a12e27"],
    corr: ["#2f62a3", "#7d9cc9", "#c9d3e3", "#e3e4e6", "#b3b7be", "#5e6570", "#14181f"],
    pl: { TS: "#14181f", T0: "#14181f", T1: "#43548a", T2: "#6576a9", T3: "#8d9cc6", T4: "#b9c3de", T5: "#dfe4f0" },
  };
  // Couleur interpolée sur une rampe (t dans [0,1])
  P.at = function (stops, t) {
    if (t == null || isNaN(t)) return P.none;
    t = Math.max(0, Math.min(1, t));
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    return d3.interpolateRgb(stops[i], stops[i + 1])(f);
  };
  // Expression MapLibre « interpolate » sur un état de l'objet
  P.expr = function (stops, key, domain) {
    const [a, b] = domain || [0, 1];
    const e = ["interpolate", ["linear"], ["coalesce", ["feature-state", key], a]];
    stops.forEach((c, i) => e.push(a + (b - a) * i / (stops.length - 1), c));
    return e;
  };
  // Couleur de texte lisible sur un aplat (contraste WCAG le plus élevé entre encre et blanc)
  P.textOn = function (fill) {
    const lum = (c) => { const k = d3.rgb(c); return [k.r, k.g, k.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
    const L = lum(fill), cw = 1.05 / (L + 0.05), ci = (L + 0.05) / (lum(P.ink) + 0.05);
    return cw >= ci ? "#ffffff" : P.ink;
  };
  window.PAL = P;
})();
