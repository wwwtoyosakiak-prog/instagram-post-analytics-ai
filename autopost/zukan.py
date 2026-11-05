"""ペパポン図鑑（観察ノート風）スタイル。render.py から呼ばれる。"""
import math
import os
from datetime import date as Date
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H, END_T = 1080, 1920, 7.9
ROOT = os.environ.get("AUTOPOST_ASSETS", "autopost-assets")
KLEE = os.path.join(ROOT, "fonts", "KleeOne-SemiBold.ttf")
YOMO = os.path.join(ROOT, "fonts", "Yomogi-Regular.ttf")
SANS = next((p for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"] if os.path.exists(p)), "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc")
PAPER = (247, 240, 224); GRID = (176, 204, 226); INK = (44, 40, 52); RED = (214, 58, 52)
BLUE = (40, 92, 170); HL = (255, 222, 80)
ACCENTS = [(255, 160, 60), (255, 120, 160), (110, 120, 230), (90, 190, 120), (240, 110, 80), (70, 170, 140), (170, 120, 230)]
WD = "月火水木金土日"


def clamp(v, a=0., b=1.): return max(a, min(b, v))
def prog(t, a, b): return clamp((t - a) / (b - a))
def eoc(p): return 1 - (1 - p) ** 3
def eob(p):
    if p <= 0: return 0.
    c1 = 1.70158; c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


@lru_cache(maxsize=32)
def F(path, px): return ImageFont.truetype(path, px, index=0)


def text_img(s, font, px, fill, stroke=0, stroke_fill=PAPER):
    f = F(font, px); l, t, r, b = f.getbbox(s, stroke_width=stroke)
    im = Image.new('RGBA', (r - l + 20, b - t + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10 - l, 10 - t), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im


def paste_c(img, im, cx, cy, k=1.0, ang=0, alpha=1.0):
    if k <= 0.02 or alpha <= 0.01: return
    if ang: im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
    if abs(k - 1) > 0.01: im = im.resize((max(2, int(im.width * k)), max(2, int(im.height * k))), Image.BILINEAR)
    m = im.getchannel('A')
    if alpha < 1: m = m.point(lambda v: int(v * alpha))
    img.paste(im.convert('RGB'), (int(cx - im.width / 2), int(cy - im.height / 2)), m)


@lru_cache(maxsize=2)
def notebook():
    rng = np.random.default_rng(7)
    a = np.ones((H, W, 3), np.float32) * np.array(PAPER, np.float32)
    n = np.asarray(Image.fromarray((rng.normal(128, 30, (H // 3, W // 3))).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) - 128
    a += n[..., None] * 0.08
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8)); d = ImageDraw.Draw(img)
    for x in range(140, W, 54): d.line([(x, 0), (x, H)], fill=GRID, width=2)
    for y in range(20, H, 54): d.line([(0, y), (W, y)], fill=GRID, width=2)
    d.line([(118, 0), (118, H)], fill=(232, 130, 130), width=4)
    for y in range(160, H, 200):  # binder holes
        d.ellipse([34, y - 22, 78, y + 22], fill=(214, 206, 190)); d.ellipse([38, y - 18, 74, y + 18], fill=(60, 54, 50))
    v = Image.new('L', (W, H), 0); ImageDraw.Draw(v).rectangle([60, 60, W - 60, H - 60], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(160))
    return Image.composite(img, Image.blend(img, Image.new('RGB', img.size, (200, 186, 160)), 0.5), v)


def wobble_pts(pts, seed, amp=3):
    r = np.random.default_rng(seed)
    return [(x + r.normal(0, amp), y + r.normal(0, amp)) for x, y in pts]


def draw_partial(d, pts, p, fill, width):
    """折れ線を p(0..1) まで描く（手描き感）"""
    if p <= 0: return
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    tot = sum(seg); goal = tot * p; acc = 0; out = [pts[0]]
    for i, s in enumerate(seg):
        if acc + s >= goal:
            q = (goal - acc) / s if s else 0
            out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q)); break
        out.append(pts[i + 1]); acc += s
    d.line(out, fill=fill, width=width, joint='curve')
    for x, y in (out[0], out[-1]): d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=fill)


def ellipse_pts(cx, cy, rx, ry, seed, turns=1.12):
    n = 60; pts = []
    a0 = -2.3
    for i in range(n + 1):
        a = a0 + turns * 2 * math.pi * i / n
        k = 1 + 0.05 * math.sin(i * 0.4 + seed)
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    return wobble_pts(pts, seed, 1.5)


def star_pts(cx, cy, r):
    pts = []
    for i in range(11):
        a = -math.pi / 2 + i * math.pi * 2 / 5 * 1
        pts.append((cx + r * math.cos(-math.pi / 2 + i * 4 * math.pi / 5), cy + r * math.sin(-math.pi / 2 + i * 4 * math.pi / 5)))
    return pts[:6]


@lru_cache(maxsize=64)
def photo_card(pid, rot):
    im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, 'photos', pid + '.jpg'))).convert('RGB')
    w, h = 760, 900
    ratio = im.width / im.height
    if not pid.startswith(('sdgs_work', 'sdgs_again', 'quiz_paper')):
        s = max(w / im.width, h / im.height); cw, ch = w / s, h / s
        cw = min(cw, im.width); ch = min(ch, im.height); x0 = max(0, (im.width - cw) / 2); y0 = max(0, (im.height - ch) / 2)
        ph = im.resize((w, h), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch))
    else:
        ph = Image.new('RGB', (w, h), (255, 255, 255))
        s = min(w / im.width, h / im.height) * 0.95; fg = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        ph.paste(fg, ((w - fg.width) // 2, (h - fg.height) // 2))
    card = Image.new('RGBA', (w + 60, h + 150), (255, 255, 253, 255)); card.paste(ph, (30, 30))
    # masking tape
    for (tx, ang) in ((90, 28), (card.width - 90, -28)):
        tape = Image.new('RGBA', (230, 70), (240, 206, 120, 235)); td = ImageDraw.Draw(tape)
        for k in range(0, 64, 8): td.polygon([(0, k), (6, k + 4), (0, k + 8)], fill=(0, 0, 0, 0)); td.polygon([(220, k), (214, k + 4), (220, k + 8)], fill=(0, 0, 0, 0))
        tape = tape.rotate(ang, resample=Image.BICUBIC, expand=True)
        big = Image.new('RGBA', (card.width, card.height + 80), (0, 0, 0, 0)); big.paste(card, (0, 40))
        big.alpha_composite(tape, (int(tx - tape.width / 2), 40 - tape.height // 2 + 6)); card = big
    card = card.rotate(rot, resample=Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', card.size, (60, 40, 20, 0)); sh.putalpha(card.getchannel('A').point(lambda v: v * 80 // 255).filter(ImageFilter.GaussianBlur(14)))
    out = Image.new('RGBA', (card.width + 40, card.height + 40), (0, 0, 0, 0))
    out.alpha_composite(sh, (26, 30))
    out.alpha_composite(card, (10, 10))
    return out


@lru_cache(maxsize=4)
def capsule():
    return Image.open(os.path.join(ROOT, 'capsule.png')).convert('RGBA')


@lru_cache(maxsize=4)
def logo(col):
    lg = Image.open(os.path.join(ROOT, 'logo.png')).convert('L').resize((560, 316), Image.LANCZOS)
    im = Image.new('RGBA', lg.size, col + (0,)); im.putalpha(lg.point(lambda v: 255 if v < 140 else 0)); return im


def stamp(img, day, t, t0):
    p = prog(t, t0, t0 + 0.25); k = 1 + 0.8 * (1 - eoc(p))
    if p <= 0: return
    im = Image.new('RGBA', (250, 250), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([10, 10, 240, 240], outline=RED + (255,), width=10); d.ellipse([30, 30, 220, 220], outline=RED + (255,), width=4)
    if day['no'] is None:
        tn = text_img('観察', KLEE, 84, RED + (255,), stroke=2, stroke_fill=RED + (255,)); im.alpha_composite(tn, (125 - tn.width // 2, 125 - tn.height // 2))
    else:
        tt = text_img('No.', KLEE, 44, RED + (255,)); im.alpha_composite(tt, (125 - tt.width // 2, 50))
        tn = text_img(str(day['no']), SANS, 110, RED + (255,)); im.alpha_composite(tn, (125 - tn.width // 2, 92))
    rng = np.random.default_rng(day['no'] or 0)
    mask = Image.fromarray((rng.random((250, 250)) > 0.12).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1))
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel('A')), np.asarray(mask))))
    paste_c(img, im, 945, 175, k * 0.78, -12, alpha=0.92 * p ** 0.5)


def header(img, day, t):
    d = ImageDraw.Draw(img)
    # tab
    k = eoc(prog(t, 0.0, 0.35))
    tab = Image.new('RGBA', (430, 92), day['accent'] + (255,)); ImageDraw.Draw(tab).rectangle([0, 84, 430, 92], fill=(0, 0, 0, 60))
    tx = text_img('ペパポン図鑑', KLEE, 58, (255, 255, 255, 255)); tab.alpha_composite(tx, (215 - tx.width // 2, 46 - tx.height // 2))
    img.paste(tab.convert('RGB'), (int(150 - 430 * (1 - k)), 70), tab.getchannel('A'))
    dt = text_img(f"{day['date']}（{day['wd']}）", YOMO, 58, INK + (255,), stroke=1, stroke_fill=INK + (255,)); paste_c(img, dt, 330, 205, alpha=prog(t, 0.2, 0.5))
    # title with highlighter
    ti = text_img(day['title'], KLEE, 104, INK + (255,), stroke=2, stroke_fill=INK + (255,))
    hp = eoc(prog(t, 0.35, 0.9)); x0 = 540 - ti.width / 2; y = 395
    if hp > 0:
        hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
        hd.rounded_rectangle([x0 - 10, y + 6, x0 - 10 + (ti.width + 20) * hp, y + 56], 18, fill=HL + (170,))
        img.paste(hl.convert('RGB'), (0, 0), hl.getchannel('A'))
    paste_c(img, ti, 540, y, k=1 + 0.15 * (1 - eob(prog(t, 0.25, 0.55))), alpha=prog(t, 0.25, 0.4))
    stamp(img, day, t, 0.55)


def typewriter(s, p): return s[:int(math.ceil(len(s) * clamp(p)))]


def body(img, day, t, cuts):
    n = len(day['items'])
    idx = max(0, min(n - 1, int(np.searchsorted(cuts, t, side='right') - 1)))
    t0 = cuts[idx]; t1 = cuts[idx + 1] if idx + 1 < len(cuts) else END_T
    d = ImageDraw.Draw(img)
    # previous card sliding out
    if idx > 0 and t - t0 < 0.35:
        pp = eoc(prog(t, t0, t0 + 0.35)); pid, _ = day['items'][idx - 1]
        rot = 3 if (idx - 1) % 2 == 0 else -3
        paste_c(img, photo_card(pid, rot), 560 - 1100 * pp, 1010 + 80 * pp, 0.92, -20 * pp)
    pid, label = day['items'][idx]
    rot = 3 if idx % 2 == 0 else -3
    e = eob(prog(t, t0, t0 + 0.32))
    paste_c(img, photo_card(pid, rot), 560 + 900 * (1 - eoc(prog(t, t0, t0 + 0.28))), 1010, 0.92 * (0.9 + 0.1 * e), (1 - e) * 8)
    # label: number badge + typewriter text + underline
    side = idx % 2
    lp = prog(t, t0 + 0.35, t0 + 0.35 + 0.05 * len(label))
    s = typewriter(label, lp)
    badge = Image.new('RGBA', (86, 86), (0, 0, 0, 0)); bd = ImageDraw.Draw(badge)
    bd.ellipse([3, 3, 83, 83], fill=day['accent'] + (255,)); bt_ = text_img('①②③④⑤'[idx] if False else str(idx + 1), SANS, 52, (255, 255, 255, 255))
    badge.alpha_composite(bt_, (43 - bt_.width // 2, 41 - bt_.height // 2))
    lab_y = 1640
    paste_c(img, badge, 210, lab_y, eob(prog(t, t0 + 0.25, t0 + 0.45)))
    if s:
        tim = text_img(s, YOMO, 76, INK + (255,), stroke=2, stroke_fill=INK + (255,)); img.paste(tim.convert('RGB'), (270, int(lab_y - tim.height / 2)), tim.getchannel('A'))
    full = text_img(label, YOMO, 76, INK + (255,), stroke=2, stroke_fill=INK + (255,))
    up = prog(t, t0 + 0.35 + 0.05 * len(label), t0 + 0.6 + 0.05 * len(label))
    pts = wobble_pts([(280 + i * (full.width - 20) / 12, lab_y + 52 + 4 * math.sin(i)) for i in range(13)], idx + (day['no'] or 0) * 10, 2)
    draw_partial(d, pts, up, RED, 9)
    # arrow from label to photo
    ap = prog(t, t0 + 0.45, t0 + 0.8)
    ax = 860 if side == 0 else 300
    arrow = wobble_pts([(ax, lab_y - 70), (ax + (40 if side == 0 else -40), lab_y - 150), (ax + (10 if side == 0 else -10), lab_y - 230)], idx + 3, 2)
    draw_partial(d, arrow, ap, BLUE, 8)
    if ap >= 1:
        tip = arrow[-1]; d.line([(tip[0] - 26, tip[1] + 26), tip, (tip[0] + 26, tip[1] + 26)], fill=BLUE, width=8, joint='curve')
    # doodle star near card corner
    sp = prog(t, t0 + 0.6, t0 + 1.0)
    cx, cy = (930, 620) if side else (170, 640)
    draw_partial(d, wobble_pts(star_pts(cx, cy, 46), idx, 1.5), sp, day['accent'], 7)


def footer(img, day, t):
    note = text_img('メモ：' + day['note'], KLEE, 48, (80, 74, 86, 255), stroke=1, stroke_fill=(80, 74, 86, 255)); paste_c(img, note, 560, 1780, alpha=prog(t, 1.0, 1.4))
    tg = text_img('#ペパポン #新西ゼミ', YOMO, 40, (120, 112, 120, 255)); paste_c(img, tg, 560, 1868, alpha=prog(t, 0.6, 1.0))


def end_card(img, day, t, bt):
    te = t - END_T
    # page turn: new page wipes from right with a curl shadow
    p = eoc(prog(te, 0, 0.45)); x = int(W * (1 - p))
    page = notebook().copy(); d = ImageDraw.Draw(page)
    i = int(np.searchsorted(bt, t, side='right') - 1); dtb = t - bt[max(i, 0)]
    cap = capsule().rotate((-90 * max(0, i) - 90 * eoc(min(1, dtb / 0.25))) % 360, resample=Image.BICUBIC, expand=True)
    paste_c(page, cap, 560, 620, 0.62 * eob(prog(te, 0.3, 0.6)))
    lg = logo(INK); paste_c(page, lg, 560, 1010, alpha=prog(te, 0.35, 0.7))
    if day['nxt']:
        a = text_img('あしたは…', YOMO, 64, INK + (255,), stroke=1, stroke_fill=INK + (255,)); paste_c(page, a, 560, 1250, alpha=prog(te, 0.45, 0.7))
        b = text_img(f"「{day['nxt']}」", KLEE, 82, INK + (255,), stroke=2, stroke_fill=INK + (255,))
        if b.width > 960: b = b.resize((960, int(b.height * 960 / b.width)), Image.LANCZOS)
        hp = eoc(prog(te, 0.6, 1.0))
        if hp > 0:
            hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(hl).rounded_rectangle([560 - b.width / 2 - 10, 1370, 560 - b.width / 2 - 10 + (b.width + 20) * hp, 1420], 18, fill=HL + (170,))
            page.paste(hl.convert('RGB'), (0, 0), hl.getchannel('A'))
        paste_c(page, b, 560, 1370, alpha=prog(te, 0.55, 0.75))
    else:
        b = text_img('らいしゅうも おたのしみに！', KLEE, 76, INK + (255,), stroke=2, stroke_fill=INK + (255,)); paste_c(page, b, 560, 1330, alpha=prog(te, 0.5, 0.75))
    f_ = text_img('フォローしてね！', YOMO, 72, RED + (255,), stroke=2, stroke_fill=RED + (255,)); paste_c(page, f_, 560, 1560, eob(prog(te, 0.8, 1.05)), -4)
    if x < W:
        img.paste(page.crop((0, 0, W - x, H)), (x, 0))
        if 0 < x < W:
            sh = Image.new('L', (60, H), 0); sd = ImageDraw.Draw(sh)
            for k in range(60): sd.line([(k, 0), (k, H)], fill=int(90 * (1 - k / 60)))
            img.paste(Image.new('RGB', (60, H), (60, 50, 40)), (x, 0), sh)


def frame(day, t, bt, cuts):
    img = notebook().copy()
    header(img, day, t)
    if t >= cuts[0]: body(img, day, t, cuts)
    footer(img, day, t)
    if t >= END_T: end_card(img, day, t, bt)
    return img




def make_day(plan, beats):
    d = Date.fromisoformat(plan["date"])
    no = None  # 自動投稿の図鑑ページは通し番号なし（スタンプは「観察」）
    photos = plan.get("photos") or []
    lines = plan.get("lines") or []
    items = [(p, lines[i % len(lines)] if lines else "") for i, p in enumerate(photos[:4])] or [("make_done", "かんせい！")]
    day = dict(no=no, date=f"{d.month}/{d.day}", wd=WD[d.weekday()], title=plan.get("theme", "ペパポン図鑑"),
               accent=ACCENTS[d.toordinal() % len(ACCENTS)], items=items,
               note=plan.get("note") or "よく見ると ちがいが いっぱい", nxt=plan.get("tomorrowTeaser") or None)
    bt = np.array(beats)
    n = len(items); start = 0.75; span = (END_T - start) / n
    cuts = [float(bt[np.argmin(abs(bt - (start + k * span)))]) for k in range(n)]
    cuts[0] = min(cuts[0], 1.0)
    return day, bt, cuts
