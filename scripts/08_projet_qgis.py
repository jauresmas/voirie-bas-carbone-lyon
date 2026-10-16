"""Mission 5b — Projet QGIS et cartes de mise en page (à exécuter dans la console Python de QGIS).

    exec(open(r"<dossier du projet>/scripts/08_projet_qgis.py", encoding="utf-8").read())

Sans ouvrir QGIS : "C:\Program Files\QGIS 3.34.12\bin\python-qgis-ltr.bat" scripts\08b_cartes_sans_interface.py

Construit 05_valorisation/projet_revetements.qgz : fond Plan IGN (gris), couches thématiques stylées
comme la carte web (mêmes couleurs Okabe-Ito et rampes), mises en page A4 exportées en PNG.
"""
import os

from qgis.core import (QgsCategorizedSymbolRenderer, QgsCoordinateReferenceSystem, QgsFillSymbol, QgsGraduatedSymbolRenderer,
                       QgsHueSaturationFilter, QgsLayerTree, QgsLayoutExporter, QgsLayoutItemLabel, QgsLayoutItemLegend,
                       QgsLayoutItemMap, QgsLayoutItemPage, QgsLayoutItemPicture, QgsLayoutItemScaleBar, QgsLayoutPoint,
                       QgsLayoutSize, QgsLegendStyle, QgsLineSymbol, QgsPrintLayout, QgsProject, QgsProperty, QgsRasterLayer,
                       QgsRectangle, QgsRendererCategory, QgsRendererRange, QgsRuleBasedRenderer, QgsSingleSymbolRenderer,
                       QgsSymbolLayer, QgsTextFormat, QgsUnitTypes, QgsVectorLayer)
from qgis.PyQt.QtCore import Qt
from qgis.PyQt.QtGui import QColor, QFont

try:  # lancé via 08b_cartes_sans_interface.py : le dossier du projet se déduit du script
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
except NameError:  # console Python de QGIS : se placer d'abord dans le dossier du projet (os.chdir)
    ROOT = os.getcwd()
GP = os.path.join(ROOT, "05_valorisation", "resultats_revetements.gpkg")
OUT = os.path.join(ROOT, "05_valorisation", "cartes")
os.makedirs(OUT, exist_ok=True)
MM = QgsUnitTypes.LayoutMillimeters

MAT = {"R1": ("#009E73", "R1 Liant biosourcé"), "R2": ("#E69F00", "R2 Enrobé clair"),
       "R3": ("#0072B2", "R3 Enrobé drainant"), "R4": ("#CC79A7", "R4 Recyclé + régénérant bio")}
RAMPS = {
    "chaleur": ["#f6ddd2", "#eeb59f", "#e0846b", "#c85544", "#a12e27", "#6e1414"],
    "R3": ["#d4e4f1", "#a6c8e3", "#71a7d2", "#3c85bd", "#0b66a2", "#08446d"],
    "gris": ["#d9dbdf", "#b3b7be", "#8a909a", "#5e6570", "#363c46", "#14181f"],
    "diverge": ["#2f62a3", "#7d9cc9", "#c9d3e3", "#e3e4e6", "#ecc9bf", "#d4836f", "#a12e27"],
}
WCLS = 'CASE WHEN "{c}" = 1 THEN 0.95 WHEN "{c}" = 2 THEN 0.62 WHEN "{c}" = 3 THEN 0.38 ELSE 0.2 END'

proj = QgsProject.instance()
proj.clear()
proj.setCrs(QgsCoordinateReferenceSystem("EPSG:2154"))
proj.setTitle("Revêtements routiers à liants biosourcés, Lyon")
root = proj.layerTreeRoot()


def couche(nom, titre, filtre=None):
    lyr = QgsVectorLayer(f"{GP}|layername={nom}", titre, "ogr")
    if not lyr.isValid():
        raise RuntimeError(f"Couche invalide : {nom}")
    if filtre:
        lyr.setSubsetString(filtre)
    return lyr


def ligne(color, width=0.3, ddw=None):
    s = QgsLineSymbol.createSimple({"color": color, "width": str(width), "capstyle": "round", "joinstyle": "round"})
    if ddw:
        s.symbolLayer(0).setDataDefinedProperty(QgsSymbolLayer.PropertyStrokeWidth, QgsProperty.fromExpression(ddw))
    return s


def gradue(lyr, champ, ramp, bornes, labels, ddw=None, width=0.3):
    ranges = []
    for i, (a, b) in enumerate(zip(bornes[:-1], bornes[1:])):
        ranges.append(QgsRendererRange(a, b, ligne(ramp[min(i, len(ramp) - 1)], width, ddw), labels[i]))
    r = QgsGraduatedSymbolRenderer(champ, ranges)
    lyr.setRenderer(r)


def categorise(lyr, champ, cats, ddw=None, width=0.35):
    lyr.setRenderer(QgsCategorizedSymbolRenderer(champ, [QgsRendererCategory(v, ligne(c, width, ddw), lab) for v, c, lab in cats]))


groupes = {}
for g in ["5 · Synthèse", "4 · Prospective", "3 · Analyse multicritère", "2 · Indicateurs", "1 · Données", "Contexte", "Fond de plan"]:
    groupes[g] = root.addGroup(g)


def ajouter(lyr, groupe, visible=False):
    proj.addMapLayer(lyr, False)
    node = groupes[groupe].addLayer(lyr)
    node.setItemVisibilityChecked(visible)
    return lyr


# ---------------------------------------------------------------- fond et contexte
url = ("type=xyz&url=https://data.geopf.fr/wmts?SERVICE%3DWMTS%26REQUEST%3DGetTile%26VERSION%3D1.0.0%26LAYER%3D"
       "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2%26STYLE%3Dnormal%26TILEMATRIXSET%3DPM%26FORMAT%3Dimage/png%26"
       "TILEMATRIX%3D{z}%26TILEROW%3D{y}%26TILECOL%3D{x}&zmax=19&zmin=0")
fond = QgsRasterLayer(url, "Plan IGN (niveaux de gris)", "wms")
if fond.isValid():
    fond.hueSaturationFilter().setGrayscaleMode(QgsHueSaturationFilter.GrayscaleLuminosity)
    fond.brightnessFilter().setBrightness(25)
    fond.renderer().setOpacity(0.45)
    ajouter(fond, "Fond de plan", True)
eau = couche("hyd_surfaces_eau", "Rhône et Saône")
eau.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"color": "#dbe5ec", "outline_style": "no"})))
ajouter(eau, "Fond de plan", True)
terr = couche("ref_territoire", "Limite de Lyon")
terr.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"style": "no", "outline_color": "#14181f", "outline_width": "0.5"})))
ajouter(terr, "Contexte", True)
arr = couche("ref_arrondissements", "Arrondissements")
arr.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"style": "no", "outline_color": "#14181f", "outline_width": "0.2", "outline_style": "dash"})))
ajouter(arr, "Contexte", True)
inond = couche("risq_inondation_moyen", "Zone inondable (aléa moyen)")
inond.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"color": "0,114,178,40", "outline_color": "#0072B2", "outline_width": "0.15"})))
ajouter(inond, "Contexte")
icu = couche("clim_icu_metropole", "Exposition à la chaleur de jour (ICU)")
icu.setRenderer(QgsCategorizedSymbolRenderer("expo_jour", [
    QgsRendererCategory(v, QgsFillSymbol.createSimple({"color": c, "outline_style": "no"}), lab) for v, c, lab in
    [("effet rafraîchissant", "#cfe0ee", "Effet rafraîchissant"), ("faible", "#f6ddd2", "Faible"), ("moyen", "#e9a58c", "Moyenne"), ("fort", "#b8402f", "Forte")]]))
icu.setOpacity(0.6)
ajouter(icu, "Contexte")
hors = couche("troncons_resultats", "Tronçons hors champ", '"dans_le_champ" = 0')
hors.setRenderer(QgsSingleSymbolRenderer(ligne("#cfd2d6", 0.15)))
ajouter(hors, "Contexte", True)

# ---------------------------------------------------------------- couches thématiques
CH = '"dans_le_champ" = 1'
pl = couche("troncons_resultats", "Trafic poids lourds (classe)", CH)
categorise(pl, "classe_pl", [("T0", "#14181f", "T0 · plus de 750 PL/j/sens"), ("T1", "#26356a", "T1 · 301 à 750"), ("T2", "#43548a", "T2 · 151 à 300"),
                              ("T3", "#6576a9", "T3 · 51 à 150"), ("T4", "#8d9cc6", "T4 · 26 à 50"), ("T5", "#b9c3de", "T5 · 0 à 25")],
           ddw='CASE "classe_pl" WHEN \'T0\' THEN 0.7 WHEN \'T1\' THEN 0.55 WHEN \'T2\' THEN 0.45 WHEN \'T3\' THEN 0.35 ELSE 0.25 END')
ajouter(pl, "1 · Données")

chal = couche("troncons_resultats", "Besoin chaleur (N)", CH)
gradue(chal, "N_chaleur", RAMPS["chaleur"], [0, 0.2, 0.4, 0.6, 0.75, 0.9, 1.0001], ["0 – 0,2", "0,2 – 0,4", "0,4 – 0,6", "0,6 – 0,75", "0,75 – 0,9", "0,9 – 1"], width=0.35)
ajouter(chal, "2 · Indicateurs")

r3 = couche("troncons_resultats", "Aptitude R3 enrobé drainant", CH)
gradue(r3, "apt_R3", RAMPS["R3"], [0, 0.001, 0.2, 0.4, 0.6, 0.8, 1.0001], ["incompatible (0)", "0 – 0,2", "0,2 – 0,4", "0,4 – 0,6", "0,6 – 0,8", "0,8 – 1"], width=0.35)
r3.renderer().ranges()[0].symbol().setColor(QColor("#e3e4e6"))
ajouter(r3, "2 · Indicateurs")

prio = couche("troncons_resultats", "Priorité — profil équilibré", CH + ' AND "classe_equilibre" > 0')
categorise(prio, "mat_equilibre", [(k, v[0], v[1]) for k, v in MAT.items()], ddw=WCLS.format(c="classe_equilibre"))
ajouter(prio, "3 · Analyse multicritère")
for k, nom in [("adaptation", "Adaptation chaleur & santé"), ("bas_carbone", "Bas-carbone"), ("eau_sols", "Eau & sols"), ("justice", "Justice environnementale")]:
    lyr = couche("troncons_resultats", f"Priorité — profil {nom}", CH + f' AND "classe_{k}" > 0')
    categorise(lyr, f"mat_{k}", [(m, v[0], v[1]) for m, v in MAT.items()], ddw=WCLS.format(c=f"classe_{k}"))
    ajouter(lyr, "3 · Analyse multicritère")

rob = couche("troncons_resultats", "Robustesse — P(top 20 %)", CH)
gradue(rob, "p_top20", RAMPS["gris"], [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1.0001], ["< 20 %", "20 – 40 %", "40 – 60 %", "60 – 80 %", "80 – 95 %", "≥ 95 %"],
       ddw='0.12 + 0.8 * "p_top20"')
ajouter(rob, "3 · Analyse multicritère")

pros = couche("troncons_resultats", "Prospective S3 — chaussées traitées en 2040", CH)
racine = QgsRuleBasedRenderer.Rule(None)
for m, (c, lab) in MAT.items():
    racine.appendChild(QgsRuleBasedRenderer.Rule(ligne(c, 0.5), 0, 0, f'"an_S3" > 0 AND "an_S3" <= 2040 AND "mat_S3" = \'{m}\'', lab))
racine.appendChild(QgsRuleBasedRenderer.Rule(ligne("#e2e4e7", 0.2), 0, 0, 'NOT ("an_S3" > 0 AND "an_S3" <= 2040)', "non encore traitée"))
pros.setRenderer(QgsRuleBasedRenderer(racine))
ajouter(pros, "4 · Prospective")

delta = couche("troncons_resultats", "Évolution de l'aptitude 2025 → 2050 (S3)", CH)
gradue(delta, "delta2050_S3", RAMPS["diverge"], [-1, -0.1, -0.04, -0.01, 0.01, 0.04, 0.1, 1],
       ["< −0,10", "−0,10 à −0,04", "−0,04 à −0,01", "stable (±0,01)", "+0,01 à +0,04", "+0,04 à +0,10", "> +0,10"],
       ddw='0.15 + 4 * min(abs("delta2050_S3"), 0.15)')
ajouter(delta, "4 · Prospective")

synth = couche("troncons_resultats", "Programme de départ (prioritaires robustes et probables)", CH + ' AND "p_top20" >= 0.5')
categorise(synth, "mat_modal_mc", [(k, v[0], v[1]) for k, v in MAT.items()], ddw='CASE WHEN "p_top20" >= 0.8 THEN 0.8 ELSE 0.35 END')
ajouter(synth, "5 · Synthèse", True)

# ---------------------------------------------------------------- mises en page
ext = terr.extent()
ext.grow(350)
lm = proj.layoutManager()
_racines = []


def texte(L, txt, x, y, w, h, taille, gras=False, couleur="#14181f"):
    lab = QgsLayoutItemLabel(L)
    lab.setText(txt)
    fmt = QgsTextFormat()
    f = QFont("Arial")
    f.setBold(gras)
    fmt.setFont(f)
    fmt.setSize(taille)
    fmt.setColor(QColor(couleur))
    lab.setTextFormat(fmt)
    lab.attemptMove(QgsLayoutPoint(x, y, MM))
    lab.attemptResize(QgsLayoutSize(w, h, MM))
    L.addLayoutItem(lab)
    return lab


def mise_en_page(no, titre, legende, thema, fichier, note=""):
    nom = f"Carte {no} — {titre}"
    old = lm.layoutByName(nom)
    if old:
        lm.removeLayout(old)
    L = QgsPrintLayout(proj)
    L.initializeDefaults()
    L.setName(nom)
    L.pageCollection().pages()[0].setPageSize("A4", QgsLayoutItemPage.Landscape)
    texte(L, f"Carte {no} | {titre}", 10, 7, 277, 10, 15, True)
    texte(L, "Projet de recherche · Revêtements routiers à liants biosourcés · Lyon (9 arrondissements)", 10, 15.5, 277, 6, 9, False, "#3f4652")
    m = QgsLayoutItemMap(L)
    m.attemptMove(QgsLayoutPoint(10, 24, MM))
    m.attemptResize(QgsLayoutSize(190, 176, MM))
    couches = [thema, hors, arr, terr, eau] + ([fond] if fond.isValid() else [])
    m.setLayers(couches)
    m.setKeepLayerSet(True)
    e = QgsRectangle(ext)
    ratio = 190 / 176
    if e.width() / e.height() < ratio:
        e.scale(ratio * e.height() / e.width(), e.center())
    m.zoomToExtent(e)
    m.setFrameEnabled(True)
    m.setFrameStrokeColor(QColor("#14181f"))
    L.addLayoutItem(m)
    leg = QgsLayoutItemLegend(L)
    leg.setTitle(legende)
    leg.setLinkedMap(m)
    leg.setAutoUpdateModel(False)
    r = QgsLayerTree()
    r.addLayer(thema)
    _racines.append(r)
    leg.model().setRootGroup(r)
    for s in (QgsLegendStyle.Title, QgsLegendStyle.Group, QgsLegendStyle.Subgroup, QgsLegendStyle.SymbolLabel):
        st = leg.style(s)
        tf = st.textFormat()
        f = QFont("Arial")
        f.setBold(s in (QgsLegendStyle.Title,))
        tf.setFont(f)
        tf.setSize(10 if s == QgsLegendStyle.Title else 8.5)
        st.setTextFormat(tf)
        leg.setStyle(s, st)
    leg.setSymbolWidth(9)
    leg.attemptMove(QgsLayoutPoint(206, 24, MM))
    L.addLayoutItem(leg)
    sb = QgsLayoutItemScaleBar(L)
    sb.setStyle("Single Box")
    sb.setLinkedMap(m)
    sb.setUnits(QgsUnitTypes.DistanceKilometers)
    sb.setUnitLabel("km")
    sb.setNumberOfSegments(2)
    sb.setNumberOfSegmentsLeft(0)
    sb.setUnitsPerSegment(1)
    sb.attemptMove(QgsLayoutPoint(14, 188, MM))
    L.addLayoutItem(sb)
    na = QgsLayoutItemPicture(L)
    na.setPicturePath(":/images/north_arrows/layout_default_north_arrow.svg")
    na.attemptMove(QgsLayoutPoint(188, 27, MM))
    na.attemptResize(QgsLayoutSize(8, 12, MM))
    L.addLayoutItem(na)
    texte(L, note, 206, 120, 82, 60, 8.5, False, "#3f4652")
    texte(L, "Sources : Métropole de Lyon (voirie, ICU, arbres, comptages), IGN (BD TOPO, RGE ALTI, Plan IGN), INSEE (Filosofi 2021), "
             "Cerema (LCZ 2022), Géorisques. Traitements : projet de recherche, 2026. Lambert-93.", 206, 182, 82, 18, 7, False, "#5f6672")
    lm.addLayout(L)
    ex = QgsLayoutExporter(L)
    s = QgsLayoutExporter.ImageExportSettings()
    s.dpi = 160
    res = ex.exportToImage(os.path.join(OUT, fichier), s)
    return res


NOTES = {
    1: "Classe de trafic poids lourds de la voirie métropolitaine. 53 % des classes sont imputées (mode des tronçons de même réseau PL, hiérarchie et desserte bus). Contrainte mécanique principale de la matrice matériau-territoire.",
    2: "N chaleur = besoin (exposition ICU jour et nuit, potentiel LCZ) × efficacité de l'albédo (insolation : canopée des houppiers et facteur de vue du ciel). Normalisation P2–P98.",
    3: "Aptitude propre de l'enrobé drainant : compatibilité × bénéfices. Exclu sur les pentes > 6 %, sous trafic T1 et plus, et pénalisé en zone inondable.",
    4: "Revêtement recommandé (couleur) et classe de priorité (épaisseur : P1 = 10 % de la surface la plus apte, P2 = 10–30 %, P3 = 30–60 %, P4 = reste). Poids AHP égaux.",
    5: "Probabilité d'appartenir au top 20 % sur 1 000 tirages Monte-Carlo (poids des enjeux et paramètres matériaux incertains). Épaisseur proportionnelle à la probabilité.",
    6: "Scénario S3 « Transition intégrée » : sobriété des mobilités, plan canopée, déploiement ciblé et anticipé. Chaussées traitées en 2040 par revêtement.",
    7: "Évolution du score d'aptitude entre 2025 et 2050 sous S3 : réchauffement TRACC (+2,7 °C), vieillissement, mobilités apaisées, canopée accrue.",
    8: "Tronçons prioritaires dans au moins 50 % (trait fin) ou 80 % (trait épais) des tirages, colorés selon le revêtement le plus souvent recommandé.",
}
cartes = [
    (1, "Trafic poids lourds par tronçon", "Classe de trafic PL", pl, "carte1_trafic_pl.png"),
    (2, "Besoin de rafraîchissement des chaussées", "Besoin chaleur (N)", chal, "carte2_besoin_chaleur.png"),
    (3, "Aptitude à l'enrobé drainant biosourcé", "Aptitude R3", r3, "carte3_aptitude_R3.png"),
    (4, "Priorités et revêtement recommandé (profil équilibré)", "Revêtement recommandé", prio, "carte4_priorites_equilibre.png"),
    (5, "Robustesse des priorités", "P(top 20 %)", rob, "carte5_robustesse.png"),
    (6, "Déploiement en 2040, scénario Transition intégrée", "Revêtement appliqué", pros, "carte6_prospective_S3_2040.png"),
    (7, "Évolution de l'aptitude d'ici 2050", "Δ score 2025 → 2050", delta, "carte7_evolution_2050.png"),
    (8, "Programme de départ", "Revêtement (mode Monte-Carlo)", synth, "carte8_programme_depart.png"),
]
for no, titre, leg, lyr, f in cartes:
    print(no, titre, mise_en_page(no, titre, leg, lyr, f, NOTES[no]))
proj.write(os.path.join(ROOT, "05_valorisation", "projet_revetements.qgz"))
print("Projet enregistré.")
