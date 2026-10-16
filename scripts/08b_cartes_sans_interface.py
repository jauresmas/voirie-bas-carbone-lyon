"""Régénère le projet QGIS et les cartes sans ouvrir l'interface de QGIS (Python embarqué de QGIS).

    "C:\\Program Files\\QGIS 3.34.12\\bin\\python-qgis-ltr.bat" scripts\\08b_cartes_sans_interface.py

Le moteur graphique Windows est conservé (aucune fenêtre n'est ouverte) : le mode « offscreen »
de Qt ne charge pas les polices et produirait des textes illisibles.
"""
import os

from qgis.core import QgsApplication

app = QgsApplication([], True)
app.initQgis()
__file__ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "08_projet_qgis.py")
exec(open(__file__, encoding="utf-8").read())
app.exitQgis()
