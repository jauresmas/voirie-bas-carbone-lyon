"""Captures d'écran de la carte web (contrôle visuel) avec Playwright + Edge.

Usage : python captures_webmap.py [url] [figures...]   (serveur local requis, ex. http://localhost:8791/)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8791/"
FIGS = [int(a) for a in sys.argv[2:] if a.isdigit()] or list(range(10))
OUT = Path(__file__).resolve().parents[1] / ".impeccable" / "review"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    msgs = []
    pg.on("console", lambda m: msgs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
    pg.goto(URL)
    pg.wait_for_function("window.APP && APP.ready", timeout=60000)
    for f in FIGS:
        pg.evaluate(f"APP.go({f})")
        pg.wait_for_timeout(2600)
        pg.screenshot(path=str(OUT / f"desktop-f{f}.png"))
    if "explore" in sys.argv or not sys.argv[2:]:
        pg.evaluate("APP.setMode('exploration')")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(OUT / "desktop-explore.png"))
        pg.evaluate("APP.setMode('presentation')")
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    m.goto(URL)
    m.wait_for_function("window.APP && APP.ready", timeout=60000)
    m.evaluate("APP.go(2)")
    m.wait_for_timeout(2600)
    m.screenshot(path=str(OUT / "mobile.png"), full_page=True)
    b.close()
print("\n".join(dict.fromkeys(msgs)) or "aucune erreur console")
