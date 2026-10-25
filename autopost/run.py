"""毎朝の自動投稿：企画 → 動画生成 → アップロード → Instagram公開

環境変数:
  AUTOPOST_ASSETS   素材フォルダ（catalog.json / photos / bgm / queue）
  BASE_URL          アプリのURL（例: https://instagram-post-analytics-ai.vercel.app）
  CRON_SECRET       アプリのCRON_SECRET
  AUTOPOST_DATE     日付を上書き（YYYY-MM-DD、省略時は日本時間の今日）
  DRY_RUN           "true" なら動画を作るだけで投稿しない
  OUT_DIR           生成物の保存先（既定: autopost-out）
  PUBLISH_AT        "07:30" のように指定すると、動画を作り終えてからその時刻（日本時間）まで待って投稿
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
JST = timezone(timedelta(hours=9))
WEEKDAY_JA = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]
STYLE_ROTATION = ["pop", "kraft", "quiz", "pop", "dark", "sdgs", "story"]


def log(msg):
    print(f"[autopost] {msg}", flush=True)


def api(action, payload=None, timeout=90):
    body = json.dumps({"action": action, **(payload or {})}).encode()
    req = urllib.request.Request(
        os.environ["BASE_URL"].rstrip("/") + "/api/cron/autopost",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {os.environ['CRON_SECRET']}"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            if e.code < 500 or attempt == 2:
                raise RuntimeError(f"{action} failed: HTTP {e.code} {detail}") from None
        except urllib.error.URLError as e:
            if attempt == 2:
                raise RuntimeError(f"{action} failed: {e}") from None
        time.sleep(5 * (attempt + 1))


def fallback_plan(date, catalog, history):
    """AI企画が使えないときの予備：曜日ローテーション＋最近使っていない写真"""
    d = datetime.fromisoformat(date)
    style = STYLE_ROTATION[d.weekday()]
    used = [p for h in history[-5:] for p in h.get("photos", [])]
    photos = [p for p in catalog["photos"] if p not in used and not p.startswith(("sdgs_", "quiz_"))]
    offset = d.toordinal() % max(1, len(photos))
    photos = (photos[offset:] + photos[:offset])[:5]
    quizzes = catalog.get("quizzes", [])
    quiz = quizzes[d.toordinal() % len(quizzes)]["id"] if quizzes else None
    if style == "sdgs":
        photos = ["sdgs_capsule", "sdgs_work", "sdgs_recycle", "sdgs_again"]
    return {
        "style": style if (style != "quiz" or quiz) else "pop",
        "theme": {"pop": "みんなの ガチャ", "kraft": "てづくり ガチャ", "quiz": "だんボールクイズ", "dark": "作品コレクション",
                  "sdgs": "ガチャと SDGs", "story": "きょうの いちまい"}[style],
        "lines": {"sdgs": ["カプセルも てづくり", "はたらく ひとを ささえる", "つかったら しげんごみへ", "また だんボールに！"]}.get(
            style, ["ぼくの ガチャ", "わたしの ガチャ", "どれが すき？", "つくってみよう！"]),
        "photos": photos,
        "quizId": quiz if style == "quiz" else None,
        "tomorrowTeaser": "おたのしみに",
        "caption": "きょうの ペパポン📦✨\n\nワークショップで子どもたちがつくった、だんボールのガチャガチャを紹介します。\nかお・いろ・かざりつけ、ひとつとして同じものはありません🎨",
        "commentPrompt": "どの作品がすき？コメントでおしえてね！",
        "hashtags": ["ダンボール工作", "親子工作", "手作りおもちゃ"],
    }


ABOUT = ("📦 だんボールガチャ「ペパポン」は、だんボールの板を組み立ててつくる手づくりガチャガチャ。"
         "株式会社ペパポン × 多摩大学 新西ゼミの産学連携プロジェクトとして、子ども向けワークショップや多摩祭で活動しています。")
CTA = "🔖 保存して工作の参考にしてね\n🔔 フォローすると毎朝7:30に新しい動画が届きます"


def build_caption(plan, catalog):
    style = plan.get("style", "")
    tags = []
    for t in list(catalog.get("baseTags", [])) + list(plan.get("hashtags", [])) + list(catalog.get("styleTags", {}).get(style, [])) + list(catalog.get("extraTags", [])):
        t = str(t).lstrip("#").replace(" ", "").replace("　", "")
        if t and t not in tags:
            tags.append(t)
    parts = [plan.get("caption", "").strip()]
    if plan.get("commentPrompt"):
        parts.append("💬 " + plan["commentPrompt"].strip())
    parts += [ABOUT, CTA, " ".join("#" + t for t in tags[:25])]
    return "\n\n".join(p for p in parts if p)


def wait_until_publish_time(date):
    at = os.environ.get("PUBLISH_AT", "").strip()
    if not at:
        return
    hh, mm = (int(x) for x in at.split(":"))
    target = datetime.fromisoformat(date).replace(hour=hh, minute=mm, tzinfo=JST)
    wait = (target - datetime.now(JST)).total_seconds()
    if 0 < wait <= 60 * 60:
        log(f"{at} まで {int(wait)} 秒待ちます")
        time.sleep(wait)


def upload(path, local):
    info = api("upload-url", {"path": path})
    with open(local, "rb") as f:
        data = f.read()
    req = urllib.request.Request(info["uploadUrl"], data=data, method="PUT",
                                 headers={"Content-Type": "video/mp4", "x-upsert": "true"})
    with urllib.request.urlopen(req, timeout=180) as res:
        if res.status >= 300:
            raise RuntimeError(f"upload failed: HTTP {res.status}")
    log(f"uploaded {len(data) / 1e6:.1f} MB -> {path}")


def publish(path, caption, entry, date):
    container = api("create", {"path": path, "caption": caption})["containerId"]
    log(f"container {container}")
    deadline = time.time() + 8 * 60
    while True:
        st = api("status", {"containerId": container})
        log(f"status {st.get('statusCode')} {st.get('status', '')}")
        if st.get("statusCode") == "FINISHED":
            break
        if st.get("statusCode") in ("ERROR", "EXPIRED") or time.time() > deadline:
            raise RuntimeError(f"Instagramの動画処理に失敗しました: {st}")
        time.sleep(10)
    return api("publish", {"containerId": container, "date": date, "entry": entry})


def main():
    assets = os.environ.get("AUTOPOST_ASSETS", "autopost-assets")
    out_dir = os.environ.get("OUT_DIR", "autopost-out")
    dry = os.environ.get("DRY_RUN", "").lower() == "true"
    os.makedirs(out_dir, exist_ok=True)
    date = os.environ.get("AUTOPOST_DATE") or datetime.now(JST).date().isoformat()
    weekday = WEEKDAY_JA[datetime.fromisoformat(date).weekday()]
    catalog = json.load(open(os.path.join(assets, "catalog.json"), encoding="utf-8"))
    log(f"date={date} ({weekday}) dry_run={dry}")

    history = []
    if not dry:
        history = api("history").get("history", [])
        if any(h.get("date") == date and h.get("mediaId") for h in history):
            log("今日はすでに投稿済みです。スキップします。")
            return

    queued = catalog.get("queue", {}).get(date)
    if queued:
        source = "queue"
        video = os.path.join(assets, "queue", queued["file"])
        plan = {"style": queued["style"], "theme": queued["theme"], "photos": [], "caption": queued["caption"],
                "commentPrompt": queued.get("commentPrompt", ""), "hashtags": queued.get("hashtags", [])}
        log(f"予約済み動画を使います: {queued['file']}")
    else:
        photos = [{"id": k, "tags": v} for k, v in catalog["photos"].items()]
        quizzes = [{"id": q["id"], "q": q["q"]} for q in catalog.get("quizzes", [])]
        try:
            if dry and not os.environ.get("CRON_SECRET"):
                raise RuntimeError("dry run without API")
            res = api("plan", {"date": date, "weekday": weekday, "photos": photos, "ideas": catalog.get("ideas", []), "quizzes": quizzes}, timeout=120)
            plan, source = res["plan"], "ai"
            history = history or res.get("recent", [])
        except Exception as e:  # noqa: BLE001 - 企画に失敗しても投稿は止めない
            log(f"AI企画に失敗したので予備の企画を使います: {e}")
            plan, source = fallback_plan(date, catalog, history), "fallback"
        plan["date"] = date
        plan_path = os.path.join(out_dir, f"{date}-plan.json")
        json.dump(plan, open(plan_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        log("plan: " + json.dumps(plan, ensure_ascii=False))
        video = os.path.join(out_dir, f"{date}.mp4")
        subprocess.run([sys.executable, os.path.join(HERE, "render.py"), assets, plan_path, video], check=True)
        subprocess.run([sys.executable, os.path.join(HERE, "render.py"), assets, plan_path,
                        os.path.join(out_dir, f"{date}-preview.png"), "--stills", "0.8", "3.0", "5.2", "7.2", "8.8"], check=True)

    caption = build_caption(plan, catalog)
    open(os.path.join(out_dir, f"{date}-caption.txt"), "w", encoding="utf-8").write(caption)
    log("caption:\n" + caption)
    if dry:
        log(f"DRY_RUN: 投稿せずに終了します（{video}）")
        return

    wait_until_publish_time(date)
    remote = f"videos/{date}.mp4"
    upload(remote, video)
    entry = {"theme": plan.get("theme", ""), "style": plan.get("style", ""), "photos": plan.get("photos", []),
             "caption": caption, "source": source}
    result = publish(remote, caption, entry, date)
    log(f"公開しました: {result.get('permalink') or result.get('mediaId')}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(f"## {date} の自動投稿\n\n- テーマ: {plan.get('theme')}\n- スタイル: {plan.get('style')}\n- 企画: {source}\n"
                    f"- 投稿: {result.get('permalink') or result.get('mediaId')}\n\n```\n{caption}\n```\n")


if __name__ == "__main__":
    main()
