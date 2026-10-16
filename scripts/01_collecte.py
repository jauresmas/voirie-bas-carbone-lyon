"""Mission 1a — Collecte des données brutes multi-sources.

Chaque couche est extraite par service web (WFS) ou depuis l'archive officielle,
enregistrée telle quelle dans 01_donnees/brutes/<producteur>/ et inscrite au
catalogue (01_donnees/catalogue_donnees.csv).
"""
import io
import json
import re
import sys
import zipfile

import geopandas as gpd
import pandas as pd
from shapely.geometry import box

from config import (BRUT, BUFFER_COLLECTE, CRS, CRS_GRILLE, TERRITOIRE, URL_FILOSOFI, URL_LCZ,
                    WFS_GEORISQUES, WFS_GRANDLYON, WFS_IGN)
from outils import cataloguer, http_get, wfs

LO = "Licence Ouverte v2.0 (Etalab)"
LO_GL = "Licence Ouverte v2.0 (Etalab) — à confirmer sur la fiche data.grandlyon.com"
SEULEMENT = set(sys.argv[1:])  # relancer une seule couche : python 01_collecte.py gl_voirie


def sauver(gdf, producteur, nom):
    dossier = BRUT / producteur
    dossier.mkdir(parents=True, exist_ok=True)
    gdf = gdf.copy()
    for c in gdf.columns:
        if c != gdf.geometry.name and gdf[c].map(lambda v: isinstance(v, (list, dict))).any():
            gdf[c] = gdf[c].map(lambda v: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v)
    chemin = dossier / f"{nom}.gpkg"
    gdf.to_file(chemin, layer=nom, driver="GPKG")
    print(f"  -> {chemin.relative_to(BRUT.parent.parent)} ({len(gdf)} objets)")
    return chemin


def faire(id_couche):
    return not SEULEMENT or id_couche in SEULEMENT


# ---------------------------------------------------------------- territoire
print("1. Territoire d'étude")
codes = TERRITOIRE["codes_insee"]
liste = ",".join(f"'{c}'" for c in codes)
terr = wfs(WFS_IGN, "BDTOPO_V3:arrondissement_municipal", cql=f"code_insee IN ({liste})")
if terr.empty:
    raise SystemExit("Limites administratives introuvables")
chemin = sauver(terr, "ign_bdtopo", "arrondissements")
cataloguer(id_couche="ign_arrondissements", theme="Administratif", intitule="Arrondissements municipaux",
           producteur="IGN", service="WFS Géoplateforme BDTOPO_V3:arrondissement_municipal",
           source=WFS_IGN, millesime="BD TOPO en continu", licence=LO, emprise=TERRITOIRE["nom"],
           nb_objets=len(terr), geometrie="MultiPolygon", usage_projet="Emprise d'étude, agrégations",
           fichier_brut=str(chemin.relative_to(BRUT.parent)))

zone = terr.union_all().buffer(BUFFER_COLLECTE)
bbox = tuple(round(v) for v in zone.bounds)
print("   emprise de collecte (L93):", bbox)

# ---------------------------------------------------------------- IGN BD TOPO
COUCHES_IGN = [
    ("ign_batiment", "BDTOPO_V3:batiment", "batiment",
     ["cleabs", "nature", "usage_1", "hauteur", "nombre_d_etages", "construction_legere", "etat_de_l_objet", "geometrie"],
     "Bâti", "Bâtiments (hauteur, usage)", "Morphologie urbaine : rapport H/L des rues, ombrage"),
    ("ign_vegetation", "BDTOPO_V3:zone_de_vegetation", "zone_de_vegetation",
     ["cleabs", "nature", "geometrie"],
     "Occupation du sol", "Zones de végétation", "Végétation de proximité, perméabilité"),
    ("ign_interet", "BDTOPO_V3:zone_d_activite_ou_d_interet", "zone_activite_interet",
     ["cleabs", "categorie", "nature", "nature_detaillee", "toponyme", "geometrie"],
     "Équipements", "Zones d'activité ou d'intérêt", "Établissements sensibles (enseignement, santé, petite enfance)"),
    ("ign_hydro", "BDTOPO_V3:surface_hydrographique", "surface_hydrographique",
     ["cleabs", "nature", "geometrie"],
     "Hydrographie", "Surfaces hydrographiques", "Fond cartographique, proximité des cours d'eau"),
]
print("2. IGN BD TOPO")
for idc, typ, nom, props, theme, intitule, usage in COUCHES_IGN:
    if not faire(idc):
        continue
    g = wfs(WFS_IGN, typ, bbox=bbox, props=props)
    chemin = sauver(g, "ign_bdtopo", nom)
    cataloguer(id_couche=idc, theme=theme, intitule=intitule, producteur="IGN",
               service=f"WFS Géoplateforme {typ}", source=WFS_IGN, millesime="BD TOPO en continu",
               licence=LO, emprise=f"{TERRITOIRE['nom']} + {BUFFER_COLLECTE} m", nb_objets=len(g),
               geometrie=",".join(sorted(g.geom_type.unique())), usage_projet=usage,
               fichier_brut=str(chemin.relative_to(BRUT.parent)))

# ---------------------------------------------------------------- Métropole de Lyon
cql_insee = f"insee1 IN ({liste}) OR insee2 IN ({liste})"
COUCHES_GL = [
    ("gl_voirie", "metropole-de-lyon:pvo_patrimoine_voirie.pvochausseetrottoir", "voirie_chaussee_trottoir", None, cql_insee,
     "Réseau routier", "Patrimoine voirie : chaussées et trottoirs",
     "Unité d'analyse : tronçons, trafic PL (T0-T5), largeur, pente, revêtement, structure"),
    ("gl_icu", "metropole-de-lyon:ilots-de-chaleur-urbains", "ilots_chaleur_urbains", bbox, None,
     "Climat urbain", "Îlots de chaleur urbains (LCZ, exposition et vulnérabilité jour/nuit)",
     "Exposition à la chaleur, vulnérabilité"),
    ("gl_arbres", "metropole-de-lyon:abr_arbres_alignement.abrarbre", "arbres_alignement", bbox, None,
     "Végétation", "Arbres d'alignement", "Ombrage des chaussées (houppiers)"),
    ("gl_couloirs_bus", "metropole-de-lyon:pvo_patrimoine_voirie.couloirdebus", "couloirs_bus", bbox, None,
     "Mobilités", "Couloirs de bus", "Sollicitations mécaniques canalisées"),
    ("gl_lignes_bus", "sytral:tcl_sytral.tcllignebus_2_0_0", "lignes_bus", bbox, None,
     "Mobilités", "Lignes de bus TCL", "Sollicitations mécaniques, desserte"),
    ("gl_lignes_tram", "sytral:tcl_sytral.tcllignetram_2_0_0", "lignes_tram", bbox, None,
     "Mobilités", "Lignes de tramway TCL", "Fond cartographique"),
    ("gl_arrets_tc", "sytral:tcl_sytral.tclarret", "arrets_tc", bbox, None,
     "Mobilités", "Arrêts TCL", "Intensité des usages piétons"),
    ("gl_comptages", "metropole-de-lyon:pvo_patrimoine_voirie.pvocomptagecriter", "comptages_trafic", bbox, None,
     "Mobilités", "Postes de comptage du trafic (moyenne jours ouvrables)", "Calage du trafic tous véhicules"),
    ("gl_cyclable", "metropole-de-lyon:pvo_patrimoine_voirie.pvoamenagementcyclable", "amenagements_cyclables", bbox, None,
     "Mobilités", "Aménagements cyclables", "Usages actifs de l'espace public"),
    ("gl_zfe", "metropole-de-lyon:eco_ecologie.zfe", "zfe", None, None,
     "Réglementation", "Zone à faibles émissions", "Contexte prospectif mobilités"),
    ("gl_canopee_parcs", "metropole-de-lyon:evg_esp_veg.evgparcindiccanope_latest", "canopee_parcs", bbox, None,
     "Végétation", "Indice de canopée des parcs", "Îlots de fraîcheur"),
]
print("3. Métropole de Lyon (data.grandlyon.com)")
for idc, typ, nom, bb, cql, theme, intitule, usage in COUCHES_GL:
    if not faire(idc):
        continue
    g = wfs(WFS_GRANDLYON, typ, bbox=bb, cql=cql, sortby="gid")
    chemin = sauver(g, "metropole_lyon", nom)
    cataloguer(id_couche=idc, theme=theme, intitule=intitule, producteur="Métropole de Lyon / SYTRAL",
               service=f"WFS data.grandlyon.com {typ}", source=WFS_GRANDLYON, millesime="flux en continu",
               licence=LO_GL, emprise=TERRITOIRE["nom"] if cql else f"{TERRITOIRE['nom']} + {BUFFER_COLLECTE} m",
               nb_objets=len(g), geometrie=",".join(sorted(g.geom_type.unique())), usage_projet=usage,
               fichier_brut=str(chemin.relative_to(BRUT.parent)))

# ---------------------------------------------------------------- Géorisques
print("4. Géorisques — aléa débordement de cours d'eau (TRI)")
ALEAS = [("georisques_inond_moyen", "ms:ALEA_SYNT_01_02MOY_FXX", "alea_debordement_moyen", "scénario moyen"),
         ("georisques_inond_faible", "ms:ALEA_SYNT_01_04FAI_FXX", "alea_debordement_extreme", "scénario extrême")]
for idc, typ, nom, scen in ALEAS:
    if not faire(idc):
        continue
    p = {"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": typ,
         "SRSNAME": "EPSG:2154", "BBOX": "{},{},{},{},urn:ogc:def:crs:EPSG::2154".format(*bbox)}
    r = http_get(WFS_GEORISQUES, p)
    g = gpd.read_file(io.BytesIO(r.content))
    g = g.set_crs(CRS, allow_override=True) if g.crs is None else g.to_crs(CRS)
    chemin = sauver(g, "georisques", nom)
    cataloguer(id_couche=idc, theme="Risques", intitule=f"Aléa inondation par débordement — {scen} (TRI)",
               producteur="MTECT / DREAL (Géorisques)", service=f"WFS Géorisques {typ}", source=WFS_GEORISQUES,
               millesime="cartographie Directive Inondation", licence=LO,
               emprise=f"{TERRITOIRE['nom']} + {BUFFER_COLLECTE} m", nb_objets=len(g),
               geometrie=",".join(sorted(g.geom_type.unique())) if len(g) else "",
               usage_projet="Contrainte pour les enrobés drainants (infiltration, colmatage)",
               fichier_brut=str(chemin.relative_to(BRUT.parent)))

# ---------------------------------------------------------------- INSEE Filosofi
if faire("insee_filosofi"):
    print("5. INSEE Filosofi 2021 — carreaux 200 m")
    zf = BRUT / "insee_filosofi" / "Filosofi2021_carreaux_200m_csv.zip"
    if not zf.exists():
        zf.parent.mkdir(parents=True, exist_ok=True)
        zf.write_bytes(http_get(URL_FILOSOFI, timeout=900).content)
    zone3035 = gpd.GeoSeries([zone], crs=CRS).to_crs(CRS_GRILLE).iloc[0]
    xmin, ymin, xmax, ymax = zone3035.bounds
    motif = re.compile(r"N(\d+)E(\d+)")
    morceaux = []
    with zipfile.ZipFile(zf) as z, z.open("carreaux_200m_met.csv") as f:
        for bloc in pd.read_csv(f, sep=",", chunksize=400_000, dtype={"lcog_geo": str}):
            bloc.columns = [c.lower() for c in bloc.columns]
            ne = bloc["idcar_200m"].str.extract(motif).astype(float)
            dedans = (ne[1] >= xmin - 200) & (ne[1] <= xmax) & (ne[0] >= ymin - 200) & (ne[0] <= ymax)
            if dedans.any():
                b = bloc[dedans].copy()
                b["y0"], b["x0"] = ne.loc[dedans, 0], ne.loc[dedans, 1]
                morceaux.append(b)
    car = pd.concat(morceaux, ignore_index=True)
    geom = [box(x, y, x + 200, y + 200) for x, y in zip(car.x0, car.y0)]
    car = gpd.GeoDataFrame(car.drop(columns=["x0", "y0"]), geometry=geom, crs=CRS_GRILLE)
    car = car[car.intersects(zone3035)]
    chemin = sauver(car, "insee_filosofi", "filosofi2021_carreaux200m")
    cataloguer(id_couche="insee_filosofi", theme="Socio-économie",
               intitule="Revenus, pauvreté, structure par âge et logement au carreau de 200 m (Filosofi 2021)",
               producteur="INSEE", service="Téléchargement fichier CSV (zip national)", source=URL_FILOSOFI,
               millesime="revenus 2021 (publication 2026)", licence=LO,
               emprise=f"{TERRITOIRE['nom']} + {BUFFER_COLLECTE} m", nb_objets=len(car), geometrie="Polygon (carreau 200 m, EPSG:3035)",
               usage_projet="Densité, populations sensibles (0-5 ans, 65 ans et +), précarité",
               fichier_brut=str(chemin.relative_to(BRUT.parent)))

# ---------------------------------------------------------------- Cerema LCZ
if faire("cerema_lcz"):
    print("6. Cerema — LCZ SPOT 2022")
    zl = BRUT / "lcz_cerema" / "lcz-spot-2022-lyon.zip"
    if not zl.exists():
        zl.parent.mkdir(parents=True, exist_ok=True)
        zl.write_bytes(http_get(URL_LCZ, timeout=1800).content)
    lcz = gpd.read_file(f"/vsizip/{zl.as_posix()}/LCZ_SPOT_2022_Lyon.shp", bbox=bbox)
    lcz = lcz.to_crs(CRS)
    lcz = lcz[lcz.intersects(zone)]
    chemin = sauver(lcz, "cerema_lcz", "lcz_spot2022")
    cataloguer(id_couche="cerema_lcz", theme="Climat urbain",
               intitule="Zones climatiques locales (LCZ) et indicateurs morphologiques (hre, bur, ror, ver...)",
               producteur="Cerema", service="Téléchargement data.gouv.fr (zip aire urbaine de Lyon)", source=URL_LCZ,
               millesime="SPOT 2022 (mise à jour 12/2024)", licence=LO,
               emprise=f"{TERRITOIRE['nom']} + {BUFFER_COLLECTE} m", nb_objets=len(lcz), geometrie="Polygon",
               usage_projet="Potentiel d'îlot de chaleur, imperméabilisation, végétation (socle national transposable)",
               fichier_brut=str(chemin.relative_to(BRUT.parent)))

print("Collecte terminée.")
