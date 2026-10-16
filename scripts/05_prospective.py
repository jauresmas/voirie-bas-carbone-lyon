"""Mission 4 — Prospective territoriale 2026-2050.

Quatre scénarios combinant une trajectoire territoriale (climat, vieillissement, mobilités,
végétalisation) et une stratégie de déploiement des revêtements biosourcés.
Le déploiement n'a lieu qu'aux dates de renouvellement de la couche de roulement
(calendrier simulé, faute de donnée ouverte sur l'âge des chaussées), sauf
anticipation explicite des tronçons prioritaires.

Sorties : trajectoires annuelles d'impact (médiane et intervalle 10-90 % par Monte-Carlo),
état des tronçons par scénario (année et revêtement), aptitude 2050 par scénario.
"""
import json

import geopandas as gpd
import numpy as np
import pandas as pd

import materiaux as MAT
from config import AMC, CRS, GPKG, IND, PROSP, SEED

PROSP.mkdir(exist_ok=True)
ANS = np.arange(2026, 2051)
REF = MAT.REFERENCE
PLUIE_ANNUELLE_M = 0.83          # Lyon-Bron, ordre de grandeur de la normale annuelle
COEF_RUISS_DRAINANT = 0.30

# TRACC (trajectoire de réchauffement de référence pour l'adaptation, France métropolitaine,
# écart à l'ère préindustrielle) : +2,0 °C en 2030, +2,7 °C en 2050 ; ~+1,8 °C au milieu des années 2020.
TRACC = {2025: 1.8, 2030: 2.0, 2050: 2.7}


def rechauffement(an):
    xs, ys = list(TRACC), list(TRACC.values())
    return float(np.interp(an, xs, ys))


SCENARIOS = {
    "S0": {"nom": "Tendanciel", "couleur": "#8a8f98",
           "recit": "Les revêtements biosourcés restent des opérations ponctuelles, sans ciblage territorial. "
                    "La filière de liants végétaux progresse lentement.",
           "part": (2026, 0.05, 2050, 0.25), "profil": None, "anticipation": 0.0,
           "mobilites": False, "vegetalisation": False},
    "S1": {"nom": "Adaptation ciblée", "couleur": "#d9a441",
           "recit": "Priorité à la santé face à la chaleur : les tronçons prioritaires du profil « adaptation » "
                    "sont renouvelés par anticipation (2027-2032) avec le revêtement recommandé.",
           "part": (2026, 0.20, 2050, 0.60), "profil": "adaptation", "anticipation": 0.10,
           "mobilites": False, "vegetalisation": False},
    "S2": {"nom": "Massification bas-carbone", "couleur": "#2f6f4f",
           "recit": "La filière industrielle des liants biosourcés se structure : 100 % des renouvellements "
                    "en 2040, choix du revêtement guidé par le profil « bas-carbone ».",
           "part": (2026, 0.30, 2040, 1.00), "profil": "bas_carbone", "anticipation": 0.0,
           "mobilites": False, "vegetalisation": False},
    "S3": {"nom": "Transition intégrée", "couleur": "#3b7fb6",
           "recit": "Sobriété des mobilités (−30 % de trafic, logistique allégée, apaisement généralisé des rues "
                    "de desserte) et plan canopée ; déploiement ciblé et anticipé sur le profil « équilibré » "
                    "réévalué tous les 5 ans.",
           "part": (2026, 0.25, 2045, 0.90), "profil": "equilibre", "anticipation": 0.10,
           "mobilites": True, "vegetalisation": True},
}
PL_ALLEGE = {"TS": "T0", "T0": "T1", "T1": "T2", "T2": "T3", "T3": "T4", "T4": "T5", "T5": "T5"}


def part_innovante(sc, an):
    a0, s0, a1, s1 = SCENARIOS[sc]["part"]
    return float(np.clip(s0 + (s1 - s0) * (an - a0) / (a1 - a0), min(s0, s1), max(s0, s1)))


def territoire(t, sc, an):
    """Attributs et besoins du territoire à l'année `an` selon le scénario."""
    d = t.copy()
    f = (an - 2025) / 25
    d["besoin_chaleur"] = (d["besoin_chaleur"] * (1 + 0.30 * (rechauffement(an) - rechauffement(2025)))).clip(0, 1)
    d["vulnerabilite"] = (d["vulnerabilite"] * (1 + 0.25 * f)).clip(0, 1)
    if SCENARIOS[sc]["vegetalisation"]:
        gain = np.where(d["canopee_rue"] < 0.3, 0.15 * min(1, (an - 2025) / 20), 0)
        d["insolation"] = ((1 - (d["canopee_rue"] + gain).clip(0, 1)) * (0.4 + 0.6 * d["svf"]))
        d["n_impermeabilisation"] = d["n_impermeabilisation"] * (1 - 0.05 * f)
    if SCENARIOS[sc]["mobilites"]:
        k = min(1, (an - 2025) / 15)
        locale = d["hierarchie"].isin(["Desserte locale", "Niv. 3d — distribution"])
        if an >= 2035:
            d.loc[locale, "classe_pl"] = d.loc[locale, "classe_pl"].map(PL_ALLEGE)
        d["n_trafic"] = d["n_trafic"] * (1 - 0.30 * k)
        apaise = locale & (d["zone_apaisee"] == "Aucune") & (an >= 2030)
        d.loc[apaise, "zone_apaisee"] = "Zone 30"
        d["n_zone_apaisee"] = np.where(locale & (an >= 2035), np.maximum(d["n_zone_apaisee"], 0.9), d["n_zone_apaisee"])
        d["usages"] = 0.30 * d["n_zone_apaisee"] + 0.15 * d["cyclable"] + 0.20 * d["n_arrets_tc"] + 0.35 * d["n_densite"]
    return d


def besoins(d, ref):
    """Recalcule N[s, g] avec les bornes de normalisation de l'état initial (comparabilité temporelle)."""
    def nm(x, key):
        lo, hi = ref[key]
        return np.clip((x - lo) / (hi - lo), 0, 1)
    raw = {"chaleur": d["besoin_chaleur"] * (0.3 + 0.7 * d["insolation"]),
           "sante": d["vulnerabilite"] * (0.3 + 0.7 * d["insolation"]) * (0.5 + 0.5 * d["besoin_chaleur"]),
           "usages": d["usages"]}
    return np.column_stack([nm(raw["chaleur"], "chaleur"), nm(raw["sante"], "sante"), d["n_impermeabilisation"],
                            0.6 + 0.4 * d["n_surface"], nm(raw["usages"], "usages")])


print("Chargement")
t = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_troncons")
amc = json.load(open(AMC / "amc_parametres.json", encoding="utf-8"))
POIDS = {k: np.array([v["poids"][e] for e in MAT.ENJEUX]) for k, v in amc["profils"].items()}
champ = (t["dans_le_champ"] == 1).to_numpy()
surf = t["surface_chaussee_m2"].to_numpy()
masse_m2 = REF["epaisseur_m"] * REF["densite_t_m3"]           # t d'enrobé par m² renouvelé
raw0 = {"chaleur": t["besoin_chaleur"] * (0.3 + 0.7 * t["insolation"]),
        "sante": t["vulnerabilite"] * (0.3 + 0.7 * t["insolation"]) * (0.5 + 0.5 * t["besoin_chaleur"]),
        "usages": t["usages"]}
BORNES = {k: (np.nanpercentile(v[champ], 2), np.nanpercentile(v[champ], 98)) for k, v in raw0.items()}

# Population par tronçon (répartition de la population des carreaux sur la chaussée qu'ils contiennent)
g = gpd.read_file(GPKG, layer="ref_grille200")
cent = gpd.GeoDataFrame(t[["id_troncon", "surface_chaussee_m2"]], geometry=t.geometry.centroid, crs=CRS)
sj = gpd.sjoin(cent, g[["idcar_200m", "pop", "geometry"]], predicate="within").drop_duplicates("id_troncon")
sj["part"] = sj["surface_chaussee_m2"] / sj.groupby("idcar_200m")["surface_chaussee_m2"].transform("sum")
pop_tr = t["id_troncon"].map(sj.set_index("id_troncon").eval("pop * part")).fillna(0).to_numpy()


def evaluer(sc, an, params):
    d = territoire(t, sc, an)
    N = besoins(d, BORNES)
    S = MAT.scores(MAT.benefices(N, MAT.indices_performance(params), MAT.compatibilite(d, params)),
                   POIDS[SCENARIOS[sc]["profil"] or "equilibre"])
    return S


def percentile_surface(score):
    """Rang surfacique cumulé (0 = le plus apte) parmi les tronçons du champ."""
    r = np.ones(len(score))
    idx = np.where(champ & (score.max(1) > 0))[0]
    o = idx[np.argsort(-score[idx].max(1), kind="stable")]
    r[o] = np.cumsum(surf[o]) / surf[o].sum()
    return r


def simuler(sc, rng, params, ef_ref, detail=False):
    """Simulation annuelle. Retourne les trajectoires d'indicateurs (et l'état final si detail)."""
    L = {m: params[m]["duree_vie"] for m in MAT.CODES}
    red = {m: params[m]["reduction_ges"] for m in MAT.CODES}
    phase = rng.integers(0, REF["duree_vie"], len(t))
    prochain = 2026 + phase                        # prochain renouvellement (conventionnel)
    prochain_ref = prochain.copy()                 # contrefactuel « tout conventionnel »
    mat = np.full(len(t), "", dtype=object)
    an_mat = np.zeros(len(t), dtype=int)
    S = evaluer(sc, 2026, params)
    rang = percentile_surface(S)
    best = np.array(MAT.CODES)[S.argmax(1)]
    ant = SCENARIOS[sc]["anticipation"]
    if ant > 0:   # anticipation : les tronçons prioritaires sont renouvelés entre 2027 et 2032
        sel = champ & (rang <= ant)
        prochain[sel] = np.minimum(prochain[sel], 2027 + rng.integers(0, 6, sel.sum()))
    em_sc = em_ref = 0.0
    traj = []
    for an in ANS:
        if SCENARIOS[sc]["profil"] and an in (2030, 2035, 2040, 2045) and sc == "S3":
            S = evaluer(sc, an, params)
            rang, best = percentile_surface(S), np.array(MAT.CODES)[S.argmax(1)]
        reno = champ & (prochain == an)
        part = part_innovante(sc, an)
        if SCENARIOS[sc]["profil"] is None:
            choix = reno & (rng.random(len(t)) < part)
            nouveau = np.where(np.isin(t["classe_pl"], ["TS", "T0", "T1", "T2"]), "R4", "R1")
        else:
            choix = reno & (rang <= part) & (S.max(1) > 0)
            nouveau = best
        deja = mat != ""
        appli = choix | (reno & deja)            # un tronçon déjà converti reste dans sa filière
        mat = np.where(choix & ~deja, nouveau, mat)
        an_mat = np.where(choix & ~deja, an, an_mat)
        conv = reno & ~appli
        # émissions de production de la couche de roulement
        r = np.array([red.get(m, 0.0) for m in mat])
        em_sc += (surf[reno] * masse_m2 * ef_ref * np.where(appli[reno], 1 - r[reno], 1)).sum() / 1000
        dur = np.array([L.get(m, REF["duree_vie"]) for m in mat])
        prochain = np.where(reno, an + np.where(appli, np.round(dur).astype(int), REF["duree_vie"]), prochain)
        reno_ref = champ & (prochain_ref == an)
        em_ref += (surf[reno_ref] * masse_m2 * ef_ref).sum() / 1000
        prochain_ref = np.where(reno_ref, an + REF["duree_vie"], prochain_ref)
        surf_m = {m: surf[mat == m].sum() for m in MAT.CODES}
        rafr = (mat == "R2") & (t["besoin_chaleur"].to_numpy() >= 0.6)
        adapt = np.isin(mat, ["R2", "R3"])
        traj.append({"annee": an, "scenario": sc, "part_innovante_renouvellements": round(part, 3),
                     **{f"surface_{m}_ha": surf_m[m] / 1e4 for m in MAT.CODES},
                     "surface_totale_ha": sum(surf_m.values()) / 1e4,
                     "part_chaussee_traitee": sum(surf_m.values()) / surf[champ].sum(),
                     "ges_evites_tco2e": em_ref - em_sc,
                     "surface_rafraichissante_zones_chaudes_ha": surf[rafr].sum() / 1e4,
                     "population_beneficiaire_adaptation": pop_tr[adapt].sum(),
                     "ruissellement_evite_m3_an": surf_m["R3"] * PLUIE_ANNUELLE_M * (REF["coef_ruissellement"] - COEF_RUISS_DRAINANT),
                     "couverture_priorites_P1P2": surf[(mat != "") & (PRIO <= 2)].sum() / surf[PRIO <= 2].sum()})
    out = pd.DataFrame(traj)
    if detail:
        return out, mat, an_mat
    return out


PRIO = gpd.read_file(AMC / "resultats_amc.gpkg", layer="aptitude_troncons").set_index("id_troncon") \
    .reindex(t["id_troncon"])["classe_equilibre"].replace(0, 9).to_numpy()

print("Simulation centrale et Monte-Carlo")
rng = np.random.default_rng(SEED)
trajs, etats, mc = [], {}, []
for sc in SCENARIOS:
    out, mat, an_mat = simuler(sc, np.random.default_rng(SEED), MAT.tirer(), REF["ef_kgco2e_t"][1], detail=True)
    trajs.append(out)
    etats[sc] = (mat, an_mat)
    for i in range(150):
        pr = MAT.tirer(rng)
        ef = rng.triangular(*REF["ef_kgco2e_t"])
        o = simuler(sc, rng, pr, ef)
        mc.append(o[["annee", "scenario", "ges_evites_tco2e", "population_beneficiaire_adaptation", "surface_totale_ha"]].assign(run=i))
    print(f"   {sc} ({SCENARIOS[sc]['nom']}) : {out.iloc[-1]['surface_totale_ha']:.0f} ha traités en 2050, "
          f"{out.iloc[-1]['ges_evites_tco2e']:.0f} tCO2e évitées (cumul)")
traj = pd.concat(trajs, ignore_index=True)
mcd = pd.concat(mc, ignore_index=True)
q = mcd.groupby(["scenario", "annee"]).quantile([0.1, 0.5, 0.9]).unstack()
for col in ["ges_evites_tco2e", "population_beneficiaire_adaptation", "surface_totale_ha"]:
    for qq, lab in ((0.1, "p10"), (0.9, "p90")):
        traj[f"{col}_{lab}"] = traj.set_index(["scenario", "annee"]).index.map(q[(col, qq)])
traj = traj.round(3)
traj.to_csv(PROSP / "trajectoires_scenarios.csv", index=False, sep=";", encoding="utf-8-sig")

# État des tronçons par scénario + aptitude 2050
print("Aptitude 2050 par scénario")
etat = t[["id_troncon"]].copy()
for sc in SCENARIOS:
    etat[f"mat_{sc}"] = etats[sc][0]
    etat[f"an_{sc}"] = etats[sc][1]
    S50 = evaluer(sc, 2050, MAT.tirer())
    etat[f"score2050_{sc}"] = S50.max(1).round(4)
etat.to_csv(PROSP / "etat_troncons_scenarios.csv", index=False, sep=";", encoding="utf-8-sig")

# Synthèse par horizon
synth = traj[traj["annee"].isin([2030, 2040, 2050])][
    ["scenario", "annee", "surface_totale_ha", "part_chaussee_traitee", "ges_evites_tco2e", "ges_evites_tco2e_p10", "ges_evites_tco2e_p90",
     "surface_rafraichissante_zones_chaudes_ha", "population_beneficiaire_adaptation", "ruissellement_evite_m3_an", "couverture_priorites_P1P2"]]
synth.to_csv(PROSP / "synthese_horizons.csv", index=False, sep=";", encoding="utf-8-sig")
with open(PROSP / "scenarios.json", "w", encoding="utf-8") as f:
    json.dump({"scenarios": {k: {kk: vv for kk, vv in v.items()} for k, v in SCENARIOS.items()},
               "tracc": TRACC, "hypotheses": {
                   "renouvellement": "Couche de roulement renouvelée tous les 15 ans (conventionnel) ; phase initiale aléatoire par tronçon",
                   "epaisseur_couche_m": REF["epaisseur_m"], "densite_t_m3": REF["densite_t_m3"],
                   "facteur_emission_reference_kgco2e_t": REF["ef_kgco2e_t"],
                   "pluie_annuelle_m": PLUIE_ANNUELLE_M, "coef_ruissellement": [REF["coef_ruissellement"], COEF_RUISS_DRAINANT],
                   "intensification_chaleur": "+30 % du besoin par °C de réchauffement TRACC au-delà de 2025",
                   "vieillissement": "+25 % de vulnérabilité en 2050 (part croissante des 65 ans et plus)"}},
              f, ensure_ascii=False, indent=1)
print(synth.to_string())
