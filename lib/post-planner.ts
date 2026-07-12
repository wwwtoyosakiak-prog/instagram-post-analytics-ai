export type PostPlannerInput = {
  goal: "reach" | "engagement" | "saves" | "followers" | "awareness";
  postType: "reel" | "carousel" | "image" | "video";
  theme: string;
  audience: string;
  keyMessage: string;
  tone: string;
  duration?: string;
  notes?: string;
};

export type PostPlannerScene = {
  order: number;
  timing: string;
  visual: string;
  narration: string;
  textOverlay: string;
};

export type PostPlannerSlide = {
  order: number;
  title: string;
  body: string;
  visual: string;
};

export type PostPlannerResult = {
  title: string;
  concept: string;
  hook: string;
  reelScript: PostPlannerScene[];
  carouselSlides: PostPlannerSlide[];
  caption: string;
  shortCaption: string;
  hashtags: string[];
  callToAction: string;
  thumbnailText: string;
  productionChecklist: string[];
  cautions: string[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 20)
    : [];
}

export function normalizePostPlannerResult(
  value: unknown,
): PostPlannerResult {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const reelScript = Array.isArray(source.reelScript)
    ? source.reelScript
        .map((item, index) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            order:
              typeof row.order === "number" ? row.order : index + 1,
            timing: text(row.timing),
            visual: text(row.visual),
            narration: text(row.narration),
            textOverlay: text(row.textOverlay),
          };
        })
        .filter((item) => item.visual || item.narration)
        .slice(0, 12)
    : [];

  const carouselSlides = Array.isArray(source.carouselSlides)
    ? source.carouselSlides
        .map((item, index) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            order:
              typeof row.order === "number" ? row.order : index + 1,
            title: text(row.title),
            body: text(row.body),
            visual: text(row.visual),
          };
        })
        .filter((item) => item.title || item.body)
        .slice(0, 12)
    : [];

  return {
    title: text(source.title),
    concept: text(source.concept),
    hook: text(source.hook),
    reelScript,
    carouselSlides,
    caption: text(source.caption),
    shortCaption: text(source.shortCaption),
    hashtags: textArray(source.hashtags),
    callToAction: text(source.callToAction),
    thumbnailText: text(source.thumbnailText),
    productionChecklist: textArray(source.productionChecklist),
    cautions: textArray(source.cautions),
  };
}

export function buildPostPlannerPrompt(input: PostPlannerInput) {
  return `あなたはInstagram投稿企画の編集者です。
以下の条件をもとに、実際に制作できる投稿企画を日本語で作成してください。

重要ルール:
- 投稿形式に合った構成を作る。
- reelまたはvideoの場合はreelScriptを詳しく作り、carouselSlidesは空配列にする。
- carouselの場合はcarouselSlidesを詳しく作り、reelScriptは空配列にする。
- imageの場合は1枚画像向けの企画にし、両方を空配列にしてよい。
- 実績や効果を保証しない。
- 入力にない事実、イベント情報、商品性能を創作しない。
- ハッシュタグは10〜15個程度。無関係な人気タグを混ぜない。
- キャプションは冒頭のフック、本文、CTAが分かる構成にする。
- 出力はJSONオブジェクトのみ。

入力:
${JSON.stringify(input, null, 2)}

出力形式:
{
  "title": "企画名",
  "concept": "企画の狙い",
  "hook": "冒頭で使う短いフック",
  "reelScript": [
    {
      "order": 1,
      "timing": "0〜3秒",
      "visual": "映像内容",
      "narration": "ナレーション",
      "textOverlay": "画面テロップ"
    }
  ],
  "carouselSlides": [
    {
      "order": 1,
      "title": "スライド見出し",
      "body": "本文",
      "visual": "画像やデザイン指示"
    }
  ],
  "caption": "完成版キャプション",
  "shortCaption": "短文版",
  "hashtags": ["#タグ"],
  "callToAction": "CTA",
  "thumbnailText": "サムネイル文字",
  "productionChecklist": ["制作チェック項目"],
  "cautions": ["注意点"]
}`;
}
