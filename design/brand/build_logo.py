"""Builds the CouchConsensus logo files as clean SVG (all text outlined, no font needed).

The mark: "The Couch" (Figma option 1), three people on one sofa in voter colours; the
sofa is Fire TV orange with Ember cushions. The wordmark is Bricolage Grotesque ExtraBold.

Usage (needs uharfbuzz + fonttools):
    python design/brand/build_logo.py
Writes design/brand/svg/*.svg. Render PNGs with design/brand/render.mjs.
"""

from __future__ import annotations

import math
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
FONTS = HERE.parent / "fonts" / "static"
OUT = HERE / "svg"

# Tokens (packages/theme)
ORANGE = "#FC4C02"
EMBER = "#FF8A4C"
NIGHT = "#0E1626"
CUSHION = "#25365A"
GLOW = "#F7F1E8"

DISPLAY = FONTS / "BricolageGrotesque-ExtraBold.ttf"


# ---------- text → outlines ----------

class Outliner:
    def __init__(self, path: Path):
        self.font = TTFont(path)
        self.upem = self.font["head"].unitsPerEm
        blob = hb.Blob.from_file_path(str(path))
        self.hb_font = hb.Font(hb.Face(blob))
        self.glyphs = self.font.getGlyphSet()
        self.order = self.font.getGlyphOrder()

    def shape(self, text: str, tracking: float = 0.0):
        """Returns [(glyph_name, x_units)] and total advance, with kerning (HarfBuzz)."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf, {"kern": True, "liga": True})
        x = 0.0
        out = []
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((self.order[info.codepoint], x + pos.x_offset))
            x += pos.x_advance + tracking * self.upem
        return out, x

    def path(self, text: str, size: float, x: float = 0, baseline: float = 0, tracking: float = 0.0):
        """SVG path data for `text` at font `size`, left edge `x`, baseline `baseline`."""
        s = size / self.upem
        glyphs, _ = self.shape(text, tracking)
        pen = SVGPathPen(self.glyphs)
        for name, gx in glyphs:
            # font units are y-up; SVG is y-down
            tp = TransformPen(pen, (s, 0, 0, -s, x + gx * s, baseline))
            self.glyphs[name].draw(tp)
        return pen.getCommands()

    def bounds(self, text: str, size: float, tracking: float = 0.0):
        """Ink bounds (xmin, ymin, xmax, ymax) in SVG coordinates at origin baseline 0."""
        s = size / self.upem
        glyphs, adv = self.shape(text, tracking)
        bp = BoundsPen(self.glyphs)
        for name, gx in glyphs:
            self.glyphs[name].draw(TransformPen(bp, (s, 0, 0, -s, gx * s, 0)))
        return bp.bounds, adv * s


display = Outliner(DISPLAY)


def text_centered(text: str, size: float, cx: float, cy: float, fill: str, tracking=0.0) -> str:
    """Text whose ink box is centered on (cx, cy)."""
    (x0, y0, x1, y1), _ = display.bounds(text, size, tracking)
    x = cx - (x0 + x1) / 2
    baseline = cy - (y0 + y1) / 2
    return f'<path fill="{fill}" d="{display.path(text, size, x, baseline, tracking)}"/>'


def text_left(text: str, size: float, x: float, cy: float, fill: str, tracking=0.0) -> tuple[str, float]:
    """Text starting at ink-left x, vertically centered on cy. Returns (svg, ink width)."""
    (x0, y0, x1, y1), _ = display.bounds(text, size, tracking)
    baseline = cy - (y0 + y1) / 2
    return f'<path fill="{fill}" d="{display.path(text, size, x - x0, baseline, tracking)}"/>', x1 - x0


# ---------- the mark ----------
# "The Couch" (Figma, Logos page, option 1): three people on one sofa, in voter colours.
# Shapes in Figma's 560-frame coordinates; the ink box is x 116..444, y 104..384.

TEAL = "#2EC4B6"
VIOLET = "#9B8CFF"

HEADS = ((200, 152, 32, TEAL), (280, 142, 38, GLOW), (360, 152, 32, VIOLET))  # cx, cy, r, colour
COUCH = (  # x, y, w, h, radius, colour; drawn in this order
    (150, 168, 260, 124, 36, ORANGE),  # backrest
    (164, 262, 232, 78, 24, EMBER),  # seat
    (116, 222, 72, 140, 32, ORANGE),  # arm left
    (372, 222, 72, 140, 32, ORANGE),  # arm right
    (140, 356, 22, 28, 6, ORANGE),  # leg left
    (398, 356, 22, 28, 6, ORANGE),  # leg right
    (239, 262, 6, 78, 0, ORANGE),  # cushion seam 1
    (315, 262, 6, 78, 0, ORANGE),  # cushion seam 2
)
INK = (116, 104, 444, 384)


def mark_bounds() -> tuple[float, float, float, float]:
    return INK


def place(cx: float, cy: float, height: float, **kw) -> str:
    """The mark scaled to `height` px tall, its ink box centered on (cx, cy)."""
    x0, y0, x1, y1 = mark_bounds()
    s = height / (y1 - y0)
    return mark(scale=s, tx=cx - (x0 + x1) / 2 * s, ty=cy - (y0 + y1) / 2 * s, **kw)


def mark_width(height: float) -> float:
    x0, y0, x1, y1 = mark_bounds()
    return (x1 - x0) * height / (y1 - y0)


def _rect(x, y, w, h, r, fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"/>'


def mark(scale: float = 1.0, tx: float = 0, ty: float = 0, mono: str | None = None, back: str = CUSHION) -> str:
    """The couch with three heads. mono: one colour, with the cushion seams and a thin ring around
    each head cut out so the shapes still read on any background."""
    if not mono:
        body = "".join(_rect(*c) for c in COUCH) + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{f}"/>' for x, y, r, f in HEADS)
    else:
        cut = (
            '<mask id="couch-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="560">'
            '<rect width="560" height="560" fill="white"/>'
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r + 7}" fill="black"/>' for x, y, r, _ in HEADS)
            + _rect(239, 262, 6, 78, 0, "black") + _rect(315, 262, 6, 78, 0, "black")
            + '<rect x="164" y="258" width="232" height="6" fill="black"/></mask>'
        )
        couch = "".join(_rect(x, y, w, h, r, mono) for x, y, w, h, r, _ in COUCH[:6])
        heads = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{mono}"/>' for x, y, r, _ in HEADS)
        body = f'{cut}<g mask="url(#couch-cut)">{couch}</g>{heads}'
    return f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">{body}</g>'


def svg(w: int, h: int, body: str, bg: str | None = None, title: str = "CouchConsensus") -> str:
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">'
        f"<title>{title}</title>{rect}{body}</svg>\n"
    )


def write(name: str, content: str) -> None:
    OUT.mkdir(exist_ok=True)
    (OUT / name).write_text(content)
    print("wrote", OUT / name)


def main() -> None:
    # Mark only, transparent (512), ink box centered with 8 % margin
    write("mark.svg", svg(512, 512, place(256, 256, 430)))
    write("mark-mono-glow.svg", svg(512, 512, place(256, 256, 430, mono=GLOW)))
    write("mark-mono-orange.svg", svg(512, 512, place(256, 256, 430, mono=ORANGE)))

    # App icon: full-bleed Night square; mark inside the central 66 % so platform masks never clip it
    write("app-icon.svg", svg(512, 512, place(256, 256, 338), bg=NIGHT, title="CouchConsensus app icon"))

    # Stacked logo: mark over wordmark, 1024 square
    _, ww = text_left("CouchConsensus", 112, 0, 0, GLOW)
    word, _ = text_left("CouchConsensus", 112, (1024 - ww) / 2, 812, GLOW)
    write("logo-stacked.svg", svg(1024, 1024, place(512, 400, 520) + word, bg=NIGHT))

    # Horizontal lockup, transparent, for dark backgrounds: mark height = 1.9 × cap height
    h = 120
    mw = mark_width(h * 0.86)
    word, lw = text_left("CouchConsensus", 64, mw + 30, h / 2, GLOW)
    write("lockup-horizontal.svg", svg(int(mw + 30 + lw + 4), h, place(mw / 2, h / 2, h * 0.86) + word))

    # Fire TV launcher tile, 16:9 (1280×720, PNG, no transparency). Lockup scaled to sit inside the
    # 882×448 content-safe area (badges may cover anything outside it), with a little breathing room.
    safe_w = 840
    mh, size, gap = 300, 96, 44
    _, tw = text_left("CouchConsensus", size, 0, 0, GLOW)
    k = min(1.0, safe_w / (mark_width(mh) + gap + tw))
    mh, size, gap = mh * k, size * k, gap * k
    mw = mark_width(mh)
    _, tw = text_left("CouchConsensus", size, 0, 0, GLOW)
    x0 = (1280 - (mw + gap + tw)) / 2
    word, _ = text_left("CouchConsensus", size, x0 + mw + gap, 360, GLOW)
    write("tv-tile.svg", svg(1280, 720, place(x0 + mw / 2, 360, mh) + word, bg=NIGHT, title="CouchConsensus TV tile"))

if __name__ == "__main__":
    main()
