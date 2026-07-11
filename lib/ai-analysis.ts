import {
  AiAnalysis,
  AiCaptionSuggestion,
  AiHashtagSuggestion,
  AiImprovementDetail,
  AiPostingTimeSuggestion,
  AiScoreBreakdown,
} from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function numberInRange(value: unknown, min: number, max: number, fallback = min): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function confidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function normalizeImprovement(value: unknown): AiImprovementDetail | null {
  const item = record(value);
  const priority = item.priority === "high" || item.priority === "medium" || item.priority === "low" ? item.priority : "medium";
  const suggestion = text(item.suggestion);
  if (!suggestion) return null;
  return { priority, category: text(item.category, "投稿内容"), issue: text(item.issue), suggestion, example: text(item.example) };
}

function normalizeHashtags(value: unknown, legacy: string[]): AiHashtagSuggestion | undefined {
  const item = record(value);
  const recommended = textArray(item.recommended);
  if (!recommended.length && !legacy.length) return undefined;
  const selected = recommended.length ? recommended : legacy;
  return {
    recommended: selected,
    core: textArray(item.core),
    niche: textArray(item.niche),
    local: textArray(item.local),
    remove: textArray(item.remove),
    reason: text(item.reason),
    copyText: text(item.copyText, selected.join(" ")),
  };
}

function normalizePostingTime(value: unknown): AiPostingTimeSuggestion | undefined {
  const item = record(value);
  if (!text(item.bestDay) && !text(item.bestTime)) return undefined;
  const evidence = item.evidence === "account_data" || item.evidence === "post_history" ? item.evidence : "general_tendency";
  return {
    bestDay: text(item.bestDay, "未特定"),
    bestTime: text(item.bestTime, "20:00"),
    alternatives: textArray(item.alternatives),
    reason: text(item.reason),
    confidence: confidence(item.confidence),
    evidence,
  };
}

function normalizeCaption(value: unknown): AiCaptionSuggestion | undefined {
  const item = record(value);
  const improvedCaption = text(item.improvedCaption);
  if (!improvedCaption) return undefined;
  return {
    hook: text(item.hook),
    hookOptions: textArray(item.hookOptions),
    improvedCaption,
    shortVersion: text(item.shortVersion),
    reelVersion: text(item.reelVersion),
    ctaStrongVersion: text(item.ctaStrongVersion),
    callToAction: text(item.callToAction),
    ctaOptions: textArray(item.ctaOptions),
    changes: textArray(item.changes),
    strategy: text(item.strategy),
  };
}

function normalizeScore(value: unknown, legacyScore: number): AiScoreBreakdown | undefined {
  const item = record(value);
  if (!Object.keys(item).length) return undefined;
  const parts = {
    content: numberInRange(item.content, 0, 20),
    visual: numberInRange(item.visual, 0, 20),
    caption: numberInRange(item.caption, 0, 20),
    engagement: numberInRange(item.engagement, 0, 20),
    discoverability: numberInRange(item.discoverability, 0, 20),
  };
  const calculated = Object.values(parts).reduce((sum, current) => sum + current, 0);
  return {
    total: numberInRange(item.total, 0, 100, calculated || legacyScore),
    ...parts,
    summary: text(item.summary),
    confidence: confidence(item.confidence),
  };
}

export function normalizeAiAnalysis(value: unknown): AiAnalysis {
  const item = record(value);
  const improvements = textArray(item.improvements);
  const nextIdeas = textArray(item.nextIdeas);
  const hashtags = textArray(item.hashtags);
  const score = numberInRange(item.score, 0, 100);
  const improvementsDetailed = Array.isArray(item.improvementsDetailed)
    ? item.improvementsDetailed.map(normalizeImprovement).filter((entry): entry is AiImprovementDetail => Boolean(entry))
    : [];
  const scoreBreakdown = normalizeScore(item.scoreBreakdown, score);
  const normalizedScore = scoreBreakdown?.total ?? score;

  return {
    analysisVersion: item.analysisVersion === 2 ? 2 : undefined,
    firstImpression: text(item.firstImpression),
    imageMessage: text(item.imageMessage),
    captionClarity: text(item.captionClarity),
    strengths: text(item.strengths),
    weaknesses: text(item.weaknesses),
    reason: text(item.reason),
    improvements: improvements.length ? improvements : improvementsDetailed.map((entry) => entry.suggestion),
    nextIdeas,
    hashtags,
    score: normalizedScore,
    improvementsDetailed: improvementsDetailed.length ? improvementsDetailed : undefined,
    hashtagSuggestion: normalizeHashtags(item.hashtagSuggestion, hashtags),
    postingTimeSuggestion: normalizePostingTime(item.postingTimeSuggestion),
    captionSuggestion: normalizeCaption(item.captionSuggestion),
    scoreBreakdown,
  };
}
