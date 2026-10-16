"""Export des données pour la version grand public (grand-public/data/*.js, compatibles file://)."""
import json

import geopandas as gpd
import numpy as np
import pandas as pd

import materiaux as MAT
from config import AMC, CRS, CRS_WEB, GPKG, IND, PROSP, ROOT

OUT = ROOT / "grand-public" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def r(x, n=2):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


def ecrire_js(nom, var, obj):
    txt = f"window.{var} = " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (OUT / f"{nom}.js").write_text(txt, encoding="utf-8")
    print(f"  {nom}.js  {len(txt) / 1e6:.2f} Mo")


t = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_troncons")
res = pd.read_csv(AMC / "resultats_amc_troncons.csv", sep=";", encoding="utf-8-sig")
etat = pd.read_csv(PROSP / "etat_troncons_scenarios.csv", sep=";", encoding="utf-8-sig").fillna("")
t = t.merge(res.drop(columns=[c for c in res.columns if c in t.columns and c != "id_troncon"]), on="id_troncon").merge(etat, on="id_troncon")
champ = t["dans_le_champ"] == 1
ROB = {"Hors champ": 0, "Rarement prioritaire": 1, "Prioritaire incertain": 2, "Prioritaire probable": 3, "Prioritaire robuste": 4}
t["rb"] = t["robustesse"].map(ROB)

print("Rues")
geo = t.geometry.simplify(0.8).to_crs(CRS_WEB)
feats = []
for i, (row, g) in enumerate(zip(t.itertuples(index=False), geo)):
    co = [[round(x, 5), round(y, 5)] for x, y in (g.coords if g.geom_type == "LineString" else [c for p in g.geoms for c in p.coords])]
    feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": co}, "properties": {
        "i": i, "ch": int(row.dans_le_champ), "nc": r(row.N_chaleur), "k": int(row.classe_equilibre),
        "m": row.mat_equilibre if row.mat_equilibre in MAT.CODES else "", "rb": int(row.rb), "mm": row.mat_modal_mc if row.mat_modal_mc in MAT.CODES else "",
        "y": [int(getattr(row, f"an_{s}")) for s in ("S1", "S2", "S3")], "ym": [getattr(row, f"mat_{s}") or "" for s in ("S1", "S2", "S3")],
        "N": [r(getattr(row, f"N_{e}")) for e in MAT.ENJEUX], "C": [r(getattr(row, f"C_{m}")) for m in MAT.CODES],
    }})
ecrire_js("rues", "GP_RUES", {"type": "FeatureCollection", "features": feats})

# Index des rues : une entrée par voie et arrondissement
print("Index des rues")
t["cx"] = geo.apply(lambda g: g.interpolate(0.5, normalized=True).x)
t["cy"] = geo.apply(lambda g: g.interpolate(0.5, normalized=True).y)
rues = []
for (nom, arr), d in t.groupby(["nom_voie", "arrondissement"]):
    dc = d[d["dans_le_champ"] == 1]
    w = dc["surface_chaussee_m2"]
    item = {"n": nom, "a": arr, "s": [int(x) for x in d.index], "sf": int(d["surface_chaussee_m2"].sum()),
            "c": [round(float(d.loc[d["surface_chaussee_m2"].idxmax(), "cx"]), 5), round(float(d.loc[d["surface_chaussee_m2"].idxmax(), "cy"]), 5)],
            "ch": int(len(dc) > 0)}
    if len(dc):
        avg = lambda col: r(np.average(dc[col].fillna(dc[col].median() if dc[col].notna().any() else 0), weights=w))
        mats = dc[dc["classe_equilibre"] > 0].groupby("mat_equilibre")["surface_chaussee_m2"].sum()
        item.update({
            "m": mats.idxmax() if len(mats) else "", "k": int(dc.loc[dc["classe_equilibre"] > 0, "classe_equilibre"].min()) if (dc["classe_equilibre"] > 0).any() else 0,
            "rb": int(dc["rb"].max()), "p": r(dc["p_top20"].max()),
            "nc": avg("N_chaleur"), "ins": avg("insolation"), "can": avg("canopee_rue"), "ds": r(np.average(dc["dens_sensible_ha"], weights=w), 0),
            "imp": avg("impermeabilisation"), "pe": r(np.average(dc["pente_pct"], weights=w), 1), "pl": dc["classe_pl"].min(),
            "bus": int((dc["ligne_bus"] != "Aucune").any()), "inond": int(dc["inond_moyen"].max()), "zca": dc["zone_apaisee"].mode().iloc[0],
            "y": [int(dc[f"an_{s}"].replace(0, 9999).min()) if (dc[f"an_{s}"] > 0).any() else 0 for s in ("S1", "S2", "S3")],
        })
    else:
        item["hors"] = "voie privée" if (d["domanialite"] == "Privé").all() else "revêtement pavé ou dallé"
    rues.append(item)
ecrire_js("index_rues", "GP_INDEX", rues)

print("Chiffres et trajectoires")
traj = pd.read_csv(PROSP / "trajectoires_scenarios.csv", sep=";", encoding="utf-8-sig")
amc = json.load(open(AMC / "amc_parametres.json", encoding="utf-8"))
ha = lambda m: round(float(t.loc[champ & m, "surface_chaussee_m2"].sum() / 1e4), 1)
# Exemple « rue chaude / rue ombragée » : deux rues longues et proches
chaud = t[champ & (t["canopee_rue"] == 0) & (t["insolation"] > 0.85) & (t["longueur_m"] > 90)].sort_values("N_chaleur", ascending=False).iloc[0]
cand = t[champ & (t["canopee_rue"] > 0.55) & (t["longueur_m"] > 90)].copy()
cand["d"] = cand.geometry.distance(chaud.geometry)
frais = cand.sort_values("d").iloc[0]
meta = {
    "P": amc["P"], "enjeux": MAT.ENJEUX,
    "chiffres": {
        "troncons": int(len(t)), "km": round(float(t.length.sum() / 1000)), "surface_ha": round(float(t.loc[champ, "surface_chaussee_m2"].sum() / 1e4)),
        "chaud_part": round(float(t.loc[champ & (t["N_chaleur"] > 0.7), "surface_chaussee_m2"].sum() / t.loc[champ, "surface_chaussee_m2"].sum()), 3),
        "robuste_n": int((t["rb"] == 4).sum()), "robuste_ha": ha(t["rb"] == 4), "probable_ha": ha(t["rb"] == 3),
        "robuste_mat": t.loc[t["rb"] == 4].groupby("mat_modal_mc")["surface_chaussee_m2"].sum().div(t.loc[t["rb"] == 4, "surface_chaussee_m2"].sum()).round(3).to_dict(),
        "arbres": int(gpd.read_file(GPKG, layer="veg_arbres_alignement", ignore_geometry=True).shape[0]),
    },
    "exemples": {k: {"i": int(row.name), "n": row.nom_voie, "a": row.arrondissement, "ins": r(row.insolation), "can": r(row.canopee_rue), "nc": r(row.N_chaleur), "hl": r(row.rapport_h_l)}
                 for k, row in (("chaud", chaud), ("frais", frais))},
    "trajectoires": traj[traj["scenario"].isin(["S1", "S2", "S3"])][["scenario", "annee", "surface_totale_ha", "part_chaussee_traitee", "ges_evites_tco2e",
                                                                      "ges_evites_tco2e_p10", "ges_evites_tco2e_p90", "population_beneficiaire_adaptation"]].round(1).to_dict(orient="records"),
    "bornes": {"lon": list(map(float, t.to_crs(CRS_WEB).total_bounds[[0, 2]])), "lat": list(map(float, t.to_crs(CRS_WEB).total_bounds[[1, 3]]))},
}
ecrire_js("chiffres", "GP_META", meta)
ctx = gpd.read_file(GPKG, layer="ref_territoire").to_crs(CRS_WEB)
eau = gpd.read_file(GPKG, layer="hyd_surfaces_eau")
eau = eau[eau.area > 2000].dissolve()
eau["geometry"] = eau.simplify(3)
ecrire_js("contexte", "GP_CONTEXTE", {"territoire": json.loads(ctx.assign(geometry=ctx.simplify(0.0001))[["geometry"]].to_json(drop_id=True)),
                                      "eau": json.loads(eau.to_crs(CRS_WEB)[["geometry"]].to_json(drop_id=True))})
print("Exemples :", meta["exemples"]["chaud"]["n"], "/", meta["exemples"]["frais"]["n"])
