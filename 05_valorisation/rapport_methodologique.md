# Où déployer des revêtements routiers à liants biosourcés ? Un outil SIG d'aide à la décision appliqué à Lyon

**Projet de recherche — rapport méthodologique**
Territoire pilote : Lyon (9 arrondissements) · Octobre 2026 · Chaîne de traitement : `scripts/` · Carte web : `webmap/index.html` · Projet QGIS : `05_valorisation/projet_revetements.qgz`

---

## Résumé

Les revêtements routiers à liants biosourcés réduisent l'empreinte carbone des chaussées. Selon leur formulation, ils peuvent aussi rafraîchir l'espace public (enrobés clairs) ou infiltrer l'eau (enrobés drainants). Leurs bénéfices dépendent toutefois du contexte : trafic poids lourds, ensoleillement, vulnérabilité des riverains, imperméabilisation, pente. Nous proposons un outil d'aide à la décision qui relie les propriétés de quatre familles de revêtements aux caractéristiques des 7 702 tronçons de la voirie lyonnaise.

L'outil articule une **matrice matériau-territoire**, qui encode la connaissance technique, et une **analyse multicritère AHP**, qui encode les préférences de cinq profils d'acteurs. Des simulations Monte-Carlo testent la robustesse du classement face à ces deux sources d'incertitude. Quatre scénarios prospectifs évaluent ensuite les stratégies de déploiement jusqu'en 2050.

Un **noyau de 1 145 tronçons (61 ha de chaussée)** reste prioritaire dans au moins 80 % des 3 000 tirages. Sur ces rues chaudes, ensoleillées et habitées, l'enrobé clair domine. Les priorités « adaptation » et « bas-carbone » sont quasi disjointes (ρ de Spearman = −0,26). Le carbone plaide pour la massification : jusqu'à 23,9 kt CO₂e évitées d'ici 2050 en scénario S2. L'adaptation plaide pour le ciblage, au prix d'une dette carbone transitoire quand on anticipe les renouvellements. L'albédo réel de l'enrobé clair est le paramètre matériau le plus influent : c'est l'essai prioritaire à mener avec les partenaires.

---

## 1. Données territoriales (mission 1)

### 1.1 Base géospatiale multi-sources

21 couches ont été extraites par services web (WFS, API) ou depuis les archives officielles. Chacune est horodatée et inscrite au catalogue `01_donnees/catalogue_donnees.csv`, avec producteur, service, millésime, licence, emprise, volume et usage dans le projet. Les données brutes sont conservées telles que livrées dans `01_donnees/brutes/`. La base de référence `01_donnees/base_revetements.gpkg` contient 21 couches normalisées en Lambert-93, décrites dans `dictionnaire_donnees.md`.

| Producteur | Couches | Contenu utile |
|---|---|---|
| Métropole de Lyon / SYTRAL | 11 | Voirie (trafic PL T0–T5, largeurs, surfaces, pentes, revêtement, structure), îlots de chaleur (LCZ, exposition et vulnérabilité jour/nuit), 55 940 arbres d'alignement, 2 014 postes de comptage, bus, tram, arrêts, cyclable, ZFE, canopée des parcs |
| IGN | 6 | BD TOPO (120 505 bâtiments, végétation, établissements, eau, arrondissements), 23 106 altitudes RGE ALTI |
| INSEE | 1 | Filosofi 2021, 1 538 carreaux de 200 m (population, âges, revenus, pauvreté) |
| Cerema | 1 | Zones climatiques locales et indicateurs morphologiques (SPOT 2022) |
| Géorisques | 2 | Aléa inondation par débordement (TRI de Lyon), scénarios moyen et extrême |

### 1.2 Qualité et traitement des manques

L'unité d'analyse est le **tronçon de voirie**, c'est-à-dire l'objet sur lequel se décide un chantier. Le territoire compte 7 702 tronçons, soit 749 km et 5,29 km² de chaussée. Le **champ de l'étude** retient la domanialité publique et le revêtement bitumineux. Il couvre 7 061 tronçons et 4,93 km², soit 93 % de la surface. Sont exclus 436 tronçons privés et 205 tronçons pavés, dallés ou bétonnés.

| Attribut | Renseigné à la source | Traitement |
|---|---|---|
| Classe de trafic PL | 47 % | Mode des tronçons de même réseau PL, hiérarchie fonctionnelle et desserte bus |
| Surface de chaussée | 83 % | Longueur × largeur médiane du même type de voie |
| Pente moyenne | 83 % | Calcul indépendant par le RGE ALTI (3 points par tronçon) |
| Trafic tous véhicules | 8 % (comptage à moins de 25 m) | Médiane des tronçons comptés de même type |

Pour contrôler les pentes, nous avons comparé le relevé de la Métropole et le calcul RGE ALTI sur 5 700 tronçons de plus de 30 m. La corrélation de Spearman est de 0,69 et l'écart absolu médian de 0,5 point de pente. Le relevé de la Métropole est retenu en priorité.

## 2. Indicateurs et matrice matériau-territoire (mission 2)

### 2.1 Indicateurs spatialisés

Les indicateurs de voisinage sont calculés par une méthode raster, à la fois rapide et transposable :
- canopée des houppiers rastérisée à 2 m et intersectée avec l'emprise de chaque rue ;
- moyennes focales à 5 m (25 m pour l'exposition ICU, 100 m pour les LCZ et la population), échantillonnées tous les 10 m le long des tronçons.

| Indicateur | Définition | Moyenne (champ) |
|---|---|---|
| Canopée sur la rue | Part de l'emprise de rue couverte par les houppiers | 8,9 % (médiane 0) |
| Rapport H/L | Hauteur moyenne du bâti riverain / largeur de rue | 1,41 (médiane 1,34) |
| Insolation | (1 − canopée) × (0,4 + 0,6 · SVF), SVF = cos(arctan 2H/L) | 0,60 |
| Exposition ICU jour / nuit | Classes Métropole (rafraîchissant, faible, moyen, fort) → 0 à 1 | 0,80 / 0,69 |
| Imperméabilisation | (bâti + voirie) des LCZ, voisinage de 100 m | 69 % |
| Densité, population sensible | Filosofi : habitants, 0–5 ans et 65 ans et plus par hectare | 138 / 30 hab/ha |

Les besoins **N** (0 à 1, normalisés entre les 2ᵉ et 98ᵉ centiles) combinent ces indicateurs en cinq enjeux :

- **Chaleur** = (0,45 exposition jour + 0,25 nuit + 0,30 potentiel LCZ) × (0,3 + 0,7 insolation)
- **Santé** = vulnérabilité × (0,3 + 0,7 insolation) × (0,5 + 0,5 besoin chaleur), où vulnérabilité = 0,35 population sensible + 0,25 précarité + 0,20 proximité d'un établissement sensible + 0,20 vulnérabilité ICU
- **Eau** = imperméabilisation du voisinage
- **Carbone** = 0,6 + 0,4 × taille du chantier (le gain par m² est uniforme)
- **Usages** = 0,30 apaisement + 0,15 cyclable + 0,20 arrêts TC + 0,35 densité

### 2.2 Matrice matériau-territoire

Quatre familles de revêtements biosourcés sont étudiées. Leurs propriétés sont des **hypothèses de travail** (bas / central / haut), issues d'ordres de grandeur, à consolider par les essais des partenaires matériaux.

| Code | Revêtement | Albédo | Réduction GES / t | Durée de vie | τ thermique | π hydro | γ carbone annualisé |
|---|---|---|---|---|---|---|---|
| R1 | Enrobé à liant biosourcé (substitution) | 0,08 / 0,10 / 0,12 | 30 / 45 / 60 % | 12 / 15 / 17 ans | 0,00 | 0 | 0,75 |
| R2 | Enrobé clair à liant végétal translucide | 0,28 / 0,36 / 0,45 | 15 / 30 / 45 % | 9 / 12 / 14 ans | 0,93 | 0 | 0,21 |
| R3 | Enrobé drainant à liant biosourcé | 0,10 / 0,12 / 0,15 | 20 / 35 / 50 % | 8 / 11 / 13 ans | 0,22 | 1 | 0,19 |
| R4 | Enrobé recyclé + régénérant biosourcé | 0,08 / 0,10 / 0,12 | 35 / 50 / 65 % | 13 / 15 / 17 ans | 0,00 | 0 | 0,83 |

Le gain carbone est **annualisé** : γ ∝ 1 − (1 − réduction) × 15 / durée de vie. Un revêtement moins durable est renouvelé plus souvent, ce qui réduit fortement le gain de l'enrobé clair et du drainant.

La compatibilité **C** traduit les contraintes du territoire :
- trafic PL (R2 et R3 exclus à partir de T1) ;
- ligne de bus (R2 × 0,5, R3 × 0,3) ;
- vitesse ≥ 50 km/h (R2 × 0,7, contraste du marquage) ;
- pente (R3 nul au-delà de 6 %) ;
- zone inondable (R3 × 0,3) ;
- encrassement et colmatage sous trafic (R2, R3) ;
- petits chantiers (R4 × 0,8).

Le bénéfice d'un revêtement *m* sur un tronçon *s* pour l'enjeu *g* vaut **B = C[s,m] × P[m,g] × N[s,g]**.

## 3. Analyse multicritère et robustesse (mission 3)

### 3.1 Profils d'acteurs (AHP)

| Profil | Chaleur | Santé | Eau | Carbone | Usages | RC |
|---|---|---|---|---|---|---|
| Équilibré (comité de pilotage) | 0,20 | 0,20 | 0,20 | 0,20 | 0,20 | 0,000 |
| Adaptation chaleur & santé | 0,35 | 0,35 | 0,12 | 0,07 | 0,12 | 0,001 |
| Bas-carbone (voirie, plan climat) | 0,12 | 0,12 | 0,12 | 0,57 | 0,07 | 0,003 |
| Eau & sols | 0,16 | 0,16 | 0,45 | 0,08 | 0,16 | 0,001 |
| Justice environnementale | 0,18 | 0,35 | 0,09 | 0,07 | 0,31 | 0,006 |

Le score d'un tronçon est le maximum sur les revêtements de Σ_g w_g · B. Le revêtement recommandé est celui qui atteint ce maximum. Les classes de priorité sont définies par part de surface : P1 = 10 % de la chaussée la plus apte, P2 = 10–30 %, P3 = 30–60 %, P4 = reste.

### 3.2 Résultats

| Profil | P1 (ha) | Revêtement dominant en P1 |
|---|---|---|
| Équilibré | 49,1 | R2 enrobé clair 95 %, R3 5 % |
| Adaptation | 49,2 | R2 100 % |
| Bas-carbone | 49,1 (161 tronçons, 53 km d'axes) | R4 recyclé + régénérant 100 % |
| Eau & sols | 49,2 | R3 enrobé drainant 100 % |
| Justice environnementale | 49,3 | R2 100 % |

**Deux logiques de priorité.** Quatre profils convergent (ρ de Spearman ≥ 0,90 entre eux). Le profil bas-carbone s'en écarte (ρ de −0,26 à −0,03). Ses 20 % prioritaires ne partagent qu'1 ha avec ceux du profil adaptation (indice de Jaccard ≈ 0). Le gain carbone, uniforme par m², oriente vers les grands chantiers des axes structurants en enrobé recyclé. Les enjeux d'adaptation ciblent les rues résidentielles ensoleillées et densément habitées.

### 3.3 Robustesse

Trois expériences Monte-Carlo de 1 000 tirages ont été menées :
- poids tirés uniformément sur le simplexe (Dirichlet) ;
- paramètres matériaux tirés selon des lois triangulaires ;
- les deux combinés.

| Statut | Tronçons | Chaussée |
|---|---|---|
| Prioritaire robuste (P(top 20 %) ≥ 80 %) | 1 145 | 61 ha |
| Prioritaire probable (50–80 %) | 597 | 30 ha |
| Prioritaire incertain (20–50 %) | 613 | 34 ha |
| Rarement prioritaire (< 20 %) | 4 706 | 368 ha |

Sur les tronçons robustes, le revêtement le plus souvent recommandé est l'enrobé clair (82 % des tronçons, 87 % de la surface), puis le drainant (18 % des tronçons, 13 % de la surface). La stabilité du choix de revêtement y est de 54 % en moyenne : le *lieu* est plus sûr que le *matériau*.

**Sensibilité un-à-un.** Une variation de ±25 % d'un poids conserve au moins 89 % du top 20 % (Jaccard ≥ 0,89, pire cas pour l'eau). Parmi les paramètres matériaux, l'**albédo bas de l'enrobé clair** (0,28) est le plus influent : il modifie 27 % du top 20 % et fait changer de revêtement 25 % de la surface. Viennent ensuite la réduction GES haute du drainant (Jaccard 0,83) et sa durée de vie haute (0,88).

## 4. Prospective 2026-2050 (mission 4)

**Hypothèses communes :**
- couche de roulement renouvelée tous les 15 ans en conventionnel, avec une phase initiale aléatoire par tronçon (aucune donnée ouverte sur l'âge des chaussées) ;
- couche de 6 cm, 2,35 t/m³, facteur d'émission de référence 55 kg CO₂e/t (45–70) ;
- réchauffement de référence TRACC : +2,0 °C en 2030, +2,7 °C en 2050, soit +30 % du besoin chaleur par °C au-delà de 2025 ;
- vieillissement : +25 % de vulnérabilité en 2050 ;
- pluie annuelle 0,83 m, coefficients de ruissellement 0,90 (conventionnel) et 0,30 (drainant).

| Scénario | Récit | Part innovante des renouvellements |
|---|---|---|
| S0 Tendanciel | Opérations ponctuelles, non ciblées, R1/R4 | 5 % → 25 % |
| S1 Adaptation ciblée | Profil adaptation, renouvellement anticipé des 10 % prioritaires (2027-2032) | 20 % → 60 % |
| S2 Massification bas-carbone | Filière structurée, profil bas-carbone | 30 % → 100 % en 2040 |
| S3 Transition intégrée | Trafic −30 %, rues de desserte apaisées, plan canopée ; profil équilibré réévalué tous les 5 ans, anticipation | 25 % → 90 % en 2045 |

| 2050 | Traité (ha) | Part de la chaussée | GES évités cumulés (t CO₂e, médiane [p10–p90]) | Habitants bénéficiaires* | Ruissellement évité (m³/an) | P1–P2 couverts |
|---|---|---|---|---|---|---|
| S0 | 126 | 26 % | 5 597 [4 364–6 493] | 0 | 0 | 25 % |
| S1 | 237 | 48 % | 4 823 [152–7 420] | 254 000 | 4 100 | 99 % |
| S2 | 476 | 97 % | 23 932 [21 112–28 935] | 1 800 | 0 | 96 % |
| S3 | 394 | 80 % | 10 728 [8 175–14 599] | 267 000 | 218 000 | 100 % |

\* Population riveraine pondérée par la part de chaussée de son carreau traitée en enrobé clair ou drainant.

**Dette carbone de l'anticipation.** Renouveler tôt les rues prioritaires émet davantage que le calendrier normal. En 2030, le bilan cumulé de S1 est de −286 t CO₂e (intervalle −623 à +66), et ne redevient positif qu'après 2032. L'adaptation se paie donc d'un coût carbone transitoire.

**Ce que 2050 change.** Sous S3, 3 885 tronçons gagnent plus de 0,02 point d'aptitude : la chaleur s'intensifie, la population vieillit, et l'apaisement des rues de desserte rend les enrobés clairs et drainants compatibles sur davantage de voies.

## 5. Enseignements, limites et suites

**Enseignements**
1. Un programme de départ robuste existe (61 ha) et ne dépend pas des choix de pondération.
2. Le choix du revêtement est plus incertain que le choix du lieu : il dépend surtout des performances réelles des matériaux.
3. Carbone et adaptation appellent deux stratégies différentes (massification contre ciblage). La transition intégrée (S3) les concilie le mieux.

**Limites**
- Propriétés des matériaux non mesurées (hypothèses à fourchettes).
- Calendrier de renouvellement simulé.
- LCZ et ICU sont des pré-diagnostics morphologiques, pas des températures mesurées.
- Perméabilité des sols supports inconnue.
- 53 % des classes de trafic PL sont imputées.
- Pas de crèches dans la BD TOPO.

**Suites proposées aux partenaires du projet**
1. Essais d'albédo initial et vieilli de l'enrobé clair, puis réévaluation de la matrice.
2. Intégration de l'état des chaussées et des dates de renouvellement du gestionnaire.
3. Sondages de perméabilité sur les tronçons aptes au drainant.
4. Campagne de mesures thermiques sur les sept postes de la démonstration.
5. Transposition à une seconde métropole : le socle IGN, INSEE, Cerema et Géorisques est national, il suffit de changer `TERRITOIRE` dans `scripts/config.py`.

## Annexe : cartes

Les cartes A4 (projet QGIS) se trouvent dans `05_valorisation/cartes/` :
1. trafic PL ;
2. besoin chaleur ;
3. aptitude R3 ;
4. priorités (profil équilibré) ;
5. robustesse ;
6. déploiement S3 en 2040 ;
7. évolution 2050 ;
8. programme de départ.
