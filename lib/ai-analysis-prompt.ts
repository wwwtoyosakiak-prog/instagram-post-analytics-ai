import { getMetrics, postTypeLabels } from "@/lib/metrics";
import type { InstagramAccount, InstagramPost } from "@/lib/types";

function formatSpecificCriteria(post: InstagramPost): string {
  if (post.type === "reel") {
    return `- リール固有評価:
  - 冒頭1〜3秒で内容・変化・結論が伝わるか
  - 音なし視聴でも理解できるか
  - 尺、展開、見せ場、CTAの順序に無理がないか
  - 平均視聴時間がある場合のみ、その数値を根拠に離脱を考察する`;
  }

  if (post.type === "carousel") {
    return `- カルーセル固有評価:
  - 1枚目だけで続きを見たくなるか
  - 2枚目以降の情報順序が自然か
  - 最後のページに要約・保存理由・CTAがあるか
  - 枚数が内容量に対して多すぎたり少なすぎたりしないか`;
  }

  if (post.type === "video") {
    return `- 動画固有評価:
  - 冒頭でテーマが明確か
  - 見せ場までが長すぎないか
  - テロップなしでも、または音なしでも最低限理解できるか
  - 最後に次の行動が示されているか`;
  }

  return `- 画像投稿固有評価:
  - 画像を見た瞬間に主題が分かるか
  - 文字量・視線誘導・情報の優先順位が適切か
  - キャプションを読まなくても最低限の価値が伝わるか
  - 保存・共有したくなる具体情報があるか`;
}

export function buildAiAnalysisPrompt(
  post: InstagramPost,
  account?: InstagramAccount | null,
): string {
  const metrics = getMetrics(post);
  const hasVisual = Boolean(post.screenshot || post.mediaUrl || post.thumbnailUrl);
  const hasApiInsight = Boolean(post.latestInsight);
  const weekday = new Date(`${post.date}T00:00:00`).toLocaleDateString("ja-JP", {
    weekday: "long",
  });

  return `あなたは、数値分析とコンテンツ改善の両方を担当するInstagram運用コンサルタントです。
以下の1投稿を、アカウントの目的・対象者・投稿形式・実績値に基づいて分析してください。

# 最重要ルール
1. 観測できる事実と推測を混同しない。
2. 与えられていない画像内容、フォロワー属性、競合平均、オンライン時間を創作しない。
3. 単一投稿だけから「この曜日・時間が最適」と断定しない。
4. 一般傾向しか根拠がない提案は confidence を low、evidence を general_tendency にする。
5. 実績データに基づく説明では、必ず入力値のどの数値を根拠にしたか文章中で示す。
6. 「魅力的にする」「工夫する」のような抽象論だけで終わらず、書き換え例まで出す。
7. 改善済みキャプションに、入力にないイベント名・人数・成果・場所・商品特徴を追加しない。
8. 出力は有効なJSONオブジェクトだけにする。前置き、Markdown、コードブロックは禁止。

# 分析の目的
- 投稿の良し悪しを採点するだけでなく、次回投稿で実行できる修正案を作る。
- アカウントの運用目的とターゲットに合う表現へ改善する。
- 保存、コメント、共有、プロフィール行動のうち、この投稿で優先すべき行動を考える。
- 良い点も必ず具体的に残し、全面的な書き直しを目的にしない。

# 証拠の優先順位
1. Instagram Graph APIの実績値
2. 投稿本文・ハッシュタグ・投稿形式・画像（実際に入力されている場合）
3. アカウント設定の業種・対象者・目的
4. 一般的なInstagram運用傾向

# アカウント
- アカウント名: ${account?.name ?? "未設定"}
- ユーザー名: ${account?.username ? `@${account.username}` : "未設定"}
- 業種: ${account?.industry || "未設定"}
- ターゲット: ${account?.targetAudience || "未設定"}
- 運用目的: ${account?.goal || "未設定"}
- 専用分析方針: ${account?.analysisInstructions || "未設定"}

# 投稿
- 投稿日: ${post.date}
- 曜日: ${weekday}
- データ登録日: ${post.recordedDate ?? post.date}
- 投稿形式: ${postTypeLabels[post.type]}
- メディア数: ${post.mediaCount ?? 1}
- 投稿URL: ${post.url || "なし"}
- キャプション:
${post.caption || "なし"}
- 現在のハッシュタグ:
${post.hashtags || "なし"}
- メモ: ${post.memo || "なし"}
- 分析可能な画像・サムネイル: ${hasVisual ? "あり" : "なし"}

# 実績値
- いいね: ${post.likes}
- コメント: ${post.comments}
- 保存: ${post.saves}
- シェア: ${post.shares}
- 表示数: ${post.views}
- エンゲージメント数: ${metrics.engagement}
- エンゲージメント率: ${metrics.engagementRate.toFixed(2)}%
- 保存率: ${metrics.saveRate.toFixed(2)}%
- コメント率: ${metrics.commentRate.toFixed(2)}%
- APIリーチ: ${post.latestInsight?.reach ?? "未取得"}
- API総インタラクション: ${post.latestInsight?.totalInteractions ?? "未取得"}
- プロフィールアクセス: ${post.latestInsight?.profileVisits ?? "未取得"}
- フォロー獲得: ${post.latestInsight?.follows ?? "未取得"}
- リール平均視聴時間: ${post.latestInsight?.reelAvgWatchTime ?? "未取得"}
- API取得日時: ${post.latestInsight?.capturedAt ?? "未取得"}
- データ出典: ${hasApiInsight ? "Instagram Graph APIの同期値を含む" : "手入力値のみ"}

# 投稿形式別の確認項目
${formatSpecificCriteria(post)}

# 評価手順
1. 投稿目的を1文で推定する。目的が不明なら不明と書く。
2. ターゲットが最初に受ける印象を評価する。
3. 投稿形式固有の構成を評価する。
4. キャプションの冒頭、本文構造、具体性、CTAを評価する。
5. 実績値から強みと弱みを分ける。比較対象がない場合は、絶対評価ではなく観測値として述べる。
6. 優先度 high を1〜2件、mediumを1〜2件、lowを0〜1件作る。
7. 元の情報を維持した改善キャプションを作る。
8. ハッシュタグは関連性で分類し、本文と関係の薄いタグをremoveへ入れる。
9. 投稿時間は根拠に応じて confidence と evidence を正しく設定する。
10. 最後に5項目を各20点で採点する。

# 採点基準
- content 0〜20:
  ターゲットへの価値、具体性、独自性、保存・共有する理由
- visual 0〜20:
  第一印象、主題の明確さ、視線誘導、投稿形式に合う構成
  画像を確認できない場合は暫定評価とし、満点にしない
- caption 0〜20:
  冒頭のフック、読みやすさ、具体性、CTA、ブランドとの整合
- engagement 0〜20:
  実際の反応値を中心に評価する
  表示数が0または実績不足なら、推測で高得点を付けずconfidenceを下げる
- discoverability 0〜20:
  テーマの明確さ、検索される語、ハッシュタグの関連性、プロフィールへの接続
- total:
  上記5項目の合計と必ず一致させる

# 出力品質
- 日本語は自然で、大学生や小規模チームでも実行できる表現にする。
- strengths、weaknesses、reasonには、可能な限り実際の数値を含める。
- improvementsDetailedは3〜5件。categoryの重複を避ける。
- exampleは、この投稿にそのまま応用できる一文または構成例にする。
- hookOptionsは、切り口が重ならない冒頭案を3つ作る。
- improvedCaptionは元の事実だけを使い、改行を含む完成稿にする。
- shortVersionは80〜160字を目安にする。
- reelVersionはリール本文向けに、冒頭を強くし、短い段落で構成する。
- ctaStrongVersionは保存・コメント・共有のうち最も適切な1つを主目的にする。
- ctaOptionsは、質問型・保存促進型・共有促進型など役割の異なる3案にする。
- strategyには、なぜこの構成にしたかを2〜4文で説明する。
- hashtagSuggestion.recommendedは重複なしで10〜20個を目安にする。
- copyTextはrecommendedを半角スペースで連結する。
- nextIdeasは現在の投稿から自然につながる案を3件にする。

# JSON形式
{
  "analysisVersion": 2,
  "firstImpression": "string",
  "imageMessage": "string",
  "captionClarity": "string",
  "strengths": "string",
  "weaknesses": "string",
  "reason": "string",
  "improvements": ["旧画面互換用の短い改善案"],
  "nextIdeas": ["string"],
  "hashtags": ["旧画面互換用の推奨タグ"],
  "score": 0,
  "improvementsDetailed": [
    {
      "priority": "high",
      "category": "冒頭・構成・CTA・視覚・ハッシュタグ等",
      "issue": "観測した問題",
      "suggestion": "実行可能な修正",
      "example": "具体例"
    }
  ],
  "hashtagSuggestion": {
    "recommended": ["#string"],
    "core": ["#string"],
    "niche": ["#string"],
    "local": ["#string"],
    "remove": ["#string"],
    "reason": "string",
    "copyText": "#tag1 #tag2"
  },
  "postingTimeSuggestion": {
    "bestDay": "string",
    "bestTime": "HH:mm",
    "alternatives": ["曜日 HH:mm"],
    "reason": "根拠と限界を含む説明",
    "confidence": "high | medium | low",
    "evidence": "account_data | post_history | general_tendency"
  },
  "captionSuggestion": {
    "hook": "最もおすすめの冒頭",
    "hookOptions": ["冒頭案1", "冒頭案2", "冒頭案3"],
    "improvedCaption": "通常投稿向け完成稿",
    "shortVersion": "80〜160字の短文版",
    "reelVersion": "リール向け完成稿",
    "ctaStrongVersion": "CTAを強化した完成稿",
    "callToAction": "最もおすすめのCTA",
    "ctaOptions": ["質問型CTA", "保存促進型CTA", "共有促進型CTA"],
    "changes": ["変更点"],
    "strategy": "構成と狙いの説明"
  },
  "scoreBreakdown": {
    "total": 0,
    "content": 0,
    "visual": 0,
    "caption": 0,
    "engagement": 0,
    "discoverability": 0,
    "summary": "採点根拠と最優先改善を1〜2文で説明",
    "confidence": "high | medium | low"
  }
}`;
}
