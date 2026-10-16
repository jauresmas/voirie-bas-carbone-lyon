"""Mission 1b — Structuration de la base géospatiale multi-sources.

Entrée : 01_donnees/brutes/ (couches telles que livrées par les producteurs)
Sortie : 01_donnees/base_revetements.gpkg (Lambert-93, noms et champs normalisés),
         rapport qualité et dictionnaire de données.
"""
import re

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box
from shapely.ops import unary_union

from config import BRUT, BUFFER_COLLECTE, CRS, CRS_GRILLE, CRS_WEB, DATA, GPKG, TERRITOIRE
from outils import cataloguer, http_get

if GPKG.exists():
    GPKG.unlink()
QUALITE = {}


def lire(producteur, nom):
    return gpd.read_file(BRUT / producteur / f"{nom}.gpkg").to_crs(CRS)


def ecrire(gdf, couche, description):
    gdf.to_file(GPKG, layer=couche, driver="GPKG")
    QUALITE[couche] = {"description": description, "objets": len(gdf),
                       "geometrie": ",".join(sorted(gdf.geom_type.dropna().unique())),
                       "invalides": int((~gdf.is_valid).sum()), "champs": gdf.drop(columns="geometry").dtypes}
    print(f"  {couche:<24} {len(gdf):>7} objets")


# ------------------------------------------------------------------ référentiel
print("Référentiel territorial")
arr = lire("ign_bdtopo", "arrondissements")
arr = arr.rename(columns={"code_insee": "insee", "nom_officiel": "nom"})[["insee", "nom", "geometry"]]
arr["nom"] = arr["nom"].str.replace(" Arrondissement", "", regex=False)
terr = gpd.GeoDataFrame({"nom": [TERRITOIRE["nom"]], "code": [TERRITOIRE["code_commune"]]},
                        geometry=[arr.union_all()], crs=CRS)
terr["surface_km2"] = terr.area / 1e6
zone = terr.geometry.iloc[0].buffer(BUFFER_COLLECTE)
ecrire(arr, "ref_arrondissements", "Arrondissements municipaux (IGN BD TOPO)")
ecrire(terr, "ref_territoire", "Territoire d'étude (union des arrondissements)")

# ------------------------------------------------------------------ voirie
print("Voirie (Métropole de Lyon)")
v = lire("metropole_lyon", "voirie_chaussee_trottoir")
v = v[v["insee1"].isin(TERRITOIRE["codes_insee"])].copy()
HIER = {"Niv. 2 - Liaisons interquartiers": "Niv. 2 — liaison interquartiers",
        "Niv. 3p - Liaisons entre pôles": "Niv. 3p — liaison entre pôles",
        "Niv. 3d - Voies de distribution": "Niv. 3d — distribution",
        "Niv. 4a - Voies d'agglomération": "Niv. 4a — voie d'agglomération"}
t = gpd.GeoDataFrame({
    "id_troncon": v["codetroncon"], "nom_voie": v["nomvoie1"].fillna("Voie sans nom"),
    "insee": v["insee1"], "arrondissement": v["commune1"].str.replace(" Arrondissement", "", regex=False),
    "domanialite": v["domanialite"].fillna("Non renseignée"),
    "hierarchie": v["hierarchiefonctionnelle"].map(HIER).fillna("Desserte locale"),
    "vitesse_kmh": pd.to_numeric(v["limitationvitesse"], errors="coerce"),
    "zone_apaisee": v["reglementationzca"].fillna("Aucune"),
    "ligne_bus": v["lignebus"].fillna("Aucune"),
    "reseau_pl": v["reseaupl"].fillna("Non renseigné"),
    "structure": v["hierarchiestructurelle"].fillna("Non renseignée"),
    "classe_pl": v["comptagepl"].str.extract(r"^(T\d|TS)", expand=False),
    "largeur_chaussee_m": v["largeurchaussee"].where(v["largeurchaussee"] > 0),
    "surface_chaussee_m2": v["surfacechaussee"].where(v["surfacechaussee"] > 0),
    "pente_moy_gl": v["pentemoyenne"], "pente_max_gl": v["pentemaximale"],
    "nb_voies": v["nombrevoies"],
    "revetement": v["revetementchaussee"].fillna("Non renseigné"),
    "larg_trottoirs_m": v[["largeurtrottoirdroit", "largeurtrottoirgauche"]].fillna(0).sum(axis=1),
    "surf_trottoirs_m2": v[["surfacetrottoirdroit", "surfacetrottoirgauche"]].fillna(0).sum(axis=1),
}, geometry=v.geometry.values, crs=CRS)
t = t.drop_duplicates("id_troncon").reset_index(drop=True)
t["longueur_m"] = t.length.round(1)
t["bus"] = (t["ligne_bus"] != "Aucune").astype(int)
t["bus_site_propre"] = t["ligne_bus"].str.contains("site propre|voie réservée").astype(int)
t["public"] = (~t["domanialite"].isin(["Privé", "En attente"])).astype(int)
BITUMINEUX = ["Béton Bitumineux", "Béton Bitumineux spécial", "Asphalte", "Non renseigné"]
t["revetement_bitumineux"] = t["revetement"].isin(BITUMINEUX).astype(int)

# Classe de trafic PL : imputation hiérarchique par le mode des tronçons mesurés
t["classe_pl_source"] = np.where(t["classe_pl"].notna(), "relevé Métropole", "imputée")
connus = t[t["classe_pl"].notna()]
for cles in (["reseau_pl", "hierarchie", "bus"], ["reseau_pl", "hierarchie"], ["reseau_pl"], ["hierarchie"]):
    modes = connus.groupby(cles)["classe_pl"].agg(lambda s: s.mode().iloc[0])
    manque = t["classe_pl"].isna()
    if not manque.any():
        break
    t.loc[manque, "classe_pl"] = t.loc[manque, cles].apply(lambda r: modes.get(tuple(r) if len(cles) > 1 else r.iloc[0]), axis=1)
t["classe_pl"] = t["classe_pl"].fillna("T5")
ORDRE_PL = {"TS": 0, "T0": 1, "T1": 2, "T2": 3, "T3": 4, "T4": 5, "T5": 6}
PL_MOY = {"TS": 2500, "T0": 1200, "T1": 520, "T2": 225, "T3": 100, "T4": 38, "T5": 12}  # PL/j/sens, centre de classe
t["pl_jour_sens"] = t["classe_pl"].map(PL_MOY)

# Surface de chaussée manquante : longueur x largeur médiane du même type de voie
med_larg = t.groupby(["hierarchie", "zone_apaisee"])["largeur_chaussee_m"].median()
med_h = t.groupby("hierarchie")["largeur_chaussee_m"].median()
larg_est = t.apply(lambda r: med_larg.get((r.hierarchie, r.zone_apaisee), med_h.get(r.hierarchie)), axis=1)
t["surface_source"] = np.where(t["surface_chaussee_m2"].notna(), "relevé Métropole", "estimée (longueur x largeur type)")
t["largeur_chaussee_m"] = t["largeur_chaussee_m"].fillna(larg_est).fillna(5.0).round(1)
t["surface_chaussee_m2"] = t["surface_chaussee_m2"].fillna(t["longueur_m"] * t["largeur_chaussee_m"]).round(1)

# Pentes : calcul indépendant par le RGE ALTI (service altimétrique IGN), 3 points par tronçon
print("  altimétrie RGE ALTI (service IGN)...")
cache = BRUT / "ign_altimetrie" / "altitudes_troncons.csv"
pts = []
for g in t.geometry:
    g = g if g.geom_type == "LineString" else max(g.geoms, key=lambda p: p.length)
    pts += [g.interpolate(f, normalized=True) for f in (0, 0.5, 1)]
pw = gpd.GeoSeries(pts, crs=CRS).to_crs(CRS_WEB)
if cache.exists() and len(pd.read_csv(cache)) == len(pw):
    z = pd.read_csv(cache)["z"].to_numpy()
else:
    z = []
    for i in range(0, len(pw), 150):
        lot = pw.iloc[i:i + 150]
        r = http_get("https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json",
                     {"lon": "|".join(f"{p.x:.6f}" for p in lot), "lat": "|".join(f"{p.y:.6f}" for p in lot),
                      "resource": "ign_rge_alti_wld", "zonly": "true"})
        z += r.json()["elevations"]
    z = np.array(z, dtype=float)
    z[z < -100] = np.nan
    cache.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"x_wgs84": pw.x, "y_wgs84": pw.y, "z": z}).to_csv(cache, index=False)
    cataloguer(id_couche="ign_rgealti", theme="Relief", intitule="Altitudes RGE ALTI aux extrémités et milieu des tronçons",
               producteur="IGN", service="API altimétrie Géoplateforme (ign_rge_alti_wld)",
               source="https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json", millesime="RGE ALTI 1 m",
               licence="Licence Ouverte v2.0 (Etalab)", emprise=TERRITOIRE["nom"], nb_objets=len(z), geometrie="Point",
               usage_projet="Pente des tronçons (contrôle et complément des pentes Métropole)",
               fichier_brut=str(cache.relative_to(BRUT.parent)))
z = z.reshape(-1, 3)
demi = t["longueur_m"].to_numpy() / 2
t["altitude_m"] = np.round(z[:, 1], 1)
t["pente_rgealti"] = np.round(100 * (np.abs(z[:, 1] - z[:, 0]) + np.abs(z[:, 2] - z[:, 1])) / (2 * demi), 1)
t["pente_pct"] = t["pente_moy_gl"].fillna(t["pente_rgealti"]).clip(upper=25)
t["pente_source"] = np.where(t["pente_moy_gl"].notna(), "relevé Métropole", "RGE ALTI (IGN)")
both = t[t["pente_moy_gl"].notna() & t["pente_rgealti"].notna() & (t["longueur_m"] > 30)]
QUALITE["_pente"] = {"n": len(both), "corr": round(both["pente_moy_gl"].corr(both["pente_rgealti"], method="spearman"), 2),
                     "ecart_median": round((both["pente_rgealti"] - both["pente_moy_gl"]).abs().median(), 2)}

# Comptages tous véhicules -> tronçon le plus proche (25 m)
print("  comptages de trafic...")
c = lire("metropole_lyon", "comptages_trafic")
c = c[(c["typepostemesure"] == "Comptage tous véhicules") & c["moyennejoursouvrable"].notna()]
cj = gpd.sjoin_nearest(c[["moyennejoursouvrable", "anneereference", "geometry"]], t[["id_troncon", "geometry"]],
                       max_distance=25, distance_col="dist")
tmjo = cj.groupby("id_troncon")["moyennejoursouvrable"].max()
t["tmjo_mesure"] = t["id_troncon"].map(tmjo)
med_tmjo = t.groupby(["hierarchie", "reseau_pl"])["tmjo_mesure"].median()
med_tmjo_h = t.groupby("hierarchie")["tmjo_mesure"].median()
est = t.apply(lambda r: med_tmjo.get((r.hierarchie, r.reseau_pl), np.nan), axis=1).fillna(t["hierarchie"].map(med_tmjo_h))
t["tmjo_veh_j"] = t["tmjo_mesure"].fillna(est).fillna(1500).round(-1)
t["tmjo_source"] = np.where(t["tmjo_mesure"].notna(), "comptage", "estimé (médiane du type de voie)")
QUALITE["_trafic"] = {"postes": len(c), "troncons_mesures": int(t["tmjo_mesure"].notna().sum())}

t["dans_le_champ"] = ((t["public"] == 1) & (t["revetement_bitumineux"] == 1)).astype(int)
ecrire(t, "voi_troncons", "Tronçons de voirie : unité d'analyse (Métropole de Lyon + pentes RGE ALTI)")
ecrire(c[["nom", "moyennejoursouvrable", "debithorairemax", "anneereference", "geometry"]].rename(
    columns={"moyennejoursouvrable": "tmjo_veh_j"}), "voi_comptages", "Postes de comptage tous véhicules")

# ------------------------------------------------------------------ mobilités
print("Mobilités")
for src, couche, desc, champs in [
    ("lignes_bus", "mob_lignes_bus", "Lignes de bus TCL", ["ligne", "nom_trace", "famille_transport", "couleur_hex"]),
    ("lignes_tram", "mob_lignes_tram", "Lignes de tramway TCL", ["ligne", "nom_trace", "couleur_hex"]),
    ("couloirs_bus", "mob_couloirs_bus", "Couloirs de bus", ["nomvoie", "environnementcouloir", "largeur", "anneerealisation"]),
    ("arrets_tc", "mob_arrets_tc", "Arrêts de transport collectif", ["nom", "desserte"]),
    ("amenagements_cyclables", "mob_cyclable", "Aménagements cyclables", ["nom", "typeamenagement", "reseau", "anneelivraison"]),
]:
    g = lire("metropole_lyon", src)
    g = g[g.intersects(zone)][champs + ["geometry"]]
    ecrire(g, couche, desc)
ecrire(lire("metropole_lyon", "zfe")[["vp_critair", "date_debut", "geometry"]], "reg_zfe", "Zone à faibles émissions")

# ------------------------------------------------------------------ bâti
print("Bâti")
b = lire("ign_bdtopo", "batiment")
b = b[b.intersects(zone) & (b["etat_de_l_objet"] == "En service")].copy()
med_usage = b.groupby("usage_1")["hauteur"].median()
b["hauteur_source"] = np.where(b["hauteur"].notna(), "BD TOPO", "estimée")
b["hauteur"] = b["hauteur"].fillna(b["nombre_d_etages"] * 3.0).fillna(b["usage_1"].map(med_usage)).fillna(6.0)
ecrire(b[["cleabs", "usage_1", "hauteur", "nombre_d_etages", "hauteur_source", "geometry"]], "bat_batiments", "Bâtiments en service")

# ------------------------------------------------------------------ végétation
print("Végétation")
a = lire("metropole_lyon", "arbres_alignement")
a = a[a.intersects(zone)].copy()
r = a["rayoncouronne_m"].where(a["rayoncouronne_m"] > 0)
a["rayon_houppier_m"] = r.fillna((a["hauteurtotale_m"] * 0.3).clip(1, 6)).fillna(2.5)
ecrire(a[["identifiant", "essence", "genre", "hauteurtotale_m", "rayon_houppier_m", "anneeplantation", "nomvoie", "geometry"]],
       "veg_arbres_alignement", "Arbres d'alignement (rayon de houppier)")
vg = lire("ign_bdtopo", "zone_de_vegetation")
ecrire(vg[vg.intersects(zone)][["nature", "geometry"]], "veg_zones", "Zones de végétation (BD TOPO)")
ecrire(lire("metropole_lyon", "canopee_parcs")[["nom", "indiccanop", "geometry"]], "veg_canopee_parcs", "Indice de canopée des parcs")

# ------------------------------------------------------------------ climat
print("Climat urbain")
SCORE_EXPO = {"effet rafraîchissant": 0.0, "faible": 1 / 3, "moyen": 2 / 3, "fort": 1.0}
icu = lire("metropole_lyon", "ilots_chaleur_urbains")
icu = icu[icu.intersects(zone)].copy()
for c_ in ["expo_jour", "expo_nuit", "vulnerabilite_jour", "vulnerabilite_nuit"]:
    icu[f"s_{c_}"] = icu[c_].map(SCORE_EXPO)
ecrire(icu[["lcz_code", "lcz_lib", "expo_jour", "expo_nuit", "vulnerabilite_jour", "vulnerabilite_nuit",
            "s_expo_jour", "s_expo_nuit", "s_vulnerabilite_jour", "s_vulnerabilite_nuit", "geometry"]],
       "clim_icu_metropole", "Îlots de chaleur urbains (Métropole de Lyon)")
lcz = gpd.read_file(BRUT / "cerema_lcz" / "lcz_spot2022.gpkg").to_crs(CRS)
lcz["lcz"] = lcz["lcz"].astype(str)
ecrire(lcz, "clim_lcz_cerema", "Zones climatiques locales (Cerema, SPOT 2022)")

# ------------------------------------------------------------------ équipements sensibles
print("Équipements sensibles")
SENSIBLES = {"Enseignement primaire": "École", "Collège": "Collège / lycée", "Lycée": "Collège / lycée",
             "Hôpital": "Santé", "Etablissement hospitalier": "Santé", "Maison de retraite": "Personnes âgées",
             "Résidence autonomie": "Personnes âgées", "Structure d'accueil pour personnes handicapées": "Handicap"}
eq = lire("ign_bdtopo", "zone_activite_interet")
eq = eq[eq["nature"].isin(SENSIBLES) & eq.intersects(zone)].copy()
eq["type_sensible"] = eq["nature"].map(SENSIBLES)
ecrire(eq[["toponyme", "nature", "type_sensible", "geometry"]], "eq_sensibles", "Établissements accueillant des publics sensibles")

# ------------------------------------------------------------------ risques et hydrographie
print("Risques / hydrographie")
for nom, couche, desc in [("alea_debordement_moyen", "risq_inondation_moyen", "Aléa débordement — scénario moyen"),
                          ("alea_debordement_extreme", "risq_inondation_extreme", "Aléa débordement — scénario extrême")]:
    f = BRUT / "georisques" / f"{nom}.gpkg"
    if f.exists():
        g = gpd.read_file(f).to_crs(CRS)
        g["geometry"] = g.geometry.make_valid().apply(
            lambda x: unary_union([p for p in getattr(x, "geoms", [x]) if p.geom_type in ("Polygon", "MultiPolygon")]))
        g = g[g.intersects(zone)]
        g = g.dissolve(by=["cours_deau", "scenario", "id_tri"], as_index=False)
        ecrire(g[["cours_deau", "scenario", "id_tri", "geometry"]], couche, desc)
h = lire("ign_bdtopo", "surface_hydrographique")
ecrire(h[h.intersects(zone)][["nature", "geometry"]], "hyd_surfaces_eau", "Surfaces en eau (BD TOPO)")

# ------------------------------------------------------------------ grille 200 m + Filosofi
print("Grille INSEE 200 m")
fil = gpd.read_file(BRUT / "insee_filosofi" / "filosofi2021_carreaux200m.gpkg")
z3035 = gpd.GeoSeries([zone], crs=CRS).to_crs(CRS_GRILLE).iloc[0]
x0, y0, x1, y1 = (np.floor(np.array(z3035.bounds) / 200) * 200).tolist()
cells, ids = [], []
for x in np.arange(x0, x1 + 200, 200):
    for y in np.arange(y0, y1 + 200, 200):
        cells.append(box(x, y, x + 200, y + 200))
        ids.append(f"CRS3035RES200mN{int(y)}E{int(x)}")
grille = gpd.GeoDataFrame({"idcar_200m": ids}, geometry=cells, crs=CRS_GRILLE)
grille = grille[grille.intersects(z3035)]
VARS = ["ind", "men", "men_pauv", "ind_snv", "ind_0_3", "ind_4_5", "ind_65_79", "ind_80p", "log_soc", "i_est_200"]
grille = grille.merge(fil[["idcar_200m"] + VARS], on="idcar_200m", how="left")
grille[VARS] = grille[VARS].fillna(0)
grille = grille.to_crs(CRS)
grille["dans_territoire"] = grille.intersects(terr.geometry.iloc[0]).astype(int)
grille["pop"] = grille["ind"].round(1)
grille["densite_hab_ha"] = (grille["ind"] / 4).round(1)
grille["pop_sensible"] = (grille[["ind_0_3", "ind_4_5", "ind_65_79", "ind_80p"]].sum(axis=1)).round(1)
grille["part_sensible"] = np.where(grille["ind"] > 0, grille["pop_sensible"] / grille["ind"], np.nan).round(3)
grille["niveau_vie_moy"] = np.where(grille["ind"] > 0, grille["ind_snv"] / grille["ind"], np.nan).round(0)
grille["taux_pauvrete_men"] = np.where(grille["men"] > 0, grille["men_pauv"] / grille["men"], np.nan).round(3)
grille["part_log_soc"] = np.minimum(np.where(grille["men"] > 0, grille["log_soc"] / grille["men"], np.nan), 1).round(3)
ecrire(grille, "ref_grille200", "Grille INSEE 200 m + Filosofi 2021")

# ------------------------------------------------------------------ rapport qualité & dictionnaire
print("Rapport qualité")


def nb(n):
    return f"{n:,}".replace(",", " ")


tt = t[t["dans_le_champ"] == 1]
lignes = ["# Rapport qualité de la base géospatiale", "",
          f"Base : `01_donnees/base_revetements.gpkg` — CRS Lambert-93 (EPSG:2154) — {len(QUALITE) - 2} couches.", "",
          "## Couches", "", "| Couche | Description | Objets | Géométrie | Géométries invalides |", "|---|---|---|---|---|"]
for k, q in QUALITE.items():
    if not k.startswith("_"):
        lignes.append(f"| `{k}` | {q['description']} | {nb(q['objets'])} | {q['geometrie']} | {q['invalides']} |")
lignes += ["", "## Unité d'analyse : tronçons de voirie", "",
           f"- {nb(len(t))} tronçons, {t['longueur_m'].sum() / 1000:.0f} km, {t['surface_chaussee_m2'].sum() / 1e6:.2f} km² de chaussée.",
           f"- **Dans le champ de l'étude** (domanialité publique et revêtement bitumineux) : {nb(len(tt))} tronçons, "
           f"{tt['surface_chaussee_m2'].sum() / 1e6:.2f} km² ({tt['surface_chaussee_m2'].sum() / t['surface_chaussee_m2'].sum():.0%} de la surface).",
           f"- Hors champ : {(t['public'] == 0).sum()} tronçons privés, {(t['revetement_bitumineux'] == 0).sum()} tronçons pavés, dallés ou bétonnés.",
           "", "| Attribut | Renseigné à la source | Traitement du manque |", "|---|---|---|",
           f"| Classe de trafic PL (T0-T5) | {(t['classe_pl_source'] == 'relevé Métropole').mean():.0%} | Mode des tronçons de même réseau PL, hiérarchie et desserte bus |",
           f"| Surface de chaussée | {(t['surface_source'] == 'relevé Métropole').mean():.0%} | Longueur x largeur médiane du même type de voie |",
           f"| Pente moyenne | {(t['pente_source'] == 'relevé Métropole').mean():.0%} | Calcul RGE ALTI (3 points par tronçon) |",
           f"| Trafic tous véhicules | {t['tmjo_mesure'].notna().mean():.0%} (comptage < 25 m) | Médiane des tronçons comptés de même type |",
           "", "### Contrôle croisé des pentes (Métropole vs RGE ALTI)", "",
           f"Sur {QUALITE['_pente']['n']} tronçons de plus de 30 m : corrélation de rang de Spearman = {QUALITE['_pente']['corr']}, "
           f"écart absolu médian = {QUALITE['_pente']['ecart_median']} point de pente. "
           "La pente Métropole (relevé terrain) est retenue en priorité ; le RGE ALTI complète les manques.", "",
           "### Points d'attention", "",
           "- Pas d'information ouverte sur l'état de surface ni sur la date du dernier renouvellement : le calendrier est simulé (mission 4).",
           "- La BD TOPO ne recense pas les crèches : la vulnérabilité « petite enfance » repose sur la population de 0-5 ans (Filosofi).",
           "- Les carreaux Filosofi de moins de 11 ménages sont imputés par l'INSEE (`i_est_200 = 1`).",
           f"- {(b['hauteur_source'] == 'estimée').mean():.1%} des hauteurs de bâtiments sont estimées (étages x 3 m ou médiane de l'usage).",
           "- La pente RGE ALTI peut être surestimée sur les ouvrages d'art (tablier comparé au terrain naturel) : elle n'est utilisée qu'en complément.",
           ]
(DATA / "rapport_qualite.md").write_text("\n".join(lignes), encoding="utf-8")

dico = ["# Dictionnaire de données — base_revetements.gpkg", "",
        "Généré automatiquement par `scripts/02_base_donnees.py`. Tous les objets sont en Lambert-93 (EPSG:2154).", ""]
for k, q in QUALITE.items():
    if k.startswith("_"):
        continue
    dico += [f"## `{k}`", "", q["description"], "", "| Champ | Type |", "|---|---|"]
    dico += [f"| `{c_}` | {str(dt_)} |" for c_, dt_ in q["champs"].items()]
    dico.append("")
(DATA / "dictionnaire_donnees.md").write_text("\n".join(dico), encoding="utf-8")
print("Base écrite :", GPKG)
