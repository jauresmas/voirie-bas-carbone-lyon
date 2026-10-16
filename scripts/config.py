"""Paramètres généraux de la chaîne de traitement.

Changer de territoire : modifier TERRITOIRE (codes INSEE) puis relancer run_all.py.
Les sources « Métropole de Lyon » sont propres à Lyon ; ailleurs, la chaîne
retombe sur le socle national (IGN BD TOPO, INSEE, Cerema, Géorisques).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "01_donnees"
BRUT = DATA / "brutes"
TRAIT = DATA / "traitees"
GPKG = DATA / "base_revetements.gpkg"          # base géospatiale de référence
CATALOGUE = DATA / "catalogue_donnees.csv"
IND = ROOT / "02_indicateurs"
AMC = ROOT / "03_amc"
PROSP = ROOT / "04_prospective"
VALO = ROOT / "05_valorisation"
WEB = ROOT / "webmap"

CRS = "EPSG:2154"          # Lambert-93, CRS de calcul
CRS_GRILLE = "EPSG:3035"   # LAEA Europe, CRS de la grille INSEE 200 m
CRS_WEB = "EPSG:4326"

TERRITOIRE = {
    "nom": "Lyon",
    "code_commune": "69123",
    "codes_insee": [f"6938{i}" for i in range(1, 10)],  # 9 arrondissements
}
BUFFER_COLLECTE = 500  # m autour du territoire, pour les indicateurs de voisinage

# Services
WFS_IGN = "https://data.geopf.fr/wfs/ows"
WFS_GRANDLYON = "https://data.grandlyon.com/geoserver/ows"
WFS_GEORISQUES = "https://www.georisques.gouv.fr/services"
URL_FILOSOFI = "https://www.insee.fr/fr/statistiques/fichier/8735162/Filosofi2021_carreaux_200m_csv.zip"
URL_LCZ = ("https://static.data.gouv.fr/resources/cartographie-des-zones-climatiques-locales-lcz-de-83-"
           "aires-urbaines-de-plus-de-50-000-habitants-2022/20241210-104307/lcz-spot-2022-lyon.zip")

SEED = 2026
