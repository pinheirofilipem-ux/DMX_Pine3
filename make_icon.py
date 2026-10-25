# Ícone DMX_Pine3: squircle escuro estilo macOS, três cones de luz empilhados a formar
# um pinheiro ("Pine3") a sair de uma mesa de faders, na cor de destaque da app (#7dff2a).
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math, sys

S = 4096                      # desenha a 4x e reduz: bordas limpas
out_png, out_icns = sys.argv[1], sys.argv[2]

def squircle_mask(size, inset, n=5.0):
    m = Image.new('L', (size, size), 0); d = ImageDraw.Draw(m)
    a = (size - 2 * inset) / 2; c = size / 2; pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720; ct, st = math.cos(t), math.sin(t)
        x = c + a * math.copysign(abs(ct) ** (2 / n), ct)
        y = c + a * math.copysign(abs(st) ** (2 / n), st)
        pts.append((x, y))
    d.polygon(pts, fill=255); return m

inset = int(S * 0.098)        # margem da grelha de ícones do macOS (824/1024)
mask = squircle_mask(S, inset)

# fundo: gradiente vertical azul-noite -> preto, com brilho verde em baixo
bg = Image.new('RGB', (S, S))
px = bg.load()
for y in range(S):
    k = y / S
    r = int(22 * (1 - k) + 6 * k); g = int(26 * (1 - k) + 7 * k); b = int(40 * (1 - k) + 11 * k)
    for x in range(0, S, 1):
        pass
    ImageDraw.Draw(bg).line([(0, y), (S, y)], fill=(r, g, b))
glow = Image.new('L', (S, S), 0)
ImageDraw.Draw(glow).ellipse([S * .18, S * .62, S * .82, S * 1.05], fill=170)
glow = glow.filter(ImageFilter.GaussianBlur(S * .09))
bg = Image.composite(Image.new('RGB', (S, S), (60, 140, 25)), bg, glow.point(lambda v: v * .55))

ac = (125, 255, 42)
light = Image.new('L', (S, S), 0)     # máscara da luz (aditiva)
ld = ImageDraw.Draw(light)
cx = S / 2
# três cones (camadas do pinheiro), do topo para a base, cada um parte de um foco
tiers = [(.205, .40, .155), (.335, .555, .225), (.47, .715, .29)]   # (y topo, y base, meia-largura)
for i, (yt, yb, hw) in enumerate(tiers):
    # cada cone: forte junto ao foco, a desvanecer para a base (como um feixe com fumo)
    for y in range(int(S * yt), int(S * yb)):
        t = max(0.0, (y - S * yt) / (S * (yb - yt))); w = S * hw * t
        ld.line([(cx - w, y), (cx + w, y)], fill=int(255 * (1 - 0.62 * t ** 0.8)))
soft = light.filter(ImageFilter.GaussianBlur(S * .035))
light = ImageChops.lighter(light, soft)

img = bg.copy()
img = Image.composite(Image.new('RGB', (S, S), ac), img, light.point(lambda v: int(v * .92)))
d = ImageDraw.Draw(img)
# focos (cabeças) no vértice de cada cone
for yt, _, _ in tiers:
    r = S * .028
    d.ellipse([cx - r * 1.9, S * yt - r * 1.9, cx + r * 1.9, S * yt + r * 1.9], fill=(200, 255, 160))
    d.ellipse([cx - r, S * yt - r, cx + r, S * yt + r], fill=(255, 255, 255))
# tronco
d.rounded_rectangle([cx - S * .03, S * .715, cx + S * .03, S * .765], radius=S * .008, fill=(36, 40, 52))
# mesa: régua com 5 faders
x0, x1, y0, y1 = S * .2, S * .8, S * .75, S * .86
d.rounded_rectangle([x0, y0, x1, y1], radius=S * .03, fill=(16, 18, 26), outline=(58, 64, 82), width=int(S * .006))
levels = [.35, .7, .5, .85, .45]
for i, lvl in enumerate(levels):
    fx = x0 + (x1 - x0) * (i + 0.5) / 5
    d.rounded_rectangle([fx - S * .006, y0 + S * .018, fx + S * .006, y1 - S * .018], radius=S * .006, fill=(40, 44, 58))
    ky = y1 - S * .018 - (y1 - y0 - S * .036) * lvl
    d.rounded_rectangle([fx - S * .03, ky - S * .011, fx + S * .03, ky + S * .011], radius=S * .006,
                        fill=ac if i == 3 else (205, 210, 225))
# brilho de vidro no topo
hl = Image.new('L', (S, S), 0)
ImageDraw.Draw(hl).ellipse([-S * .2, -S * .62, S * 1.2, S * .36], fill=9)
hl = hl.filter(ImageFilter.GaussianBlur(S * .02))
img = Image.composite(Image.new('RGB', (S, S), (255, 255, 255)), img, hl)

# contorno subtil + sombra projetada
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
shadow = mask.filter(ImageFilter.GaussianBlur(S * .02)).point(lambda v: int(v * .45))
sh = Image.new('RGBA', (S, S), (0, 0, 0, 255)); sh.putalpha(shadow)
icon.alpha_composite(sh, (0, int(S * .012)))
body = img.convert('RGBA'); body.putalpha(mask)
icon.alpha_composite(body)
edge = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(int(S * .004) | 1)))
ln = Image.new('RGBA', (S, S), (255, 255, 255, 0)); ln.putalpha(edge.point(lambda v: int(v * .22)))
icon.alpha_composite(ln)

final = icon.resize((1024, 1024), Image.LANCZOS)
final.save(out_png)
final.save(out_icns, sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
print('ok')
