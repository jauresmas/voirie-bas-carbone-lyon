# Réunion de projet — point d'avancement du volet SIG

**Objet :** présentation de l'outil d'aide à la décision (carte web `webmap/index.html`, mode Présentation) et décisions attendues des partenaires.

## Ordre du jour (45 min)

1. Démonstration : figures 0 à 9 de la carte web (20 min)
2. Matrice matériau-territoire : validation des hypothèses par les partenaires matériaux (10 min)
3. Pondérations : les cinq profils d'acteurs sont-ils les bons ? (5 min)
4. Scénarios 2030-2050 et suites (10 min)

## Décisions attendues

| # | Question | Qui | Pourquoi c'est bloquant |
|---|---|---|---|
| 1 | Valeurs d'albédo initial et vieilli de l'enrobé clair (R2) | Partenaires matériaux | Paramètre le plus influent : 27 % du top 20 % change avec la valeur basse |
| 2 | Durée de vie et réduction GES par tonne des quatre familles | Partenaires matériaux | Le gain carbone annualisé en dépend directement |
| 3 | Seuils de compatibilité trafic (R2 et R3 exclus à partir de T1 ?) | Partenaires matériaux, gestionnaire de voirie | Ils conditionnent l'accès des revêtements aux axes |
| 4 | Accès à l'état des chaussées et aux dates de renouvellement | Métropole de Lyon | Il remplacerait le calendrier simulé de la prospective |
| 5 | Choix des profils d'acteurs et atelier de pondération AHP | Comité de pilotage | Il permet de passer de pondérations illustratives à des pondérations validées |

## Résultats à retenir

- 1 145 tronçons (61 ha) sont prioritaires dans plus de 80 % des simulations : c'est le programme de départ.
- Les priorités « adaptation » et « bas-carbone » sont quasi disjointes : il faut choisir une stratégie ou les combiner (scénario S3).
- L'anticipation des renouvellements crée une dette carbone jusqu'en 2032 environ (S1).

## Prochaines étapes

- Intégrer les retours sur la matrice, puis relancer `scripts/run_all.py --sans-collecte` (environ 8 min).
- Atelier de pondération avec trois acteurs : matrices AHP saisies dans `scripts/04_amc.py`.
- Rédaction de l'article et du rapport final (`05_valorisation/rapport_methodologique.md`).
