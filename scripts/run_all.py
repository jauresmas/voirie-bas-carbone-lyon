"""Rejoue toute la chaîne de traitement, de la collecte à l'export web.

    python run_all.py            # tout (collecte comprise, quelques minutes de téléchargement)
    python run_all.py --sans-collecte

Le projet QGIS se reconstruit ensuite dans la console Python de QGIS avec 08_projet_qgis.py.
"""
import subprocess
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
ETAPES = ["01_collecte.py", "02_base_donnees.py", "03_indicateurs.py", "04_amc.py", "05_prospective.py",
          "06_export_web.py", "07_synthese_sig.py", "09_export_grand_public.py"]
if "--sans-collecte" in sys.argv:
    ETAPES = ETAPES[1:]

for e in ETAPES:
    t0 = time.time()
    print(f"\n=== {e}")
    r = subprocess.run([sys.executable, "-W", "ignore", e], cwd=ICI)
    if r.returncode:
        sys.exit(f"Échec de {e} (code {r.returncode})")
    print(f"--- {e} : {time.time() - t0:.0f} s")
print("\nChaîne terminée. Ouvrir webmap/index.html ou grand-public/index.html (double-clic) ; projet QGIS : 08_projet_qgis.py dans QGIS.")
