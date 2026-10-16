"""Mission 5a — Couche de synthèse SIG (un tronçon = toutes ses valeurs) pour le projet QGIS.

Sortie : 05_valorisation/resultats_revetements.gpkg
  - troncons_resultats : indicateurs, besoins N, compatibilités C, aptitudes, priorités par profil,
                         robustesse Monte-Carlo, prospective (année et revêtement par scénario)
  - grille_resultats   : grille INSEE 200 m agrégée
"""
import geopandas as gpd
import numpy as np
import pandas as pd

import materiaux as MAT
from config import AMC, GPKG, IND, PROSP, VALO

SORTIE = VALO / "resultats_revetements.gpkg"
if SORTIE.exists():
    SORTIE.unlink()

t = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_troncons")
res = pd.read_csv(AMC / "resultats_amc_troncons.csv", sep=";", encoding="utf-8-sig")
etat = pd.read_csv(PROSP / "etat_troncons_scenarios.csv", sep=";", encoding="utf-8-sig")
t = t.merge(res.drop(columns=[c for c in res.columns if c in t.columns and c != "id_troncon"]), on="id_troncon").merge(etat, on="id_troncon")

PROF_SC = {"S0": "equilibre", "S1": "adaptation", "S2": "bas_carbone", "S3": "equilibre"}
for sc, pr in PROF_SC.items():
    t[f"delta2050_{sc}"] = np.where(t["dans_le_champ"] == 1, t[f"score2050_{sc}"] - t[f"score_{pr}"], np.nan).round(4)
    t[f"mat_{sc}"] = t[f"mat_{sc}"].fillna("")
lib = {m: MAT.MATERIAUX[m]["court"] for m in MAT.CODES}
for k in ["equilibre", "adaptation", "bas_carbone", "eau_sols", "justice"]:
    t[f"mat_{k}_lib"] = t[f"mat_{k}"].map(lambda c: f"{c} {lib[c]}" if c in lib else "—")

garde = (["id_troncon", "nom_voie", "arrondissement", "hierarchie", "domanialite", "revetement", "dans_le_champ",
          "classe_pl", "classe_pl_source", "tmjo_veh_j", "vitesse_kmh", "zone_apaisee", "ligne_bus", "pente_pct",
          "surface_chaussee_m2", "longueur_m", "canopee_rue", "rapport_h_l", "insolation", "expo_jour", "expo_nuit",
          "impermeabilisation", "densite_hab_ha", "dens_sensible_ha", "taux_pauvrete", "besoin_chaleur", "vulnerabilite", "usages",
          "inond_moyen"]
         + [f"N_{e}" for e in MAT.ENJEUX] + [f"C_{m}" for m in MAT.CODES] + [f"apt_{m}" for m in MAT.CODES]
         + [c for k in ["equilibre", "adaptation", "bas_carbone", "eau_sols", "justice"] for c in (f"score_{k}", f"classe_{k}", f"mat_{k}", f"mat_{k}_lib")]
         + ["p_top20", "p_top20_preferences", "p_top20_materiaux", "robustesse", "consensus_top20", "mat_modal_mc", "stabilite_materiau"]
         + [c for sc in PROF_SC for c in (f"an_{sc}", f"mat_{sc}", f"delta2050_{sc}")] + ["geometry"])
t[garde].to_file(SORTIE, layer="troncons_resultats", driver="GPKG")
gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_grille200").to_file(SORTIE, layer="grille_resultats", driver="GPKG")
for couche in ["ref_territoire", "ref_arrondissements", "hyd_surfaces_eau", "risq_inondation_moyen", "eq_sensibles", "clim_icu_metropole"]:
    gpd.read_file(GPKG, layer=couche).to_file(SORTIE, layer=couche, driver="GPKG")
print("Écrit :", SORTIE, len(t), "tronçons")
