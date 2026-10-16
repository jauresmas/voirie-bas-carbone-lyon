"""Captures de contrôle de la version grand public (Playwright + Edge, ouverture en file://)."""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / "grand-public" / "index.html").as_uri()
OUT = ROOT / ".impeccable" / "review" / "grand-public"
OUT.mkdir(parents=True, exist_ok=True)
CHAPS = ["ch-depart", "ch-chaleur", "ch-revetements", "ch-commencer", "ch-ma-rue", "ch-2050", "ch-avis", "ch-terminus"]

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    msgs = []
    for nom, vp, dsf in (("desktop", {"width": 1440, "height": 900}, 1), ("mobile", {"width": 390, "height": 844}, 2)):
        ctx = b.new_context(viewport=vp, device_scale_factor=dsf, reduced_motion="reduce")
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
        pg.on("console", lambda m: msgs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        pg.goto(URL)
        pg.wait_for_function("document.querySelector('#chargement').classList.contains('fini')", timeout=60000)
        pg.wait_for_timeout(1500)
        for c in CHAPS:
            if c == "ch-depart":
                pg.evaluate("window.scrollTo(0, 0)")
            else:
                pg.evaluate(f"document.getElementById('{c}').scrollIntoView()")
            if c == "ch-ma-rue":
                pg.fill("#q-main", "bossuet")
                pg.wait_for_timeout(300)
                pg.keyboard.press("Enter")
            if c == "ch-avis":
                pg.check('#avis input[value="chaleur"]')
                pg.check('#avis input[value="sante"]')
                pg.click("#avis-envoyer")
            pg.wait_for_timeout(2200)
            pg.screenshot(path=str(OUT / f"{nom}-{c}.png"))
        ctx.close()
    b.close()
print("\n".join(dict.fromkeys(msgs)) or "aucune erreur console")
