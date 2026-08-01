"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deletePostData,
  loadAccountsData,
  loadAnalysesData,
  loadInsightData,
  loadPostsData,
  saveAnalysisData,
} from "@/lib/cloud-storage";
import type {
  AiAnalysis,
  AiAnalysisRecord,
  InstagramAccount,
  InstagramInsightSnapshot,
  InstagramPost,
} from "@/lib/types";
import { getMetrics } from "@/lib/metrics";
import { matchPostToMedia, type ApiMedia } from "@/lib/post-merge";
import { requestJson, requestJsonOr } from "@/lib/client-api";

export function usePostDetail(id: string) {
  const router = useRouter();
  const [post, setPost] = useState<InstagramPost | null>(null);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AiAnalysisRecord[]>([]);
  const [latestInsight, setLatestInsight] = useState<InstagramInsightSnapshot | null>(null);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [matchedMedia, setMatchedMedia] = useState<ApiMedia | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");

  useEffect(() => {
    let active = true;
    setInsightLoading(true);

    void Promise.all([
      loadPostsData(),
      loadAccountsData(),
      loadAnalysesData(id),
      loadInsightData(id),
      requestJsonOr<{ data?: ApiMedia[] }>("/api/instagram/media?limit=200", { data: [] }),
    ]).then(([posts, accounts, analyses, insightData, mediaJson]) => {
      if (!active) return;
      const foundPost = posts.find((item) => item.id === id) ?? null;
      setPost(foundPost);
      setAccount(accounts[0] ?? null);
      setAnalysisHistory(analyses);
      setAnalysis(analyses[0] ?? null);
      setLatestInsight(insightData.insight);
      setInsightHistory(insightData.insights);
      const mediaList = (mediaJson as { data?: ApiMedia[] }).data ?? [];
      setMatchedMedia(foundPost ? matchPostToMedia(foundPost, mediaList) ?? null : null);
      setInsightLoading(false);
    });

    return () => { active = false; };
  }, [id]);

  const metrics = useMemo(() => post ? getMetrics(post) : null, [post]);

  const analyze = async () => {
    if (!post) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await requestJson<{ analysis: AiAnalysis }>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post, account }),
      }, "分析に失敗しました。");
      setAnalysis(data.analysis);
      setSavingAnalysis(true);
      const saved = await saveAnalysisData(post.id, data.analysis);
      if (saved) {
        setAnalysisHistory((current) => [saved, ...current]);
        setAnalysis(saved);
        setAnalysisMessage("AI分析結果を保存しました。");
      } else {
        setAnalysisMessage("AI分析結果を表示しました。サーバー保存は未設定です。");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI分析に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setAnalyzing(false);
      setSavingAnalysis(false);
    }
  };

  const removePost = async () => {
    if (!post || !window.confirm("この投稿データを削除しますか？")) return;
    await deletePostData(post.id);
    router.push("/posts");
  };

  return {
    post,
    metrics,
    analysis,
    setAnalysis,
    analysisHistory,
    latestInsight,
    insightHistory,
    matchedMedia,
    insightLoading,
    analyzing,
    savingAnalysis,
    error,
    analysisMessage,
    analyze,
    removePost,
  };
}
