"""Matrice matériau-territoire : propriétés des revêtements et fonctions de compatibilité.

Les valeurs sont des HYPOTHÈSES DE TRAVAIL (bas / central / haut) issues d'ordres de
grandeur de la littérature technique ; elles sont à consolider avec les essais des
partenaires matériaux du projet. L'analyse de robustesse (04_amc.py) les fait varier.

Deux familles d'information, volontairement séparées :
  P[m, g] : performance du matériau m pour l'enjeu g  (connaissance matériau)
  C[s, m] : compatibilité technique du matériau m avec le tronçon s (contraintes du territoire)
Le bénéfice territorial est B[s, m, g] = C[s, m] * P[m, g] * N[s, g], où N est le besoin du
territoire pour l'enjeu g (indicateurs spatialisés, 03_indicateurs.py).
"""
import numpy as np

ENJEUX = ["chaleur", "sante", "eau", "carbone", "usages"]
LIB_ENJEUX = {"chaleur": "Climat urbain (îlot de chaleur)", "sante": "Santé et vulnérabilité",
              "eau": "Eau et sols (imperméabilisation)", "carbone": "Carbone (cycle de vie)",
              "usages": "Usages et cadre de vie"}

REFERENCE = {"nom": "Enrobé bitumineux conventionnel (BBSG 0/10)", "albedo": 0.10, "duree_vie": 15,
             "ef_kgco2e_t": (45, 55, 70), "epaisseur_m": 0.06, "densite_t_m3": 2.35,
             "coef_ruissellement": 0.90}

# (bas, central, haut) ; les tables de compatibilité trafic sont centrales.
MATERIAUX = {
    "R1": {"nom": "Enrobé à liant biosourcé (substitution du bitume)", "court": "Liant biosourcé",
           "couleur": "#2f6f4f",
           "albedo": (0.08, 0.10, 0.12), "reduction_ges": (0.30, 0.45, 0.60), "duree_vie": (12, 15, 17),
           "evaporation": (0, 0, 0), "permeabilite": 0.0, "bruit": 0.0,
           "trafic": {"TS": 0.3, "T0": 0.5, "T1": 0.8, "T2": 1, "T3": 1, "T4": 1, "T5": 1},
           "bus": 0.9, "vitesse50": 1.0, "pente": None, "inondation": (1.0, 1.0), "encrassement": 0.0,
           "petite_surface": 1.0,
           "logique": "Substitution directe du bitume : même aspect et même mise en œuvre, gain carbone ; "
                      "incertitude sur l'orniérage à chaud sous trafic lourd (T0 et plus)."},
    "R2": {"nom": "Enrobé clair à liant végétal translucide", "court": "Enrobé clair",
           "couleur": "#d9a441",
           "albedo": (0.28, 0.36, 0.45), "reduction_ges": (0.15, 0.30, 0.45), "duree_vie": (9, 12, 14),
           "evaporation": (0, 0, 0), "permeabilite": 0.0, "bruit": 0.0,
           "trafic": {"TS": 0, "T0": 0, "T1": 0, "T2": 0.25, "T3": 0.6, "T4": 1, "T5": 1},
           "bus": 0.5, "vitesse50": 0.7, "pente": None, "inondation": (1.0, 1.0), "encrassement": 0.3,
           "petite_surface": 1.0,
           "logique": "Albédo élevé : baisse de la température de surface au soleil ; perd son effet sous "
                      "l'encrassement (traces de pneus) et le trafic lourd ; contraste du marquage réduit à 50 km/h et plus."},
    "R3": {"nom": "Enrobé drainant à liant biosourcé", "court": "Enrobé drainant",
           "couleur": "#3b7fb6",
           "albedo": (0.10, 0.12, 0.15), "reduction_ges": (0.20, 0.35, 0.50), "duree_vie": (8, 11, 13),
           "evaporation": (0.05, 0.15, 0.25), "permeabilite": 1.0, "bruit": 1.0,
           "trafic": {"TS": 0, "T0": 0, "T1": 0, "T2": 0.3, "T3": 0.7, "T4": 1, "T5": 1},
           "bus": 0.3, "vitesse50": 1.0, "pente": (2.0, 6.0), "inondation": (0.3, 0.7), "encrassement": 0.4,
           "petite_surface": 1.0,
           "logique": "Infiltration et réduction du bruit de roulement ; sensible au colmatage, à l'arrachement "
                      "(freinage des bus), à la pente (> 6 %) et inefficace en zone inondable (nappe haute)."},
    "R4": {"nom": "Enrobé recyclé à fort taux d'agrégats + régénérant biosourcé", "court": "Recyclé + régénérant bio",
           "couleur": "#7a4fa3",
           "albedo": (0.08, 0.10, 0.12), "reduction_ges": (0.35, 0.50, 0.65), "duree_vie": (13, 15, 17),
           "evaporation": (0, 0, 0), "permeabilite": 0.0, "bruit": 0.0,
           "trafic": {"TS": 1, "T0": 1, "T1": 1, "T2": 1, "T3": 0.85, "T4": 0.6, "T5": 0.5},
           "bus": 1.0, "vitesse50": 1.0, "pente": None, "inondation": (1.0, 1.0), "encrassement": 0.0,
           "petite_surface": 0.8,
           "logique": "Réemploi des agrégats d'enrobés régénérés par un liant biosourcé : robuste sous trafic lourd ; "
                      "pertinent sur les chantiers structurants, moins sur les petites rues de desserte."},
}
CODES = list(MATERIAUX)
IDX_CENTRAL = 1


def tirer(rng=None):
    """Jeu de paramètres matériaux : central si rng est None, sinon tirage triangulaire (bas, central, haut)."""
    p = {}
    for m, d in MATERIAUX.items():
        q = {}
        for k in ("albedo", "reduction_ges", "duree_vie", "evaporation"):
            lo, mid, hi = d[k]
            q[k] = mid if rng is None or lo == hi else rng.triangular(lo, mid, hi)
        bruit = 0.15 if rng is None else rng.uniform(0, 0.3)
        q["trafic"] = {c: (v if rng is None or v in (0, 1) else float(np.clip(v + rng.uniform(-bruit, bruit), 0, 1)))
                       for c, v in d["trafic"].items()}
        p[m] = q
    return p


def indices_performance(params):
    """P[m, g] (matériaux x enjeux), valeurs dans [0, 1]."""
    P = np.zeros((len(CODES), len(ENJEUX)))
    for i, m in enumerate(CODES):
        d, q = MATERIAUX[m], params[m]
        tau = min(1.0, max(0.0, (q["albedo"] - REFERENCE["albedo"]) / 0.28) + q["evaporation"])
        # Gain carbone annualisé : un matériau moins durable est renouvelé plus souvent.
        gain = 1 - (1 - q["reduction_ges"]) * REFERENCE["duree_vie"] / q["duree_vie"]
        gamma = float(np.clip(gain / 0.6, 0, 1))
        P[i] = [tau, tau, d["permeabilite"], gamma, (tau + d["bruit"]) / 2]
    return P


def compatibilite(df, params):
    """C[s, m] dans [0, 1] à partir des attributs des tronçons (contraintes techniques)."""
    n = len(df)
    C = np.zeros((n, len(CODES)))
    for i, m in enumerate(CODES):
        d, q = MATERIAUX[m], params[m]
        c = df["classe_pl"].map(q["trafic"]).fillna(1).to_numpy(float)
        c = c * np.where(df["bus"].to_numpy() == 1, d["bus"], 1.0)
        c = c * np.where(df["vitesse_kmh"].fillna(30).to_numpy() >= 50, d["vitesse50"], 1.0)
        if d["pente"]:
            p0, p1 = d["pente"]
            c = c * np.clip((p1 - df["pente_pct"].to_numpy()) / (p1 - p0), 0, 1)
        f_moy, f_ext = d["inondation"]
        c = c * np.where(df["inond_moyen"].to_numpy() == 1, f_moy, np.where(df["inond_extreme"].to_numpy() == 1, f_ext, 1.0))
        c = c * (1 - d["encrassement"] * df["n_trafic"].to_numpy())
        c = c * np.where(df["surface_chaussee_m2"].to_numpy() < 300, d["petite_surface"], 1.0)
        C[:, i] = c * df["dans_le_champ"].to_numpy()
    return C


def benefices(N, P, C):
    """B[s, m, g] = C[s, m] * P[m, g] * N[s, g]."""
    return C[:, :, None] * P[None, :, :] * N[:, None, :]


def scores(B, w):
    """Score par matériau (S x M) pour un vecteur de poids des enjeux w (somme 1)."""
    return B @ w
