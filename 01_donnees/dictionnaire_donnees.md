# Dictionnaire de données — base_revetements.gpkg

Généré automatiquement par `scripts/02_base_donnees.py`. Tous les objets sont en Lambert-93 (EPSG:2154).

## `ref_arrondissements`

Arrondissements municipaux (IGN BD TOPO)

| Champ | Type |
|---|---|
| `insee` | object |
| `nom` | object |

## `ref_territoire`

Territoire d'étude (union des arrondissements)

| Champ | Type |
|---|---|
| `nom` | object |
| `code` | object |
| `surface_km2` | float64 |

## `voi_troncons`

Tronçons de voirie : unité d'analyse (Métropole de Lyon + pentes RGE ALTI)

| Champ | Type |
|---|---|
| `id_troncon` | object |
| `nom_voie` | object |
| `insee` | object |
| `arrondissement` | object |
| `domanialite` | object |
| `hierarchie` | object |
| `vitesse_kmh` | float64 |
| `zone_apaisee` | object |
| `ligne_bus` | object |
| `reseau_pl` | object |
| `structure` | object |
| `classe_pl` | object |
| `largeur_chaussee_m` | float64 |
| `surface_chaussee_m2` | float64 |
| `pente_moy_gl` | float64 |
| `pente_max_gl` | float64 |
| `nb_voies` | float64 |
| `revetement` | object |
| `larg_trottoirs_m` | float64 |
| `surf_trottoirs_m2` | float64 |
| `longueur_m` | float64 |
| `bus` | int32 |
| `bus_site_propre` | int32 |
| `public` | int32 |
| `revetement_bitumineux` | int32 |
| `classe_pl_source` | object |
| `pl_jour_sens` | int64 |
| `surface_source` | object |
| `altitude_m` | float64 |
| `pente_rgealti` | float64 |
| `pente_pct` | float64 |
| `pente_source` | object |
| `tmjo_mesure` | float64 |
| `tmjo_veh_j` | float64 |
| `tmjo_source` | object |
| `dans_le_champ` | int32 |

## `voi_comptages`

Postes de comptage tous véhicules

| Champ | Type |
|---|---|
| `nom` | object |
| `tmjo_veh_j` | float64 |
| `debithorairemax` | float64 |
| `anneereference` | float64 |

## `mob_lignes_bus`

Lignes de bus TCL

| Champ | Type |
|---|---|
| `ligne` | object |
| `nom_trace` | object |
| `famille_transport` | object |
| `couleur_hex` | object |

## `mob_lignes_tram`

Lignes de tramway TCL

| Champ | Type |
|---|---|
| `ligne` | object |
| `nom_trace` | object |
| `couleur_hex` | object |

## `mob_couloirs_bus`

Couloirs de bus

| Champ | Type |
|---|---|
| `nomvoie` | object |
| `environnementcouloir` | object |
| `largeur` | float64 |
| `anneerealisation` | float64 |

## `mob_arrets_tc`

Arrêts de transport collectif

| Champ | Type |
|---|---|
| `nom` | object |
| `desserte` | object |

## `mob_cyclable`

Aménagements cyclables

| Champ | Type |
|---|---|
| `nom` | object |
| `typeamenagement` | object |
| `reseau` | object |
| `anneelivraison` | float64 |

## `reg_zfe`

Zone à faibles émissions

| Champ | Type |
|---|---|
| `vp_critair` | object |
| `date_debut` | object |

## `bat_batiments`

Bâtiments en service

| Champ | Type |
|---|---|
| `cleabs` | object |
| `usage_1` | object |
| `hauteur` | float64 |
| `nombre_d_etages` | float64 |
| `hauteur_source` | object |

## `veg_arbres_alignement`

Arbres d'alignement (rayon de houppier)

| Champ | Type |
|---|---|
| `identifiant` | int64 |
| `essence` | object |
| `genre` | object |
| `hauteurtotale_m` | float64 |
| `rayon_houppier_m` | float64 |
| `anneeplantation` | float64 |
| `nomvoie` | object |

## `veg_zones`

Zones de végétation (BD TOPO)

| Champ | Type |
|---|---|
| `nature` | object |

## `veg_canopee_parcs`

Indice de canopée des parcs

| Champ | Type |
|---|---|
| `nom` | object |
| `indiccanop` | float64 |

## `clim_icu_metropole`

Îlots de chaleur urbains (Métropole de Lyon)

| Champ | Type |
|---|---|
| `lcz_code` | object |
| `lcz_lib` | object |
| `expo_jour` | object |
| `expo_nuit` | object |
| `vulnerabilite_jour` | object |
| `vulnerabilite_nuit` | object |
| `s_expo_jour` | float64 |
| `s_expo_nuit` | float64 |
| `s_vulnerabilite_jour` | float64 |
| `s_vulnerabilite_nuit` | float64 |

## `clim_lcz_cerema`

Zones climatiques locales (Cerema, SPOT 2022)

| Champ | Type |
|---|---|
| `identifier` | object |
| `hre` | float64 |
| `are` | float64 |
| `bur` | float64 |
| `ror` | float64 |
| `bsr` | float64 |
| `war` | float64 |
| `ver` | float64 |
| `vhr` | float64 |
| `lcz` | object |
| `lcz_int` | int32 |

## `eq_sensibles`

Établissements accueillant des publics sensibles

| Champ | Type |
|---|---|
| `toponyme` | object |
| `nature` | object |
| `type_sensible` | object |

## `risq_inondation_moyen`

Aléa débordement — scénario moyen

| Champ | Type |
|---|---|
| `cours_deau` | object |
| `scenario` | object |
| `id_tri` | object |

## `risq_inondation_extreme`

Aléa débordement — scénario extrême

| Champ | Type |
|---|---|
| `cours_deau` | object |
| `scenario` | object |
| `id_tri` | object |

## `hyd_surfaces_eau`

Surfaces en eau (BD TOPO)

| Champ | Type |
|---|---|
| `nature` | object |

## `ref_grille200`

Grille INSEE 200 m + Filosofi 2021

| Champ | Type |
|---|---|
| `idcar_200m` | object |
| `ind` | float64 |
| `men` | float64 |
| `men_pauv` | float64 |
| `ind_snv` | float64 |
| `ind_0_3` | float64 |
| `ind_4_5` | float64 |
| `ind_65_79` | float64 |
| `ind_80p` | float64 |
| `log_soc` | float64 |
| `i_est_200` | float64 |
| `dans_territoire` | int32 |
| `pop` | float64 |
| `densite_hab_ha` | float64 |
| `pop_sensible` | float64 |
| `part_sensible` | float64 |
| `niveau_vie_moy` | float64 |
| `taux_pauvrete_men` | float64 |
| `part_log_soc` | float64 |
