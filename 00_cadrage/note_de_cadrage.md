# Note de cadrage — SIG et aide à la décision, projet de recherche

**Objet :** outil d'aide à la décision (SIG + analyse multicritère) pour identifier les secteurs où le déploiement de revêtements routiers à liants biosourcés est le plus pertinent, et évaluer des stratégies de déploiement à l'horizon 2030-2050.

**Territoire pilote :** Lyon (9 arrondissements, 69123), 519 000 habitants, 48 km².
Choix motivé par : (1) un îlot de chaleur urbain marqué (climat semi-continental, épisodes caniculaires 2003, 2019, 2022), (2) un patrimoine de voirie décrit finement en open data (classe de trafic poids lourds, structure, largeur, pente et revêtement par tronçon), (3) la disponibilité d'un socle national (IGN, INSEE, Cerema, Géorisques) qui rend la méthode **transposable** à d'autres territoires (paramètre `TERRITOIRE` de `scripts/config.py`).

## 1. Questions de recherche

1. Quelles caractéristiques territoriales conditionnent les bénéfices thermiques, hydrologiques, carbone et sociaux d'un revêtement biosourcé ?
2. Comment traduire les propriétés des matériaux (thermiques, mécaniques, hydrologiques, durabilité) en indicateurs spatialisés ?
3. Où déployer en priorité, et ce classement résiste-t-il aux choix de pondération et aux incertitudes sur les matériaux ?
4. Quels gains attendre en 2030, 2040 et 2050 selon les stratégies de déploiement et les trajectoires territoriales ?

## 2. Livrables par mission

| Mission | Livrables | Emplacement |
|---|---|---|
| 1. Structuration des données | Base géospatiale multi-sources, catalogue et dictionnaire de données, rapport qualité | `01_donnees/` |
| 2. Indicateurs territoriaux | Fiches indicateurs, matrice matériau-territoire, couches d'indicateurs | `02_indicateurs/` |
| 3. Analyse multicritère | Pondérations AHP par profil d'acteurs, cartes d'aptitude, analyse de robustesse | `03_amc/` |
| 4. Prospective 2030-2050 | Scénarios, simulation de déploiement, indicateurs d'impact | `04_prospective/` |
| 5. Valorisation | Rapport méthodologique, résumé de communication, cartes, projet QGIS, carte web | `05_valorisation/`, `webmap/` |

## 3. Principes méthodologiques

- **Unité d'analyse :** le tronçon de voirie (objet sur lequel se décide un chantier de renouvellement), complété par la **grille INSEE de 200 m** pour les cartes d'aptitude territoriale.
- **Séparation expertise / préférences :** la *matrice matériau-territoire* encode la connaissance technique (ce qu'un matériau apporte et supporte selon le contexte) ; les *pondérations AHP* encodent les priorités des décideurs (profils d'acteurs). Les deux sont testées séparément en robustesse.
- **Traçabilité :** chaque donnée est extraite par service web ou depuis l'archive officielle, horodatée et cataloguée ; toute la chaîne est rejouable (`scripts/run_all.py`).
- **Incertitude explicite :** les propriétés des matériaux sont des hypothèses de travail (fourchettes basse/centrale/haute) à consolider avec les essais des partenaires matériaux du projet.

## 4. Limites connues dès le cadrage

- Pas de donnée ouverte sur l'**état structurel** des chaussées (indice de dégradation, date du dernier renouvellement) : le calendrier de renouvellement est simulé.
- Les LCZ et l'exposition ICU sont des **pré-diagnostics morphologiques**, pas des mesures de température.
- Pas de donnée ouverte sur la **perméabilité des sols supports** : l'aptitude des enrobés drainants reste indicative (à vérifier par sondages).

## 5. Planning indicatif (24 semaines)

| Semaines | Activité | Jalon |
|---|---|---|
| S1-S3 | Bibliographie matériaux et AMC, cadrage, inventaire des données | Réunion de lancement du projet |
| S4-S7 | Collecte, base géospatiale, contrôle qualité | Catalogue de données validé |
| S8-S11 | Indicateurs, matrice matériau-territoire (avec partenaires matériaux) | Atelier matrice |
| S12-S15 | AMC, pondérations par profils d'acteurs, robustesse | Comité de suivi |
| S16-S19 | Scénarios prospectifs 2030-2050 | Atelier scénarios |
| S20-S24 | Rapport, carte web, communication scientifique | Séminaire de recherche |
