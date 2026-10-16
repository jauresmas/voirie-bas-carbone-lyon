"""Export des résultats pour la carte web (fichiers .js chargés par <script>, compatibles file://)."""
import json

import geopandas as gpd
import numpy as np
import pandas as pd

import materiaux as MAT
from config import AMC, CATALOGUE, CRS, CRS_WEB, DATA, GPKG, IND, PROSP, WEB

OUT = WEB / "data"
OUT.mkdir(parents=True, exist_ok=True)
PROFILS = ["equilibre", "adaptation", "bas_carbone", "eau_sols", "justice"]
SCEN = ["S0", "S1", "S2", "S3"]
ROB = {"Hors champ": 0, "Rarement prioritaire": 1, "Prioritaire incertain": 2, "Prioritaire probable": 3, "Prioritaire robuste": 4}


def r(x, n=3):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


def coords(g, nd=5):
    if g.geom_type == "LineString":
        return [[round(x, nd), round(y, nd)] for x, y in g.coords]
    if g.geom_type == "MultiLineString":
        return [[[round(x, nd), round(y, nd)] for x, y in p.coords] for p in g.geoms]
    raise ValueError(g.geom_type)


def poly_geojson(gdf, tol, props):
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.simplify(tol)
    gdf = gdf[~gdf.geometry.is_empty].to_crs(CRS_WEB)
    js = json.loads(gdf[props + ["geometry"]].to_json(drop_id=True))
    def rnd(c):
        return [rnd(v) for v in c] if isinstance(c[0], list) else [round(c[0], 5), round(c[1], 5)]
    for f in js["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
    return js


def ecrire_js(nom, var, obj):
    txt = f"window.{var} = " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (OUT / f"{nom}.js").write_text(txt, encoding="utf-8")
    print(f"  {nom}.js  {len(txt) / 1e6:.2f} Mo")


print("Tronçons")
t = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_troncons")
res = pd.read_csv(AMC / "resultats_amc_troncons.csv", sep=";", encoding="utf-8-sig")
etat = pd.read_csv(PROSP / "etat_troncons_scenarios.csv", sep=";", encoding="utf-8-sig").fillna("")
t = t.merge(res.drop(columns=[c for c in res.columns if c in t.columns and c != "id_troncon"]), on="id_troncon").merge(etat, on="id_troncon")
geo = t.geometry.simplify(0.6).to_crs(CRS_WEB)
feats = []
for i, (row, g) in enumerate(zip(t.itertuples(index=False), geo)):
    p = {
        "i": i, "id": row.id_troncon, "n": row.nom_voie, "a": row.arrondissement, "h": row.hierarchie,
        "pl": row.classe_pl, "pls": int(row.classe_pl_source == "imputée"), "sf": int(round(row.surface_chaussee_m2)),
        "lg": int(round(row.longueur_m)), "pe": r(row.pente_pct, 1), "v": None if pd.isna(row.vitesse_kmh) else int(row.vitesse_kmh),
        "z": row.zone_apaisee, "b": row.ligne_bus, "rv": row.revetement, "ch": int(row.dans_le_champ), "dom": row.domanialite,
        "tm": int(row.tmjo_veh_j), "tms": int(row.tmjo_source == "comptage"),
        "ss": int(row.surface_source == "relevé Métropole"), "ps": int(row.pente_source == "relevé Métropole"),
        "can": r(row.canopee_rue), "hl": r(row.rapport_h_l, 2), "ins": r(row.insolation), "ej": r(row.expo_jour), "en": r(row.expo_nuit),
        "lcz": r(row.chaleur_lcz), "imp": r(row.impermeabilisation), "dh": r(row.densite_hab_ha, 0), "ds": r(row.dens_sensible_ha, 0),
        "pv": r(row.taux_pauvrete), "nv": r(row.niveau_vie_eur, -2), "de": r(row.dist_etab_sensible_m, 0), "et": row.etab_sensible_type,
        "inm": int(row.inond_moyen), "ine": int(row.inond_extreme), "cy": int(row.cyclable), "tc": int(row.arrets_tc_150m),
        "bc": r(row.besoin_chaleur), "vu": r(row.vulnerabilite), "us": r(row.usages),
        "N": [r(getattr(row, f"N_{e}")) for e in MAT.ENJEUX],
        "C": [r(getattr(row, f"C_{m}")) for m in MAT.CODES],
        "A": [r(getattr(row, f"apt_{m}")) for m in MAT.CODES],
        "S": [r(getattr(row, f"score_{k}"), 4) for k in PROFILS],
        "K": [int(getattr(row, f"classe_{k}")) for k in PROFILS],
        "M": [getattr(row, f"mat_{k}") for k in PROFILS],
        "p20": r(row.p_top20), "pp": r(row.p_top20_preferences), "pm": r(row.p_top20_materiaux),
        "rb": ROB[row.robustesse], "st": r(row.stabilite_materiau), "cs": int(row.consensus_top20),
        "q5": r(row.rang_pct_q05), "q95": r(row.rang_pct_q95), "mm": row.mat_modal_mc,
        "PA": [int(getattr(row, f"an_{s}")) for s in SCEN], "PM": [getattr(row, f"mat_{s}") or "" for s in SCEN],
        "S50": [r(getattr(row, f"score2050_{s}"), 4) for s in SCEN],
    }
    feats.append({"type": "Feature", "geometry": {"type": g.geom_type, "coordinates": coords(g)}, "properties": p})
ecrire_js("troncons", "DG_TRONCONS", {"type": "FeatureCollection", "features": feats})

print("Grille 200 m")
g = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_grille200")
cent = gpd.GeoDataFrame(t[t["dans_le_champ"] == 1].drop(columns="geometry"), geometry=t[t["dans_le_champ"] == 1].geometry.centroid, crs=CRS)
sj = gpd.sjoin(cent, g[["idcar_200m", "geometry"]], predicate="within")
w = sj["surface_chaussee_m2"]
for k in PROFILS:
    g[f"S_{k}"] = g["idcar_200m"].map((sj[f"score_{k}"] * w).groupby(sj["idcar_200m"]).sum() / w.groupby(sj["idcar_200m"]).sum())
    dom = sj.groupby(["idcar_200m", f"mat_{k}"])["surface_chaussee_m2"].sum().reset_index().sort_values("surface_chaussee_m2").drop_duplicates("idcar_200m", keep="last")
    g[f"M_{k}"] = g["idcar_200m"].map(dom.set_index("idcar_200m")[f"mat_{k}"])
g["P20"] = g["idcar_200m"].map((sj["p_top20"] * w).groupby(sj["idcar_200m"]).sum() / w.groupby(sj["idcar_200m"]).sum())
gg = g.to_crs(CRS_WEB)
cells = []
for row, geom in zip(g.itertuples(index=False), gg.geometry):
    ring = [[round(x, 5), round(y, 5)] for x, y in geom.exterior.coords]
    cells.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": {
        "id": row.idcar_200m, "pop": r(row.pop, 0), "dh": r(row.densite_hab_ha, 0), "psn": r(row.pop_sensible, 0),
        "pv": r(row.taux_pauvrete_men), "nv": r(row.niveau_vie_moy, -2), "sf": r(row.surface_chaussee_m2, 0),
        "bc": r(row.besoin_chaleur), "ins": r(row.insolation), "vu": r(row.vulnerabilite), "imp": r(row.n_impermeabilisation),
        "us": r(row.usages), "A": [r(getattr(row, f"apt_{m}")) for m in MAT.CODES],
        "S": [r(getattr(row, f"S_{k}"), 4) for k in PROFILS], "M": [getattr(row, f"M_{k}") if isinstance(getattr(row, f"M_{k}"), str) else "" for k in PROFILS],
        "p20": r(row.P20)}})
ecrire_js("grille", "DG_GRILLE", {"type": "FeatureCollection", "features": cells})

print("Couches de contexte")
ctx = {}
arr = gpd.read_file(GPKG, layer="ref_arrondissements")
arr["label"] = arr["nom"].str.replace("Lyon ", "", regex=False)
ctx["arrondissements"] = poly_geojson(arr, 4, ["insee", "nom", "label"])
lab = arr.copy()
lab["geometry"] = arr.representative_point()
ctx["arrondissements_labels"] = json.loads(lab.to_crs(CRS_WEB)[["label", "geometry"]].to_json(drop_id=True))
ctx["territoire"] = poly_geojson(gpd.read_file(GPKG, layer="ref_territoire"), 4, ["nom"])
eau = gpd.read_file(GPKG, layer="hyd_surfaces_eau")
ctx["eau"] = poly_geojson(eau[eau.area > 2000].dissolve(), 2, [])
icu = gpd.read_file(GPKG, layer="clim_icu_metropole")
terr = gpd.read_file(GPKG, layer="ref_territoire").union_all().buffer(300)
icu = icu[icu.intersects(terr)].dissolve(by="expo_jour", as_index=False)
ctx["icu_jour"] = poly_geojson(icu, 3, ["expo_jour"])
inond = gpd.read_file(GPKG, layer="risq_inondation_moyen")
ctx["inondation"] = poly_geojson(inond.dissolve(), 3, [])
eq = gpd.read_file(GPKG, layer="eq_sensibles")
eq["geometry"] = eq.representative_point()
ctx["etablissements"] = json.loads(eq.to_crs(CRS_WEB)[["toponyme", "type_sensible", "geometry"]].to_json(drop_id=True))
tram = gpd.read_file(GPKG, layer="mob_lignes_tram")
tram = tram.dissolve(by="ligne", as_index=False)
ctx["tram"] = json.loads(tram.assign(geometry=tram.simplify(2)).to_crs(CRS_WEB)[["ligne", "couleur_hex", "geometry"]].to_json(drop_id=True))
ar_ = gpd.read_file(GPKG, layer="veg_arbres_alignement").to_crs(CRS_WEB)
ctx["arbres"] = [[round(p.x, 5), round(p.y, 5), round(float(rr), 1)] for p, rr in zip(ar_.geometry, ar_["rayon_houppier_m"])]
for k, v in ctx.items():
    if isinstance(v, dict):
        for f in v["features"]:
            gtype = f["geometry"]["type"]
            if gtype == "Point":
                f["geometry"]["coordinates"] = [round(c, 5) for c in f["geometry"]["coordinates"]]
            elif gtype in ("LineString", "MultiLineString"):
                def rnd(c):
                    return [rnd(v_) for v_ in c] if isinstance(c[0], list) else [round(c[0], 5), round(c[1], 5)]
                f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
ecrire_js("contexte", "DG_CONTEXTE", ctx)

print("Méta-données, statistiques et graphiques")
amc = json.load(open(AMC / "amc_parametres.json", encoding="utf-8"))
scen = json.load(open(PROSP / "scenarios.json", encoding="utf-8"))
traj = pd.read_csv(PROSP / "trajectoires_scenarios.csv", sep=";", encoding="utf-8-sig")
ahp = pd.read_csv(AMC / "ahp_poids_profils.csv", sep=";", encoding="utf-8-sig")
sens = pd.read_csv(AMC / "sensibilite_un_a_un.csv", sep=";", encoding="utf-8-sig")
sensm = pd.read_csv(AMC / "sensibilite_parametres_materiaux.csv", sep=";", encoding="utf-8-sig")
synth = pd.read_csv(AMC / "synthese_classes_profils.csv", sep=";", encoding="utf-8-sig")
cat = pd.read_csv(CATALOGUE, sep=";", encoding="utf-8-sig")
props = pd.read_csv(IND / "proprietes_materiaux.csv", sep=";", encoding="utf-8-sig")
matrice = pd.read_csv(IND / "matrice_materiau_territoire.csv", sep=";", encoding="utf-8-sig")
champ = t["dans_le_champ"] == 1

# Postes du parcours guidé : rues réelles choisies par règle dans les résultats
DEJA = set()


def poste(masque, tri, asc=False):
    """Premier tronçon (> 60 m) satisfaisant la règle, en évitant les rues déjà retenues."""
    c = t[masque & champ].sort_values(tri, ascending=asc)
    c = c[(c["longueur_m"] > 60) & ~c["nom_voie"].isin(DEJA)]
    if not len(c):
        return None
    DEJA.add(c.iloc[0]["nom_voie"])
    return int(c.index[0])

postes = {
    "chaleur": poste((t["mat_equilibre"] == "R2") & (t["robustesse"] == "Prioritaire robuste"), "score_equilibre"),
    "eau": poste((t["mat_eau_sols"] == "R3") & (t["classe_eau_sols"] == 1), "N_eau"),
    "carbone": poste((t["mat_bas_carbone"] == "R4") & (t["classe_bas_carbone"] == 1) & (t["classe_adaptation"] >= 3), "surface_chaussee_m2"),
    "pente": poste((t["pente_pct"] >= 8) & (t["N_eau"] > 0.6), "pente_pct"),
    "inondation": poste((t["inond_moyen"] == 1) & (t["N_eau"] > 0.5), "N_eau"),
    "incertain": poste((t["p_top20"].between(0.4, 0.6)), "surface_chaussee_m2"),
    "anticipation": poste((t["an_S1"].between(2027, 2029)) & (t["mat_S1"] == "R2"), "score_adaptation"),
}
meta = {
    "materiaux": {m: {"nom": MAT.MATERIAUX[m]["nom"], "court": MAT.MATERIAUX[m]["court"], "logique": MAT.MATERIAUX[m]["logique"],
                      "albedo": MAT.MATERIAUX[m]["albedo"], "reduction_ges": MAT.MATERIAUX[m]["reduction_ges"],
                      "duree_vie": MAT.MATERIAUX[m]["duree_vie"], "trafic": MAT.MATERIAUX[m]["trafic"]} for m in MAT.CODES},
    "codes": MAT.CODES, "enjeux": MAT.ENJEUX, "lib_enjeux": MAT.LIB_ENJEUX,
    "P": amc["P"], "profils": [{"id": k, **amc["profils"][k]} for k in PROFILS],
    "ahp": ahp.to_dict(orient="records"),
    "spearman": amc["spearman"], "recouvrement": amc["recouvrement_top20"],
    "sensibilite": sens.to_dict(orient="records"), "sensibilite_materiaux": sensm.to_dict(orient="records"),
    "synthese_classes": synth.to_dict(orient="records"),
    "scenarios": {k: {kk: vv for kk, vv in v.items()} for k, v in scen["scenarios"].items()},
    "tracc": scen["tracc"], "hypotheses_prospective": scen["hypotheses"],
    "trajectoires": traj.to_dict(orient="records"),
    "catalogue": cat[["id_couche", "theme", "intitule", "producteur", "millesime", "nb_objets", "usage_projet"]].fillna("").to_dict(orient="records"),
    "proprietes": props.to_dict(orient="records"), "matrice": matrice.to_dict(orient="records"),
    "postes": {k: (None if v is None else {"i": v, "nom": t.loc[v, "nom_voie"], "arr": t.loc[v, "arrondissement"]}) for k, v in postes.items()},
    "chiffres": {
        "troncons": int(len(t)), "troncons_champ": int(champ.sum()), "km": round(t.length.sum() / 1000),
        "surface_km2": round(t["surface_chaussee_m2"].sum() / 1e6, 2), "surface_champ_km2": round(t.loc[champ, "surface_chaussee_m2"].sum() / 1e6, 2),
        "arbres": len(ar_), "batiments": int(gpd.read_file(GPKG, layer="bat_batiments", columns=["cleabs"], ignore_geometry=True).shape[0]),
        "couches": int(len(cat)), "pl_imputee": round(float((t["classe_pl_source"] == "imputée").mean()), 3),
        "robuste": int((t["robustesse"] == "Prioritaire robuste").sum()),
        "robuste_ha": round(t.loc[t["robustesse"] == "Prioritaire robuste", "surface_chaussee_m2"].sum() / 1e4, 1),
        "probable": int((t["robustesse"] == "Prioritaire probable").sum()),
        "incertain": int((t["robustesse"] == "Prioritaire incertain").sum()),
        "population": int(gpd.read_file(GPKG, layer="ref_grille200").query("dans_territoire == 1")["pop"].sum()),
    },
    "bornes": {"lon": list(map(float, t.to_crs(CRS_WEB).total_bounds[[0, 2]])), "lat": list(map(float, t.to_crs(CRS_WEB).total_bounds[[1, 3]]))},
}
ecrire_js("meta", "DG_META", meta)
print("Postes :", {k: (v and meta["postes"][k]["nom"]) for k, v in postes.items()})
