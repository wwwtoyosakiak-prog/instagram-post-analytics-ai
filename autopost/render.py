"""だんボールガチャ ペパポン：毎日リール（縦 1080x1920 / 9.5秒）レンダラー

使い方:
  python3 autopost/render.py <assets_dir> <plan.json> <out.mp4>
  python3 autopost/render.py <assets_dir> <plan.json> <out.png> --stills 0.8 3.0 5.2 8.8

plan.json:
  {"date": "2026-11-02", "style": "pop", "theme": "...", "lines": [...], "photos": [...],
   "quizId": null, "tomorrowTeaser": "..."}
"""
import json
import math
import os
import subprocess
import sys
from datetime import date as Date
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H, FPS = 1080, 1920, 30
DUR = 9.5
END_T = 7.9
INK = (40, 26, 16)
WHITE = (255, 255, 255)
CREAM = (250, 244, 232)
GOLD = (232, 190, 90)
WD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
]
FONT = next((p for p in FONT_CANDIDATES if os.path.exists(p)), FONT_CANDIDATES[0])

STYLES = {
    "pop":   dict(bg=None, per=2, spin=14, flash=True, bgms=["bgm.mp3", "bgm2.mp3", "bgm6.mp3"]),
    "kraft": dict(bg=(214, 170, 112), per=4, spin=6, paper=True, bgms=["bgm3.mp3", "bgm_paper.mp3"]),
    "dark":  dict(bg=(18, 16, 22), per=2, spin=10, dark=True, bgms=["bgm4.mp3", "bgm5.mp3"]),
    "sdgs":  dict(bg=(110, 190, 150), per=4, spin=6, bgms=["bgm3.mp3", "bgm_glass.mp3"]),
    "story": dict(bg=(170, 140, 230), per=4, spin=5, bgms=["bgm_paper.mp3", "bgm_glass.mp3"]),
    "quiz":  dict(bg=(80, 160, 240), per=4, spin=10, bgms=["bgm5.mp3", "bgm6.mp3"]),
}
POP_COLORS = [(255, 170, 60), (255, 120, 160), (90, 190, 120), (80, 160, 240), (170, 120, 240), (255, 200, 60)]


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def prog(t, a, b):
    return clamp((t - a) / (b - a))


def eob(p):
    if p <= 0:
        return 0.0
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


def eio(p):
    return 3 * p * p - 2 * p ** 3


@lru_cache(maxsize=24)
def fnt(px):
    return ImageFont.truetype(FONT, px, index=0)


def ptext(img, s, cx, cy, px, fill, band=None, k=1.0, angle=0, stroke=INK, maxw=980):
    if k <= 0.03 or not s:
        return
    f = fnt(px)
    sw = max(3, px // 10)
    l, t, r, b = f.getbbox(s, stroke_width=sw)
    if r - l > maxw - 40:
        px = max(20, int(px * (maxw - 40) / (r - l)))
        f = fnt(px)
        sw = max(3, px // 10)
        l, t, r, b = f.getbbox(s, stroke_width=sw)
    pad = int(px * 0.35)
    im = Image.new("RGBA", (r - l + pad * 2, b - t + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if band:
        d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], im.height // 2, fill=band + (255,))
    d.text((pad - l, pad - t), s, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    if abs(k - 1) > 0.01:
        im = im.resize((max(2, int(im.width * k)), max(2, int(im.height * k))), Image.BILINEAR)
    img.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


class Assets:
    def __init__(self, root):
        self.root = root
        self.catalog = json.load(open(os.path.join(root, "catalog.json"), encoding="utf-8"))
        self.sections = json.load(open(os.path.join(root, "bgm", "sections.json"), encoding="utf-8"))
        self._photos = {}
        self._cap = None
        self._logo = None

    def photo(self, pid):
        if pid not in self._photos:
            im = ImageOps.exif_transpose(Image.open(os.path.join(self.root, "photos", pid + ".jpg"))).convert("RGB")
            self._photos[pid] = im
        return self._photos[pid]

    def capsule(self):
        if self._cap is None:
            self._cap = Image.open(os.path.join(self.root, "capsule.png")).convert("RGBA")
        return self._cap

    def logo(self, col):
        if self._logo is None:
            lg = Image.open(os.path.join(self.root, "logo.png")).convert("L").resize((620, 350), Image.LANCZOS)
            self._logo = lg.point(lambda v: 255 if v < 140 else 0)
        m = self._logo
        im = Image.new("RGBA", m.size, col + (0,))
        im.putalpha(m)
        return im


def cover(im, w, h, zoom=1.0):
    s = max(w / im.width, h / im.height) * zoom
    cw, ch = w / s, h / s
    x0 = (im.width - cw) / 2
    y0 = (im.height - ch) / 2
    return im.resize((w, h), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def fit_card(im, w, h, zoom=1.0):
    """縦長でない写真（ロゴ・イラスト）は切らずにぼかし背景で収める"""
    ratio = im.width / im.height
    if 0.6 < ratio < 0.95:
        return cover(im, w, h, zoom)
    bg = cover(im, w // 8, h // 8).filter(ImageFilter.GaussianBlur(4)).resize((w, h), Image.BILINEAR)
    bg = Image.blend(bg, Image.new("RGB", bg.size, WHITE), 0.35)
    s = min(w / im.width, h / im.height) * 0.94 * zoom
    fg = im.resize((max(2, int(im.width * s)), max(2, int(im.height * s))), Image.BILINEAR)
    bg.paste(fg, ((w - fg.width) // 2, (h - fg.height) // 2))
    return bg


class Reel:
    def __init__(self, assets, plan):
        self.a = assets
        self.plan = plan
        self.style = plan.get("style") if plan.get("style") in STYLES else "pop"
        self.cfg = STYLES[self.style]
        d = Date.fromisoformat(plan["date"])
        self.d = d
        self.seed = d.toordinal()
        self.dark = self.cfg.get("dark", False)
        self.base = self.cfg["bg"] or POP_COLORS[self.seed % len(POP_COLORS)]
        bgms = [b for b in self.cfg["bgms"] if b in assets.sections] or list(assets.sections)
        self.bgm = bgms[(self.seed // 7 + self.seed) % len(bgms)]
        secs = assets.sections[self.bgm]
        sec = secs[(self.seed * 3) % len(secs)]
        self.bgm_file = sec.get("file", self.bgm)
        self.a0 = sec["a0"]
        self.bt = np.array(sec["beats"])
        self.photos = [p for p in plan.get("photos", []) if os.path.exists(os.path.join(assets.root, "photos", p + ".jpg"))]
        if not self.photos:
            self.photos = sorted(assets.catalog["photos"].keys())[:5]
        self.lines = plan.get("lines") or ["つくって", "かざって", "まわそう！"]
        self.quiz = None
        if self.style == "quiz":
            self.quiz = next((q for q in assets.catalog.get("quizzes", []) if q["id"] == plan.get("quizId")), None)
            if self.quiz is None:
                self.style, self.cfg = "pop", STYLES["pop"]
        self.rays = self._rays()
        self.paper = self._paper() if self.cfg.get("paper") else None

    # ---- 背景 ----
    def _rays(self):
        col = self.base
        img = Image.new("RGB", (W + 600, H + 600), col)
        d = ImageDraw.Draw(img)
        c2 = (40, 36, 48) if self.dark else tuple(min(255, v + 26) for v in col)
        cx, cy = (W + 600) / 2, (H + 600) / 2
        for k in range(16):
            a = math.radians(k * 22.5)
            w_ = math.radians(5.5)
            d.polygon([(cx, cy), (cx + 3000 * math.cos(a - w_), cy + 3000 * math.sin(a - w_)),
                       (cx + 3000 * math.cos(a + w_), cy + 3000 * math.sin(a + w_))], fill=c2)
        return img

    def _paper(self):
        rng = np.random.default_rng(self.seed)
        n = rng.normal(0, 1, (H // 4, W // 4))
        n = np.asarray(Image.fromarray(((n * 18) + 128).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) - 128
        base = np.array(self.base, dtype=np.float32)[None, None, :] + n[..., None] * 0.6
        for y in range(0, H, 14):  # 段ボールの波目
            base[y:y + 3] *= 0.96
        return Image.fromarray(base.clip(0, 255).astype(np.uint8))

    def bg(self, t):
        if self.paper is not None:
            return self.paper.copy()
        r = self.rays.rotate(t * self.cfg["spin"], resample=Image.BILINEAR, center=((W + 600) / 2, (H + 600) / 2))
        return r.crop((300, 300, 300 + W, 300 + H))

    def beat(self, t):
        i = int(np.searchsorted(self.bt, t, side="right") - 1)
        return i, t - self.bt[max(i, 0)]

    # ---- 共通パーツ ----
    def header(self, img, t):
        k = eob(prog(t, 0.0, 0.3))
        col = GOLD if self.dark else (255, 236, 120)
        ptext(img, f"{self.d.month}/{self.d.day} {WD[self.d.weekday()]}", 250, 110, 54, WHITE, band=INK, k=k)
        ptext(img, "だんボールガチャ ペパポン", 700, 110, 44, WHITE, k=k)
        ptext(img, self.plan.get("theme", ""), 540, 250, 104, col, k=eob(prog(t, 0.15, 0.45)), angle=-3)

    def footer(self, img, t):
        ptext(img, "#ペパポン #新西ゼミ", 540, 1860, 40, WHITE, k=prog(t, 0.5, 0.9))

    def card(self, img, inner, cx, cy, ang, k):
        c = Image.new("RGBA", (inner.width + 40, inner.height + 40), (255, 255, 255, 255))
        c.paste(inner, (20, 20))
        if abs(k - 1) > 0.01:
            c = c.resize((max(2, int(c.width * k)), max(2, int(c.height * k))), Image.BILINEAR)
        c = c.rotate(ang, resample=Image.BICUBIC, expand=True)
        sh = c.getchannel("A").point(lambda v: v * 110 // 255)
        img.paste(Image.new("RGB", c.size, INK), (int(cx - c.width / 2 + 14), int(cy - c.height / 2 + 20)), sh)
        img.paste(c, (int(cx - c.width / 2), int(cy - c.height / 2)), c)

    @staticmethod
    def flash(img, a):
        return Image.blend(img, Image.new("RGB", img.size, WHITE), a) if a > 0.01 else img

    # ---- シーン ----
    def cuts(self, t):
        per = self.cfg["per"]
        i, dt = self.beat(t)
        n = max(0, i) // per
        t0 = self.bt[min(n * per, len(self.bt) - 1)]
        img = self.bg(t)
        self.header(img, t)
        pid = self.photos[n % len(self.photos)]
        calm = per >= 4
        pop = 1 + (0.015 if calm else 0.05) * math.exp(-dt * 10)
        drift = 1.03 + (0.04 * (t - t0) / (per * 0.5) if calm else 0)
        inner = fit_card(self.a.photo(pid), 820, 1060, drift * pop)
        e = eob(prog(t, t0, t0 + 0.2))
        self.card(img, inner, 540 + (1 - e) * (300 if n % 2 else -300), 1000, (-3 if n % 2 else 3), 0.8 + 0.2 * e)
        cap = self.lines[n % len(self.lines)]
        if self.dark:
            ptext(img, cap, 540, 1680, 110, GOLD, band=(150, 20, 30), k=eob(prog(t, t0, t0 + 0.15)))
        else:
            ptext(img, cap, 540, 1680, 92, WHITE, band=INK, k=eob(prog(t, t0 + 0.05, t0 + 0.25)))
        self.footer(img, t)
        if self.cfg.get("flash") and i >= 0 and i % 4 == 0 and dt < 0.06:
            img = self.flash(img, 0.25)
        if self.dark and dt < 0.08:
            a = np.asarray(img).copy()
            s = int(10 * (1 - dt / 0.08))
            a[..., 0] = np.roll(a[..., 0], s, 1)
            a[..., 2] = np.roll(a[..., 2], -s, 1)
            img = Image.fromarray(a)
        return img

    def quiz_scene(self, t):
        q = self.quiz
        i, dt = self.beat(t)
        img = self.bg(t)
        self.header(img, t)
        d = ImageDraw.Draw(img)
        ans_i = min(13, len(self.bt) - 1)
        t_ans = self.bt[ans_i]
        ptext(img, "Q. " + q["q"], 540, 470, 76, WHITE, band=INK, k=eob(prog(t, 0.3, 0.6)))
        if t < t_ans:
            self.card(img, fit_card(self.a.photo(q["photo"]), 640, 560), 540, 960, -2, eob(prog(t, 0.5, 0.8)))
            for k_, label in enumerate(q["choices"]):
                cy = 1400 + k_ * 150
                e = eob(prog(t, 1.2 + k_ * 0.15, 1.5 + k_ * 0.15))
                ptext(img, f"{'AB'[k_]}  {label}", 540, cy, 72, INK, band=WHITE, stroke=WHITE, k=e)
            cnt = 3 - (i - 1) // 4 if i >= 1 else None
            if cnt and 1 <= cnt <= 3 and t > 2.0:
                ptext(img, str(cnt), 540, 1730, 110, WHITE, band=(230, 60, 60), k=1 + 0.2 * math.exp(-dt * 8))
        else:
            e = eob(prog(t, t_ans, t_ans + 0.3))
            r = 300 * e
            d.ellipse([540 - r, 1000 - r, 540 + r, 1000 + r], fill=WHITE, outline=INK, width=10)
            ptext(img, "AB"[q["answer"]], 540, 980, 380, (230, 60, 60), stroke=WHITE, k=e)
            ptext(img, f"こたえは {q['choices'][q['answer']]}！", 540, 1450, 92, WHITE, band=INK, k=eob(prog(t, t_ans + 0.3, t_ans + 0.5)))
            ptext(img, q.get("note", ""), 540, 1620, 66, WHITE, k=eob(prog(t, t_ans + 0.55, t_ans + 0.8)))
            if t - t_ans < 0.12:
                img = self.flash(img, 0.6)
        self.footer(img, t)
        return img

    def end_card(self, t):
        te = t - END_T
        img = Image.new("RGB", (W, H), (16, 14, 20) if self.dark else CREAM)
        ink = GOLD if self.dark else INK
        k = eob(prog(te, 0, 0.35))
        i, dt = self.beat(t)
        cap = self.a.capsule().rotate((-90 * max(0, i) - 90 * eob(min(1, dt / 0.25))) % 360, resample=Image.BICUBIC, expand=True)
        if k > 0.02:
            cap = cap.resize((max(2, int(cap.width * 0.7 * k)), max(2, int(cap.height * 0.7 * k))), Image.BILINEAR)
            img.paste(cap, (int(540 - cap.width / 2), int(720 - cap.height / 2)), cap)
        lg = self.a.logo(ink)
        alpha = lg.getchannel("A").point(lambda v: int(v * prog(te, 0.15, 0.5)))
        img.paste(Image.new("RGB", lg.size, ink), (int(540 - lg.width / 2), 1130 - lg.height // 2), alpha)
        teaser = self.plan.get("tomorrowTeaser") or "おたのしみに"
        band = (150, 20, 30) if self.dark else (INK if self.paper is not None else self.base)
        ptext(img, f"あしたは「{teaser}」", 540, 1400, 74, WHITE, band=band, k=eob(prog(te, 0.3, 0.6)))
        ptext(img, "フォローしてね！", 540, 1540, 56, ink, stroke=(16, 14, 20) if self.dark else CREAM, k=prog(te, 0.6, 0.9))
        return img

    def frame(self, t):
        if t >= END_T:
            return self.end_card(t)
        img = self.quiz_scene(t) if self.quiz else self.cuts(t)
        if t < 0.12:
            img = self.flash(img, 0.6 * (1 - t / 0.12))
        return img

    def render(self, out):
        bgm = os.path.join(self.a.root, "bgm", self.bgm_file)
        ff = subprocess.Popen([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-ss", str(self.a0), "-t", str(DUR), "-i", bgm,
            "-filter_complex", f"[1:a]afade=t=in:st=0:d=0.1,afade=t=out:st={DUR - 0.9}:d=0.9,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
            "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", out,
        ], stdin=subprocess.PIPE)
        for f in range(int(DUR * FPS)):
            ff.stdin.write(self.frame(f / FPS).tobytes())
        ff.stdin.close()
        if ff.wait() != 0:
            raise RuntimeError("ffmpeg failed")


def main():
    root, plan_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    plan = json.load(open(plan_path, encoding="utf-8"))
    reel = Reel(Assets(root), plan)
    if "--stills" in sys.argv:
        ts = [float(x) for x in sys.argv[sys.argv.index("--stills") + 1:]]
        sh = Image.new("RGB", (270 * len(ts), 480))
        for k, t in enumerate(ts):
            sh.paste(reel.frame(t).resize((270, 480)), (k * 270, 0))
        sh.save(out)
    else:
        reel.render(out)
    print(json.dumps({"style": reel.style, "bgm": reel.bgm, "a0": reel.a0, "out": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
