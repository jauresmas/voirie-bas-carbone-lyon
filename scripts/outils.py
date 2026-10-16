"""Fonctions communes : accès WFS paginé, catalogue de données, journalisation."""
import csv
import datetime as dt
import json
import socket
import time

import geopandas as gpd
import requests
import urllib3.util.connection as urllib3_cn

from config import CATALOGUE, CRS

# Le poste résout mal certains hôtes en IPv6 : on force l'IPv4.
urllib3_cn.allowed_gai_family = lambda: socket.AF_INET

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "SIG-revetements-biosources/1.0 (recherche)"


def http_get(url, params=None, timeout=180, essais=5):
    for i in range(essais):
        try:
            r = SESSION.get(url, params=params, timeout=timeout)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            if i == essais - 1:
                raise
            attente = 5 * (i + 1)
            print(f"    ! {e.__class__.__name__}, nouvel essai dans {attente}s")
            time.sleep(attente)


def wfs(base, typename, bbox=None, cql=None, props=None, page=5000, sortby=None, srs=CRS):
    """GetFeature WFS 2.0 paginé, renvoie un GeoDataFrame dans `srs`."""
    feats, start = [], 0
    while True:
        p = {"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
             "TYPENAMES": typename, "OUTPUTFORMAT": "application/json",
             "SRSNAME": srs, "COUNT": page, "STARTINDEX": start}
        if bbox is not None:
            p["BBOX"] = "{},{},{},{},urn:ogc:def:crs:{}".format(*bbox, srs.replace(":", "::"))
        if cql:
            p["CQL_FILTER"] = cql
        if props:
            p["PROPERTYNAME"] = ",".join(props)
        if sortby:
            p["SORTBY"] = sortby
        r = http_get(base, p)
        lot = r.json().get("features", [])
        feats += lot
        print(f"    {typename}: +{len(lot)} (total {len(feats)})")
        if len(lot) < page:
            break
        start += page
    if not feats:
        return gpd.GeoDataFrame(geometry=[], crs=srs)
    gdf = gpd.GeoDataFrame.from_features(feats, crs=srs)
    ids = [f.get("id") for f in feats]
    if all(ids):
        gdf.insert(0, "fid_source", ids)
        gdf = gdf.drop_duplicates("fid_source")
    return gdf


CHAMPS_CATALOGUE = ["id_couche", "theme", "intitule", "producteur", "service", "source",
                    "millesime", "date_extraction", "licence", "emprise", "nb_objets",
                    "geometrie", "usage_projet", "fichier_brut"]


def cataloguer(**meta):
    """Ajoute/remplace une ligne du catalogue de données (traçabilité)."""
    meta.setdefault("date_extraction", dt.date.today().isoformat())
    lignes = []
    if CATALOGUE.exists():
        with open(CATALOGUE, encoding="utf-8-sig", newline="") as f:
            lignes = [l for l in csv.DictReader(f, delimiter=";") if l["id_couche"] != meta["id_couche"]]
    lignes.append({k: meta.get(k, "") for k in CHAMPS_CATALOGUE})
    with open(CATALOGUE, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, CHAMPS_CATALOGUE, delimiter=";")
        w.writeheader()
        w.writerows(sorted(lignes, key=lambda l: l["id_couche"]))


def ecrire_json(obj, chemin):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, default=str)
