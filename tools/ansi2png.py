# Dev-only: render ANSI truecolor text (status line or dashboard output) to a PNG so you can look at it.
# Usage: python tools/ansi2png.py out.txt out.png [--pretty]   (needs Pillow)
#   --pretty   2x scale, padding and a terminal window frame, for the README screenshot
import re, sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
pretty = '--pretty' in sys.argv
S = 2 if pretty else 1
text = open(src, encoding='utf-8').read()
text = re.sub(r'\x1b\]8;[^\x07]*\x07', '', text).replace('⠀', ' ')
lines = text.rstrip('\n').split('\n')
CW, CH = 8 * S, 17 * S
FG, BG = (220, 220, 220), ((22, 24, 29) if pretty else (0, 0, 0))
# The basic terminal colors, as a typical dark theme shows them.
ANSI16 = {31: (241, 76, 76), 32: (35, 209, 139), 33: (245, 245, 67), 34: (59, 142, 234), 35: (214, 112, 214),
          36: (41, 184, 219), 37: (229, 229, 229), 90: (110, 115, 125)}
cols = 0
parsed = []
tok = re.compile(r'\x1b\[([0-9;?]*)([A-Za-z])|(.)', re.S)
for line in lines:
    fg, bg, dim, cells = FG, BG, False, []
    for m in tok.finditer(line):
        if m.group(3) is not None:
            cells.append((m.group(3), tuple(int(v * 0.6 + BG[i] * 0.4) for i, v in enumerate(fg)) if dim else fg, bg))
            continue
        if m.group(2) != 'm':
            continue
        p = [int(x) if x else 0 for x in m.group(1).split(';')]
        i = 0
        while i < len(p):
            if p[i] == 0: fg, bg, dim = FG, BG, False
            elif p[i] == 2: dim = True
            elif p[i] == 22: dim = False
            elif p[i] == 39: fg = FG
            elif p[i] in ANSI16: fg = ANSI16[p[i]]
            elif p[i] == 38 and p[i+1] == 2: fg = tuple(p[i+2:i+5]); i += 4
            elif p[i] == 48 and p[i+1] == 2: bg = tuple(p[i+2:i+5]); i += 4
            i += 1
    parsed.append(cells)
    cols = max(cols, len(cells))

def load(names, size):
    for n in names:
        try: return ImageFont.truetype(n, size)
        except Exception: pass
    return ImageFont.load_default()

font = load(['consola.ttf', 'DejaVuSansMono.ttf', 'Menlo.ttc'], 14 * S)
symbols = load(['seguisym.ttf', 'DejaVuSans.ttf'], 15 * S)
PAD, BAR = (20 * S, 34 * S) if pretty else (0, 0)
W, H = cols * CW + 2 * PAD, len(parsed) * CH + 2 * PAD + BAR
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
if pretty:
    d.rectangle([0, 0, W, BAR], fill=(34, 37, 43))
    for k, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        x = PAD + k * 20 * S
        d.ellipse([x, BAR // 2 - 6 * S, x + 12 * S, BAR // 2 + 6 * S], fill=c)
eighths = ' ▏▎▍▌▋▊▉'
for r, cells in enumerate(parsed):
    for c, (ch, fg, bg) in enumerate(cells):
        x, y = PAD + c * CW, BAR + PAD + r * CH
        if bg != BG: d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=bg)
        if ch == '▀': d.rectangle([x, y, x + CW - 1, y + CH // 2 - 1], fill=fg)
        elif ch == '█': d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=fg)
        elif ch == '■': d.rounded_rectangle([x, y + 4 * S, x + CW - 1, y + 4 * S + CW - 1], radius=2 * S, fill=fg)
        elif ch in eighths and ch != ' ': d.rectangle([x, y, x + eighths.index(ch) * S - 1, y + CH - 1], fill=fg)
        elif ch in '━╸': d.rectangle([x, y + CH // 2 - 2 * S, x + (CW if ch == '━' else CW // 2) - 1, y + CH // 2 + S], fill=fg)
        elif ch == '─': d.rectangle([x, y + CH // 2 - 1, x + CW - 1, y + CH // 2], fill=fg)
        elif ch == '⎇': d.text((x - S, y - 2 * S), ch, fill=fg, font=symbols)
        elif ch != ' ': d.text((x, y), ch, fill=fg, font=font)
img.save(out)
print(img.size)
