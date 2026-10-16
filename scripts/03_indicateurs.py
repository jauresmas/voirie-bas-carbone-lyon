"""Mission 2 — Indicateurs territoriaux spatialisés et matrice matériau-territoire.

Pour chaque tronçon : indicateurs bruts (unités physiques), indicateurs normalisés [0-1],
besoins par enjeu N[s, g], compatibilité C[s, m] et aptitude par matériau.
Agrégation sur la grille INSEE 200 m pour les cartes d'aptitude territoriale.
"""
import json

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy.ndimage import uniform_filter

import materiaux as MAT
from config import BUFFER_COLLECTE, CRS, GPKG, IND

IND.mkdir(exist_ok=True)
SORTIE = IND / "indicateurs.gpkg"


def couche(nom):
    return gpd.read_file(GPKG, layer=nom).to_crs(CRS)


def norm(x, champ=None, inverse=False):
    """Normalisation min-max robuste (P2-P98) sur les tronçons du champ d'étude."""
    x = pd.Series(x, dtype=float)
    ref = x[champ] if champ is not None else x
    lo, hi = np.nanpercentile(ref, 2), np.nanpercentile(ref, 98)
    y = ((x - lo) / (hi - lo if hi > lo else 1)).clip(0, 1)
    return (1 - y if inverse else y).fillna(0).to_numpy()


class Grille:
    """Grille raster commune (Lambert-93) pour les indicateurs de voisinage."""

    def __init__(self, bounds, res):
        x0, y0, x1, y1 = bounds
        self.res, self.x0, self.y1 = res, x0, y1
        self.w, self.h = int(np.ceil((x1 - x0) / res)), int(np.ceil((y1 - y0) / res))
        self.transform = from_origin(x0, y1, res, res)

    def raster(self, geoms, valeurs, fond=np.nan, dtype="float32"):
        return rasterize(zip(geoms, valeurs), out_shape=(self.h, self.w), transform=self.transform,
                         fill=fond, dtype=dtype, all_touched=False)

    def index(self, geoms):
        """Raster des indices de polygones (-1 hors polygone) : une seule rastérisation par couche."""
        return rasterize(zip(geoms, np.arange(len(geoms))), out_shape=(self.h, self.w), transform=self.transform,
                         fill=-1, dtype="int32", all_touched=False)

    @staticmethod
    def projeter(ids, valeurs):
        """Valeurs d'attribut portées sur le raster d'indices (NaN hors polygone)."""
        v = np.asarray(valeurs, dtype="float32")
        out = np.full(ids.shape, np.nan, dtype="float32")
        m = ids >= 0
        out[m] = v[ids[m]]
        return out

    def focal(self, r, rayon_m):
        """Moyenne focale (fenêtre carrée de côté 2 x rayon) en ignorant les NaN."""
        k = max(1, int(round(2 * rayon_m / self.res)) | 1)
        ok = np.isfinite(r).astype("float32")
        num = uniform_filter(np.nan_to_num(r).astype("float32"), k, mode="constant")
        den = uniform_filter(ok, k, mode="constant")
        return np.where(den > 1e-6, num / np.maximum(den, 1e-6), np.nan)

    def echantillon(self, r, xs, ys):
        col = np.clip(((xs - self.x0) / self.res).astype(int), 0, self.w - 1)
        lig = np.clip(((self.y1 - ys) / self.res).astype(int), 0, self.h - 1)
        return r[lig, col]


def points_troncons(geoms, pas=10.0):
    """Points tous les `pas` m le long de chaque tronçon (au moins 3), avec l'indice du tronçon."""
    idx, pts = [], []
    for i, g in enumerate(geoms):
        n = max(3, int(g.length // pas) + 1)
        pts.append(shapely.line_interpolate_point(g, np.linspace(0, 1, n), normalized=True))
        idx.append(np.full(n, i))
    pts = np.concatenate(pts)
    return np.concatenate(idx), shapely.get_x(pts), shapely.get_y(pts)


def moyenne_le_long(grille, r, idx, xs, ys, n):
    v = grille.echantillon(r, xs, ys)
    ok = np.isfinite(v)
    s = np.bincount(idx[ok], weights=v[ok], minlength=n)
    c = np.bincount(idx[ok], minlength=n)
    return np.where(c > 0, s / np.maximum(c, 1), np.nan)


print("Chargement")
t = couche("voi_troncons")
champ = (t["dans_le_champ"] == 1).to_numpy()
t["largeur_rue_m"] = (t["largeur_chaussee_m"] + t["larg_trottoirs_m"].where(t["larg_trottoirs_m"] > 0, 3.0)).clip(lower=6)
rue = gpd.GeoSeries(t.buffer(t["largeur_rue_m"] / 2, cap_style="flat"), crs=CRS)
emprise = couche("ref_territoire").buffer(BUFFER_COLLECTE).total_bounds
G2, G5 = Grille(emprise, 2.0), Grille(emprise, 5.0)
lignes = [g if g.geom_type == "LineString" else shapely.line_merge(g) for g in t.geometry]
IDX, XS, YS = points_troncons(lignes)
n = len(t)

# ------------------------------------------------------------ 1. ombrage végétal (houppiers, raster 2 m)
print("1. Canopée des arbres d'alignement sur l'emprise de rue")
arbres = couche("veg_arbres_alignement")
houpp = G2.raster(arbres.buffer(arbres["rayon_houppier_m"], resolution=8), np.ones(len(arbres)), fond=0, dtype="uint8")
ordre = np.argsort(-rue.area.to_numpy())            # les petites emprises sont dessinées en dernier
ids = G2.raster(rue.iloc[ordre], ordre + 1, fond=0, dtype="int32")
tot = np.bincount(ids.ravel(), minlength=n + 1)[1:]
cov = np.bincount(ids.ravel(), weights=houpp.ravel(), minlength=n + 1)[1:]
repli = moyenne_le_long(G2, houpp.astype("float32"), IDX, XS, YS, n)   # emprises recouvertes : axe du tronçon
t["canopee_rue"] = np.where(tot > 20, cov / np.maximum(tot, 1), repli).clip(0, 1).round(3)
del ids, houpp

# ------------------------------------------------------------ 2. morphologie du canyon (H/L, facteur de vue du ciel)
print("2. Rapport hauteur/largeur des rues")
bande = t[["id_troncon"]].copy()
bande["geometry"] = t.buffer(t["largeur_rue_m"] / 2 + 12, cap_style="flat")
bande = gpd.GeoDataFrame(bande, crs=CRS)
bat = couche("bat_batiments")
bat["a"] = bat.area
sj = gpd.sjoin(bat[["hauteur", "a", "geometry"]], bande, predicate="intersects")
h = sj.assign(ha=sj["hauteur"] * sj["a"]).groupby("id_troncon")[["ha", "a"]].sum()
t["hauteur_bati_m"] = t["id_troncon"].map(h["ha"] / h["a"]).fillna(0).round(1)
t["rapport_h_l"] = (t["hauteur_bati_m"] / t["largeur_rue_m"]).round(2)
t["svf"] = np.cos(np.arctan(2 * t["rapport_h_l"])).round(3)  # vue du ciel au centre d'un canyon symétrique (Oke)
t["insolation"] = ((1 - t["canopee_rue"]) * (0.4 + 0.6 * t["svf"])).round(3)

# ------------------------------------------------------------ 3. exposition et vulnérabilité ICU (raster 5 m, voisinage 25 m)
print("3. Îlots de chaleur urbains")
icu = couche("clim_icu_metropole")
foc = {}
ids_icu = G5.index(icu.geometry)
for c in ["s_expo_jour", "s_expo_nuit", "s_vulnerabilite_jour", "s_vulnerabilite_nuit"]:
    foc[c] = moyenne_le_long(G5, G5.focal(G5.projeter(ids_icu, icu[c]), 25), IDX, XS, YS, n)
t["expo_jour"] = np.round(foc["s_expo_jour"], 3)
t["expo_nuit"] = np.round(foc["s_expo_nuit"], 3)
t["vuln_icu"] = np.round((foc["s_vulnerabilite_jour"] + foc["s_vulnerabilite_nuit"]) / 2, 3)

# ------------------------------------------------------------ 4. LCZ Cerema : potentiel de chaleur, imperméabilisation (voisinage 100 m)
print("4. Zones climatiques locales (voisinage 100 m)")
CHALEUR_LCZ = {"1": 1.0, "2": 1.0, "3": 0.9, "4": 0.6, "5": 0.55, "6": 0.45, "7": 0.7, "8": 0.8, "9": 0.3, "10": 0.9,
               "101": 0.0, "102": 0.15, "103": 0.2, "104": 0.25, "105": 0.8, "106": 0.4, "107": 0.0,
               "A": 0.0, "B": 0.15, "C": 0.2, "D": 0.25, "E": 0.8, "F": 0.4, "G": 0.0}
lcz = couche("clim_lcz_cerema")
lcz["lcz"] = lcz["lcz"].astype(str).str.replace(".0", "", regex=False)
lcz["chaleur_lcz"] = lcz["lcz"].map(CHALEUR_LCZ)
lcz["impermeable"] = (lcz["bur"] + lcz["ror"]).clip(0, 100) / 100
lcz["vegetal"] = lcz["ver"].clip(0, 100) / 100
ids_lcz = G5.index(lcz.geometry)
for c, sortie in (("chaleur_lcz", "chaleur_lcz"), ("impermeable", "impermeabilisation"), ("vegetal", "vegetal_100m")):
    t[sortie] = np.round(moyenne_le_long(G5, G5.focal(G5.projeter(ids_lcz, lcz[c]), 100), IDX, XS, YS, n), 3)
t["lcz_dominante"] = gpd.sjoin(gpd.GeoDataFrame(t[["id_troncon"]], geometry=t.geometry.centroid, crs=CRS),
                               lcz[["lcz", "geometry"]], how="left").drop_duplicates("id_troncon")["lcz"].values

# ------------------------------------------------------------ 5. population (Filosofi 200 m, voisinage 100 m)
print("5. Population et précarité")
g = couche("ref_grille200")
g["dens_sensible"] = g["pop_sensible"] / 4  # hab/ha
foc = {}
ids_g = G5.index(g.geometry)
for c in ["densite_hab_ha", "dens_sensible", "men", "men_pauv", "ind", "ind_snv"]:
    foc[c] = moyenne_le_long(G5, G5.focal(G5.projeter(ids_g, g[c].astype(float)), 100), IDX, XS, YS, n)
t["densite_hab_ha"] = np.round(np.nan_to_num(foc["densite_hab_ha"]), 1)
t["dens_sensible_ha"] = np.round(np.nan_to_num(foc["dens_sensible"]), 1)
t["taux_pauvrete"] = np.round(np.where(foc["men"] > 0.5, foc["men_pauv"] / foc["men"], np.nan), 3)
t["niveau_vie_eur"] = np.round(np.where(foc["ind"] > 1, foc["ind_snv"] / foc["ind"], np.nan), 0)

# ------------------------------------------------------------ 6. établissements sensibles
print("6. Établissements sensibles")
eq = couche("eq_sensibles")
d = gpd.sjoin_nearest(t[["id_troncon", "geometry"]], eq[["type_sensible", "geometry"]], distance_col="d").drop_duplicates("id_troncon")
t["dist_etab_sensible_m"] = t["id_troncon"].map(d.set_index("id_troncon")["d"]).round(0)
t["etab_sensible_type"] = t["id_troncon"].map(d.set_index("id_troncon")["type_sensible"])

# ------------------------------------------------------------ 7. inondation, usages
print("7. Inondation et usages")
for sc in ("moyen", "extreme"):
    z = couche(f"risq_inondation_{sc}").explode(index_parts=False)
    dedans = gpd.sjoin(t[["id_troncon", "geometry"]], z[["geometry"]], predicate="intersects")["id_troncon"]
    t[f"inond_{sc}"] = t["id_troncon"].isin(dedans).astype(int)
cy = couche("mob_cyclable").explode(index_parts=False)
proche = gpd.sjoin(gpd.GeoDataFrame(t[["id_troncon"]], geometry=t.buffer(10), crs=CRS), cy[["geometry"]], predicate="intersects")
t["cyclable"] = t["id_troncon"].isin(proche["id_troncon"]).astype(int)
ar = couche("mob_arrets_tc")
n150 = gpd.sjoin(ar[["geometry"]], gpd.GeoDataFrame(t[["id_troncon"]], geometry=t.buffer(150), crs=CRS)).groupby("id_troncon").size()
t["arrets_tc_150m"] = t["id_troncon"].map(n150).fillna(0).astype(int)
ZCA = {"Aire Piétonne": 1.0, "Zone de rencontre": 0.9, "Zone 30": 0.6, "Aucune": 0.2}

# ------------------------------------------------------------ indicateurs normalisés [0-1]
print("Normalisation et besoins par enjeu")
t["n_trafic"] = norm(np.log1p(t["tmjo_veh_j"]), champ)
t["n_insolation"] = t["insolation"]
t["n_dens_sensible"] = norm(t["dens_sensible_ha"], champ)
t["n_precarite"] = (0.5 * norm(t["taux_pauvrete"], champ) + 0.5 * norm(t["niveau_vie_eur"], champ, inverse=True)).round(3)
t["n_etab_sensible"] = np.clip((300 - t["dist_etab_sensible_m"]) / 250, 0, 1).round(3)
t["n_impermeabilisation"] = norm(t["impermeabilisation"], champ)
t["n_zone_apaisee"] = t["zone_apaisee"].map(ZCA).fillna(0.2)
t["n_arrets_tc"] = norm(t["arrets_tc_150m"], champ)
t["n_densite"] = norm(t["densite_hab_ha"], champ)
t["n_surface"] = norm(np.log(t["surface_chaussee_m2"].clip(lower=20)), champ)

besoin_chaleur = 0.45 * t["expo_jour"] + 0.25 * t["expo_nuit"] + 0.30 * t["chaleur_lcz"]
t["besoin_chaleur"] = besoin_chaleur.fillna(besoin_chaleur.median()).round(3)
t["vulnerabilite"] = (0.35 * t["n_dens_sensible"] + 0.25 * t["n_precarite"] + 0.20 * t["n_etab_sensible"]
                      + 0.20 * t["vuln_icu"].fillna(t["vuln_icu"].median())).round(3)
t["usages"] = (0.30 * t["n_zone_apaisee"] + 0.15 * t["cyclable"] + 0.20 * t["n_arrets_tc"] + 0.35 * t["n_densite"]).round(3)

N = np.column_stack([
    norm(t["besoin_chaleur"] * (0.3 + 0.7 * t["insolation"]), champ),                                    # chaleur
    norm(t["vulnerabilite"] * (0.3 + 0.7 * t["insolation"]) * (0.5 + 0.5 * t["besoin_chaleur"]), champ),  # santé
    t["n_impermeabilisation"],                                                                             # eau
    0.6 + 0.4 * t["n_surface"],                                                                            # carbone
    norm(t["usages"], champ),                                                                              # usages
])
for j, e in enumerate(MAT.ENJEUX):
    t[f"N_{e}"] = N[:, j].round(3)

# ------------------------------------------------------------ matrice matériau-territoire
print("Matrice matériau-territoire")
params = MAT.tirer()
P = MAT.indices_performance(params)
C = MAT.compatibilite(t, params)
for i, mcode in enumerate(MAT.CODES):
    t[f"C_{mcode}"] = C[:, i].round(3)
    # Aptitude propre au matériau : enjeux à poids égaux, rapportée au maximum atteignable par ce matériau
    b = C[:, i] * (N * P[i]).mean(axis=1)
    t[f"apt_{mcode}"] = (b / max(P[i].mean(), 1e-9)).round(3)

t.to_file(SORTIE, layer="indicateurs_troncons", driver="GPKG")
t.drop(columns="geometry").to_csv(IND / "indicateurs_troncons.csv", index=False, encoding="utf-8-sig", sep=";")

# Agrégation 200 m (moyennes pondérées par la surface de chaussée)
print("Agrégation sur la grille 200 m")
cent = gpd.GeoDataFrame(t[champ].drop(columns="geometry"), geometry=t[champ].geometry.centroid, crs=CRS)
gr = g[g["dans_territoire"] == 1][["idcar_200m", "pop", "densite_hab_ha", "pop_sensible", "taux_pauvrete_men", "niveau_vie_moy", "geometry"]]
sj = gpd.sjoin(cent, gr[["idcar_200m", "geometry"]], predicate="within")
cols = ["besoin_chaleur", "insolation", "vulnerabilite", "n_impermeabilisation", "usages", "canopee_rue", "rapport_h_l"] + \
       [f"apt_{c}" for c in MAT.CODES] + [f"N_{e}" for e in MAT.ENJEUX]
w = sj["surface_chaussee_m2"]
agg = sj[cols].mul(w, axis=0).groupby(sj["idcar_200m"]).sum().div(w.groupby(sj["idcar_200m"]).sum(), axis=0).round(3)
agg["surface_chaussee_m2"] = w.groupby(sj["idcar_200m"]).sum().round(0)
agg["nb_troncons"] = sj.groupby("idcar_200m").size()
gr = gr.merge(agg, left_on="idcar_200m", right_index=True, how="left")
gr.to_file(SORTIE, layer="indicateurs_grille200", driver="GPKG")

# ------------------------------------------------------------ livrables tabulaires
props = []
for i, mcode in enumerate(MAT.CODES):
    d = MAT.MATERIAUX[mcode]
    props.append({"code": mcode, "revetement": d["nom"],
                  "albedo (bas/central/haut)": "/".join(map(str, d["albedo"])),
                  "réduction GES par tonne vs référence": "/".join(f"{v:.0%}" for v in d["reduction_ges"]),
                  "durée de vie (ans)": "/".join(map(str, d["duree_vie"])),
                  "perméable": "oui" if d["permeabilite"] else "non",
                  "indice thermique τ": round(P[i, 0], 2), "indice hydrologique π": round(P[i, 2], 2),
                  "indice carbone γ (annualisé)": round(P[i, 3], 2), "indice cadre de vie": round(P[i, 4], 2),
                  "logique d'usage": d["logique"]})
pd.DataFrame(props).to_csv(IND / "proprietes_materiaux.csv", index=False, encoding="utf-8-sig", sep=";")

REL = [
    ("Trafic poids lourds (classe T0-T5)", "Contrainte mécanique", lambda d: " / ".join(f"{k}:{v:g}" for k, v in d["trafic"].items() if k != "TS")),
    ("Ligne de bus", "Contrainte mécanique (freinage, canalisation)", lambda d: f"x {d['bus']:g}"),
    ("Vitesse ≥ 50 km/h", "Contrainte sécurité (contraste du marquage)", lambda d: f"x {d['vitesse50']:g}"),
    ("Pente", "Contrainte hydraulique", lambda d: f"1 si ≤ {d['pente'][0]:g} %, 0 à {d['pente'][1]:g} %" if d["pente"] else "—"),
    ("Zone inondable (moyen / extrême)", "Contrainte hydrologique (nappe, colmatage)", lambda d: "x {:g} / x {:g}".format(*d["inondation"]) if d["inondation"] != (1.0, 1.0) else "—"),
    ("Trafic tous véhicules", "Durabilité (encrassement, colmatage)", lambda d: f"x (1 − {d['encrassement']:g} · trafic norm.)" if d["encrassement"] else "—"),
    ("Petite surface (< 300 m²)", "Logistique de chantier", lambda d: f"x {d['petite_surface']:g}" if d["petite_surface"] < 1 else "—"),
    ("Besoin chaleur x insolation", "Bénéfice thermique", lambda d: "τ · N_chaleur"),
    ("Vulnérabilité x insolation x chaleur", "Bénéfice sanitaire", lambda d: "τ · N_santé"),
    ("Imperméabilisation du voisinage", "Bénéfice hydrologique", lambda d: "π · N_eau"),
    ("Surface de chantier", "Bénéfice carbone", lambda d: "γ · (0,6 + 0,4 · surface norm.)"),
    ("Usages piétons, densité, apaisement", "Bénéfice cadre de vie", lambda d: "(τ + bruit)/2 · N_usages"),
]
mat = pd.DataFrame([{"critère territorial": c, "nature de la relation": r, **{m_: f(MAT.MATERIAUX[m_]) for m_ in MAT.CODES}}
                    for c, r, f in REL])
mat.to_csv(IND / "matrice_materiau_territoire.csv", index=False, encoding="utf-8-sig", sep=";")
with open(IND / "matrice.json", "w", encoding="utf-8") as f:
    json.dump({"P": P.round(3).tolist(), "enjeux": MAT.ENJEUX, "materiaux": MAT.CODES,
               "relations": mat.to_dict(orient="records")}, f, ensure_ascii=False, indent=1)

stats = t.loc[champ, ["canopee_rue", "rapport_h_l", "insolation", "expo_jour", "expo_nuit", "chaleur_lcz", "impermeabilisation",
                      "densite_hab_ha", "dens_sensible_ha", "taux_pauvrete", "niveau_vie_eur", "dist_etab_sensible_m",
                      "besoin_chaleur", "vulnerabilite", "usages"] + [f"N_{e}" for e in MAT.ENJEUX] +
              [f"C_{c}" for c in MAT.CODES] + [f"apt_{c}" for c in MAT.CODES]].describe().T.round(3)
stats.to_csv(IND / "statistiques_indicateurs.csv", sep=";", encoding="utf-8-sig")
print(stats[["mean", "min", "50%", "max"]].to_string())
print("Indice de performance P (matériaux x enjeux):\n", pd.DataFrame(P, index=MAT.CODES, columns=MAT.ENJEUX).round(2))
