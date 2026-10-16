# Rapport qualité de la base géospatiale

Base : `01_donnees/base_revetements.gpkg` — CRS Lambert-93 (EPSG:2154) — 21 couches.

## Couches

| Couche | Description | Objets | Géométrie | Géométries invalides |
|---|---|---|---|---|
| `ref_arrondissements` | Arrondissements municipaux (IGN BD TOPO) | 9 | MultiPolygon | 0 |
| `ref_territoire` | Territoire d'étude (union des arrondissements) | 1 | Polygon | 0 |
| `voi_troncons` | Tronçons de voirie : unité d'analyse (Métropole de Lyon + pentes RGE ALTI) | 7 702 | LineString | 0 |
| `voi_comptages` | Postes de comptage tous véhicules | 1 705 | Point | 0 |
| `mob_lignes_bus` | Lignes de bus TCL | 511 | MultiLineString | 0 |
| `mob_lignes_tram` | Lignes de tramway TCL | 16 | MultiLineString | 0 |
| `mob_couloirs_bus` | Couloirs de bus | 339 | MultiLineString | 0 |
| `mob_arrets_tc` | Arrêts de transport collectif | 1 617 | Point | 0 |
| `mob_cyclable` | Aménagements cyclables | 2 217 | MultiLineString | 0 |
| `reg_zfe` | Zone à faibles émissions | 1 | Polygon | 0 |
| `bat_batiments` | Bâtiments en service | 63 705 | MultiPolygon | 0 |
| `veg_arbres_alignement` | Arbres d'alignement (rayon de houppier) | 37 960 | Point | 0 |
| `veg_zones` | Zones de végétation (BD TOPO) | 3 806 | MultiPolygon | 0 |
| `veg_canopee_parcs` | Indice de canopée des parcs | 844 | Polygon | 0 |
| `clim_icu_metropole` | Îlots de chaleur urbains (Métropole de Lyon) | 7 465 | Polygon | 0 |
| `clim_lcz_cerema` | Zones climatiques locales (Cerema, SPOT 2022) | 4 331 | Polygon | 0 |
| `eq_sensibles` | Établissements accueillant des publics sensibles | 586 | MultiPolygon | 0 |
| `risq_inondation_moyen` | Aléa débordement — scénario moyen | 2 | MultiPolygon,Polygon | 0 |
| `risq_inondation_extreme` | Aléa débordement — scénario extrême | 2 | MultiPolygon | 0 |
| `hyd_surfaces_eau` | Surfaces en eau (BD TOPO) | 76 | MultiPolygon | 0 |
| `ref_grille200` | Grille INSEE 200 m + Filosofi 2021 | 1 910 | Polygon | 0 |

## Unité d'analyse : tronçons de voirie

- 7 702 tronçons, 749 km, 5.29 km² de chaussée.
- **Dans le champ de l'étude** (domanialité publique et revêtement bitumineux) : 7 061 tronçons, 4.93 km² (93% de la surface).
- Hors champ : 436 tronçons privés, 205 tronçons pavés, dallés ou bétonnés.

| Attribut | Renseigné à la source | Traitement du manque |
|---|---|---|
| Classe de trafic PL (T0-T5) | 47% | Mode des tronçons de même réseau PL, hiérarchie et desserte bus |
| Surface de chaussée | 83% | Longueur x largeur médiane du même type de voie |
| Pente moyenne | 83% | Calcul RGE ALTI (3 points par tronçon) |
| Trafic tous véhicules | 8% (comptage < 25 m) | Médiane des tronçons comptés de même type |

### Contrôle croisé des pentes (Métropole vs RGE ALTI)

Sur 5700 tronçons de plus de 30 m : corrélation de rang de Spearman = 0.69, écart absolu médian = 0.5 point de pente. La pente Métropole (relevé terrain) est retenue en priorité ; le RGE ALTI complète les manques.

### Points d'attention

- Pas d'information ouverte sur l'état de surface ni sur la date du dernier renouvellement : le calendrier est simulé (mission 4).
- La BD TOPO ne recense pas les crèches : la vulnérabilité « petite enfance » repose sur la population de 0-5 ans (Filosofi).
- Les carreaux Filosofi de moins de 11 ménages sont imputés par l'INSEE (`i_est_200 = 1`).
- 1.7% des hauteurs de bâtiments sont estimées (étages x 3 m ou médiane de l'usage).
- La pente RGE ALTI peut être surestimée sur les ouvrages d'art (tablier comparé au terrain naturel) : elle n'est utilisée qu'en complément.