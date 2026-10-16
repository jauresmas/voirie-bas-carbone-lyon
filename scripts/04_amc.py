"""Mission 3 — Analyse multicritère, cartes d'aptitude et robustesse.

1. Pondération des enjeux par AHP (Saaty) pour 5 profils d'acteurs, ratio de cohérence.
2. Score par tronçon et par matériau : S[s, m] = sum_g w_g * C[s, m] * P[m, g] * N[s, g].
   Aptitude = max_m S ; revêtement recommandé = argmax_m S.
3. Classes de priorité par part de surface de chaussée (P1 = 10 % les plus aptes, P2 = 10-30 %, ...).
4. Robustesse : comparaison des profils (Spearman, recouvrement), Monte-Carlo sur les poids
   (Dirichlet) et sur les paramètres matériaux (tirages triangulaires), sensibilité un-à-un.
"""
import json

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

import materiaux as MAT
from config import AMC, IND, SEED

AMC.mkdir(exist_ok=True)
G = MAT.ENJEUX
RI = {1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32}

# Jugements par paires (échelle de Saaty) : (i, j) -> importance de i par rapport à j.
PROFILS = {
    "equilibre": {"nom": "Équilibré", "acteur": "Comité de pilotage (référence)", "jugements": {}},
    "adaptation": {"nom": "Adaptation chaleur & santé", "acteur": "Direction climat / santé publique",
                   "jugements": {("chaleur", "sante"): 1, ("chaleur", "eau"): 3, ("chaleur", "carbone"): 5, ("chaleur", "usages"): 3,
                                 ("sante", "eau"): 3, ("sante", "carbone"): 5, ("sante", "usages"): 3,
                                 ("eau", "carbone"): 2, ("eau", "usages"): 1, ("carbone", "usages"): 1 / 2}},
    "bas_carbone": {"nom": "Bas-carbone", "acteur": "Gestionnaire de voirie / plan climat",
                    "jugements": {("carbone", "chaleur"): 5, ("carbone", "sante"): 5, ("carbone", "eau"): 5, ("carbone", "usages"): 7,
                                  ("chaleur", "sante"): 1, ("chaleur", "eau"): 1, ("chaleur", "usages"): 2,
                                  ("sante", "eau"): 1, ("sante", "usages"): 2, ("eau", "usages"): 2}},
    "eau_sols": {"nom": "Eau & sols", "acteur": "Direction de l'eau / désimperméabilisation",
                 "jugements": {("eau", "chaleur"): 3, ("eau", "sante"): 3, ("eau", "carbone"): 5, ("eau", "usages"): 3,
                               ("chaleur", "sante"): 1, ("chaleur", "carbone"): 2, ("chaleur", "usages"): 1,
                               ("sante", "carbone"): 2, ("sante", "usages"): 1, ("carbone", "usages"): 1 / 2}},
    "justice": {"nom": "Justice environnementale", "acteur": "Élus / politique de la ville",
                "jugements": {("sante", "chaleur"): 2, ("sante", "eau"): 4, ("sante", "carbone"): 5, ("sante", "usages"): 1,
                              ("usages", "chaleur"): 2, ("usages", "eau"): 3, ("usages", "carbone"): 4,
                              ("chaleur", "eau"): 2, ("chaleur", "carbone"): 3, ("eau", "carbone"): 1}},
}


def ahp(jugements):
    n = len(G)
    A = np.ones((n, n))
    for (a, b), v in jugements.items():
        i, j = G.index(a), G.index(b)
        A[i, j], A[j, i] = v, 1 / v
    vals, vecs = np.linalg.eig(A)
    k = np.argmax(vals.real)
    w = np.abs(vecs[:, k].real)
    w /= w.sum()
    lmax = vals[k].real
    ci = (lmax - n) / (n - 1)
    return A, w, lmax, ci / RI[n]


def classes_priorite(score, surface, actif):
    """P1 : 10 % de la surface la plus apte ; P2 : 10-30 % ; P3 : 30-60 % ; P4 : reste ; 0 : hors champ."""
    cl = np.zeros(len(score), dtype=int)
    idx = np.where(actif)[0]
    ordre = idx[np.argsort(-score[idx], kind="stable")]
    cum = np.cumsum(surface[ordre]) / surface[ordre].sum()
    cl[ordre] = np.select([cum <= 0.10, cum <= 0.30, cum <= 0.60], [1, 2, 3], 4)
    return cl


def top(score, surface, actif, part=0.20):
    idx = np.where(actif)[0]
    ordre = idx[np.argsort(-score[idx], kind="stable")]
    cum = np.cumsum(surface[ordre]) / surface[ordre].sum()
    out = np.zeros(len(score), dtype=bool)
    out[ordre[cum <= part]] = True
    return out


print("Chargement des indicateurs")
t = gpd.read_file(IND / "indicateurs.gpkg", layer="indicateurs_troncons")
N = t[[f"N_{e}" for e in G]].to_numpy()
surf = t["surface_chaussee_m2"].to_numpy()
actif = (t["dans_le_champ"] == 1).to_numpy()
params0 = MAT.tirer()
P0 = MAT.indices_performance(params0)
C0 = MAT.compatibilite(t, params0)
B0 = MAT.benefices(N, P0, C0)

# ------------------------------------------------------------ 1. AHP
print("1. Pondérations AHP")
poids, rapport = {}, []
for k, pr in PROFILS.items():
    A, w, lmax, cr = ahp(pr["jugements"])
    poids[k] = w
    rapport.append({"profil": pr["nom"], "acteur": pr["acteur"], **{MAT.LIB_ENJEUX[e]: round(w[i], 3) for i, e in enumerate(G)},
                    "lambda_max": round(lmax, 3), "ratio_coherence": round(cr, 3), "coherent (RC<0,10)": "oui" if cr < 0.1 else "non"})
    pd.DataFrame(A, index=G, columns=G).round(3).to_csv(AMC / f"ahp_matrice_{k}.csv", sep=";", encoding="utf-8-sig")
ahp_df = pd.DataFrame(rapport)
ahp_df.to_csv(AMC / "ahp_poids_profils.csv", index=False, sep=";", encoding="utf-8-sig")
print(ahp_df.drop(columns=["acteur"]).to_string())

# ------------------------------------------------------------ 2. scores par profil
print("2. Scores et classes de priorité")
res = t[["id_troncon"]].copy()
for k, w in poids.items():
    S = MAT.scores(B0, w)                      # S x M
    apt = S.max(axis=1)
    rec = np.array(MAT.CODES)[S.argmax(axis=1)]
    rec[apt <= 1e-6] = "—"
    res[f"score_{k}"] = apt.round(4)
    res[f"rang_{k}"] = pd.Series(apt).where(actif).rank(ascending=False, method="min").fillna(0).astype(int).to_numpy()
    res[f"classe_{k}"] = classes_priorite(apt, surf, actif & (apt > 0))
    res[f"mat_{k}"] = rec
    for i, m in enumerate(MAT.CODES):
        res[f"S_{k}_{m}"] = S[:, i].round(4)

# ------------------------------------------------------------ 3. robustesse entre profils
print("3. Robustesse entre profils")
noms = list(poids)
sp = pd.DataFrame(index=noms, columns=noms, dtype=float)
rec_ = pd.DataFrame(index=noms, columns=noms, dtype=float)
tops = {k: top(res[f"score_{k}"].to_numpy(), surf, actif) for k in noms}
for a in noms:
    for b in noms:
        sp.loc[a, b] = spearmanr(res.loc[actif, f"score_{a}"], res.loc[actif, f"score_{b}"]).statistic
        inter_ = surf[tops[a] & tops[b]].sum()
        rec_.loc[a, b] = inter_ / surf[tops[a] | tops[b]].sum()
sp.round(3).to_csv(AMC / "robustesse_spearman_profils.csv", sep=";", encoding="utf-8-sig")
rec_.round(3).to_csv(AMC / "robustesse_recouvrement_top20.csv", sep=";", encoding="utf-8-sig")
res["consensus_top20"] = np.sum([tops[k] for k in noms], axis=0)
print("Spearman :\n", sp.round(2))
print("Recouvrement (Jaccard surfacique) des 20 % prioritaires :\n", rec_.round(2))

# ------------------------------------------------------------ 4. Monte-Carlo
print("4. Monte-Carlo (préférences + matériaux)")
rng = np.random.default_rng(SEED)
NS = 1000
w_ref = poids["equilibre"]
cpt = {"pref": np.zeros(len(t)), "mat": np.zeros(len(t)), "tout": np.zeros(len(t))}
mat_freq = np.zeros((len(t), len(MAT.CODES)))
rangs = np.zeros((NS, len(t)), dtype=np.float32)
for e in ("pref", "mat", "tout"):
    for it in range(NS):
        w = rng.dirichlet(np.ones(len(G))) if e in ("pref", "tout") else w_ref
        if e in ("mat", "tout"):
            pr = MAT.tirer(rng)
            B = MAT.benefices(N, MAT.indices_performance(pr), MAT.compatibilite(t, pr))
        else:
            B = B0
        S = MAT.scores(B, w)
        apt = S.max(axis=1)
        cpt[e] += top(apt, surf, actif & (apt > 0))
        if e == "tout":
            mat_freq[np.arange(len(t)), S.argmax(axis=1)] += apt > 0
            rangs[it] = pd.Series(apt).where(actif).rank(ascending=False, pct=True).fillna(1).to_numpy()
    print(f"   {e}: ok")
res["p_top20_preferences"] = (cpt["pref"] / NS).round(3)
res["p_top20_materiaux"] = (cpt["mat"] / NS).round(3)
res["p_top20"] = (cpt["tout"] / NS).round(3)
res["rang_pct_q05"] = np.quantile(rangs, 0.05, axis=0).round(3)
res["rang_pct_q95"] = np.quantile(rangs, 0.95, axis=0).round(3)
res["mat_modal_mc"] = np.where(mat_freq.sum(1) > 0, np.array(MAT.CODES)[mat_freq.argmax(1)], "—")
res["stabilite_materiau"] = np.where(mat_freq.sum(1) > 0, mat_freq.max(1) / np.maximum(mat_freq.sum(1), 1), 0).round(3)
res["robustesse"] = np.select([res["p_top20"] >= 0.8, res["p_top20"] >= 0.5, res["p_top20"] >= 0.2], [
    "Prioritaire robuste", "Prioritaire probable", "Prioritaire incertain"], "Rarement prioritaire")
res.loc[~actif, "robustesse"] = "Hors champ"

# ------------------------------------------------------------ 5. sensibilité un-à-un (±25 % par poids)
print("5. Sensibilité un-à-un")
sens = []
top_ref = tops["equilibre"]
for i, e in enumerate(G):
    for delta in (-0.25, 0.25):
        w = w_ref.copy()
        w[i] *= 1 + delta
        w /= w.sum()
        apt = MAT.scores(B0, w).max(axis=1)
        tp = top(apt, surf, actif & (apt > 0))
        j = surf[tp & top_ref].sum() / surf[tp | top_ref].sum()
        sens.append({"enjeu": MAT.LIB_ENJEUX[e], "variation_poids": f"{delta:+.0%}", "jaccard_top20": round(j, 3),
                     "surface_sortante_m2": round(surf[top_ref & ~tp].sum())})
sens_df = pd.DataFrame(sens)
sens_df.to_csv(AMC / "sensibilite_un_a_un.csv", index=False, sep=";", encoding="utf-8-sig")
print(sens_df.to_string())

# Paramètres matériaux : sensibilité un-à-un (bas / haut) sur le choix de matériau et le top 20 %
sens_m = []
for m in MAT.CODES:
    for k in ("albedo", "reduction_ges", "duree_vie"):
        for niv, idx in (("bas", 0), ("haut", 2)):
            pr = MAT.tirer()
            pr[m][k] = MAT.MATERIAUX[m][k][idx]
            S = MAT.scores(MAT.benefices(N, MAT.indices_performance(pr), C0), w_ref)
            apt = S.max(axis=1)
            tp = top(apt, surf, actif & (apt > 0))
            recm = S.argmax(1)
            ref_m = MAT.scores(B0, w_ref).argmax(1)
            sens_m.append({"materiau": m, "parametre": k, "niveau": niv, "valeur": MAT.MATERIAUX[m][k][idx],
                           "jaccard_top20": round(surf[tp & top_ref].sum() / surf[tp | top_ref].sum(), 3),
                           "part_surface_changeant_de_materiau": round(surf[actif & (recm != ref_m)].sum() / surf[actif].sum(), 3)})
pd.DataFrame(sens_m).to_csv(AMC / "sensibilite_parametres_materiaux.csv", index=False, sep=";", encoding="utf-8-sig")

# ------------------------------------------------------------ sorties
out = t[["id_troncon", "nom_voie", "arrondissement", "hierarchie", "classe_pl", "surface_chaussee_m2", "dans_le_champ", "geometry"]].merge(res, on="id_troncon")
out.to_file(AMC / "resultats_amc.gpkg", layer="aptitude_troncons", driver="GPKG")
out.drop(columns="geometry").to_csv(AMC / "resultats_amc_troncons.csv", index=False, sep=";", encoding="utf-8-sig")

synth = []
for k in noms:
    a = out[actif]
    for c in range(1, 5):
        sel = a[a[f"classe_{k}"] == c]
        synth.append({"profil": PROFILS[k]["nom"], "classe": f"P{c}", "troncons": len(sel), "km": round(sel.length.sum() / 1000, 1),
                      "surface_ha": round(sel["surface_chaussee_m2"].sum() / 1e4, 1),
                      **{f"part_{m}": round(sel.loc[sel[f'mat_{k}'] == m, 'surface_chaussee_m2'].sum() / max(sel['surface_chaussee_m2'].sum(), 1), 3) for m in MAT.CODES}})
pd.DataFrame(synth).to_csv(AMC / "synthese_classes_profils.csv", index=False, sep=";", encoding="utf-8-sig")
with open(AMC / "amc_parametres.json", "w", encoding="utf-8") as f:
    json.dump({"profils": {k: {"nom": PROFILS[k]["nom"], "acteur": PROFILS[k]["acteur"], "poids": dict(zip(G, np.round(poids[k], 4).tolist()))} for k in noms},
               "P": P0.round(4).tolist(), "materiaux": MAT.CODES, "enjeux": G, "monte_carlo": NS,
               "spearman": sp.round(3).to_dict(), "recouvrement_top20": rec_.round(3).to_dict()}, f, ensure_ascii=False, indent=1)
print(pd.DataFrame(synth).to_string())
print("Robustesse :", out.loc[actif, "robustesse"].value_counts().to_dict())
