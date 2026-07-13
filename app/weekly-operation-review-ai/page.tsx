"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type { WeeklyOperationReview } from "@/lib/weekly-operation-review";
import type { AiWeeklyReviewResult } from "@/lib/ai-weekly-review";

export default function WeeklyOperationReviewAiPage() {
  const [review, setReview] =
    useState<WeeklyOperationReview | null>(null);
  const [aiReview, setAiReview] =
    useState<AiWeeklyReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveAiReview() {
    if (!review || !aiReview) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-manager/weekly-review/ai-history",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekStart: review.weekStart,
            aiReview,
            aiModel: model,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "AI週次レビューを保存できませんでした。",
        );
      }

      setMessage("AI週次レビューを保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI週次レビューを保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError("");
    setAiReview(null);

    try {
      const reviewResponse = await fetch(
        "/api/ai-manager/weekly-review",
        { cache: "no-store" },
      );
      const reviewData = await reviewResponse.json();

      if (!reviewResponse.ok || !reviewData.review) {
        throw new Error(
          reviewData.error ??
            "週間レビューを取得できませんでした。",
        );
      }

      setReview(reviewData.review);

      const aiResponse = await fetch(
        "/api/ai-manager/weekly-review/ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            review: reviewData.review,
          }),
        },
      );
      const aiData = await aiResponse.json();

      if (!aiResponse.ok || !aiData.aiReview) {
        throw new Error(
          aiData.error ??
            "AI週間レビューを作成できませんでした。",
        );
      }

      setAiReview(aiData.aiReview);
      setModel(aiData.model ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI週間レビューを作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI週次レビュー"
        description="今週の運用結果をAIが解釈し、来週の優先課題と実行計画を作成します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            AIは日次記録から作成された週次レビューだけを使います。成果を保証する予測は行いません。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void generate()}
              disabled={loading}
            >
              {loading
                ? "AIレビュー作成中..."
                : "AI週次レビューを作成"}
            </Button>
            <Button
              onClick={() => void saveAiReview()}
              disabled={saving || !aiReview || !review}
            >
              {saving
                ? "保存中..."
                : "AIレビューを保存"}
            </Button>
            <Link
              href="/weekly-operation-review-ai-history"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              AI週次履歴
            </Link>
            <Link
              href="/weekly-operation-review"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              数値レビュー
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            {message}
          </p>
        </Panel>
      ) : null}

      {!aiReview ? (
        <Panel>
          <p className="text-sm text-stone-600">
            ボタンを押すと、今週の記録から翌週の行動計画を作成します。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="対象週"
              value={`${review?.weekStart ?? ""}〜${review?.weekEnd ?? ""}`}
            />
            <Metric
              label="記録日数"
              value={`${review?.daysRecorded ?? 0}日`}
            />
            <Metric
              label="AI確信度"
              value={confidenceLabel(
                aiReview.confidence,
              )}
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              今週の総評
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
              {aiReview.executiveSummary}
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="border-emerald-200 bg-emerald-50">
              <p className="text-xs font-semibold text-emerald-800">
                最も良かった点
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {aiReview.bestPerformance.title}
              </h2>
              <p className="mt-3 text-sm leading-6">
                {aiReview.bestPerformance.reason}
              </p>
            </Panel>

            <Panel className="border-red-200 bg-red-50">
              <p className="text-xs font-semibold text-red-800">
                最も改善すべき点
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {aiReview.biggestIssue.title}
              </h2>
              <p className="mt-3 text-sm leading-6">
                {aiReview.biggestIssue.reason}
              </p>
              <p className="mt-3 text-sm leading-6">
                <strong>修正行動：</strong>
                {aiReview.biggestIssue.correctiveAction}
              </p>
            </Panel>
          </div>

          <Panel className="border-amber-200 bg-amber-50">
            <p className="text-xs font-semibold text-amber-800">
              来週の最優先課題
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {aiReview.nextWeekPriority.title}
            </h2>
            <p className="mt-3 text-sm leading-6">
              <strong>目標：</strong>
              {aiReview.nextWeekPriority.target}
            </p>
            <p className="mt-2 text-sm leading-6">
              <strong>理由：</strong>
              {aiReview.nextWeekPriority.reason}
            </p>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              7日間の行動計画
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {aiReview.actionPlan.map(
                (item, index) => (
                  <div
                    key={`${item.day}-${index}`}
                    className="rounded-lg border border-stone-200 bg-white p-5"
                  >
                    <p className="text-xs font-semibold text-stone-500">
                      {item.day}
                    </p>
                    <h3 className="mt-2 font-bold">
                      {item.action}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {item.purpose}
                    </p>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                続けること
              </h2>
              <List items={aiReview.continueActions} />
            </Panel>
            <Panel>
              <h2 className="font-semibold">
                やめる・減らすこと
              </h2>
              <List items={aiReview.stopActions} />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                成功判定の指標
              </h2>
              <List items={aiReview.successMetrics} />
            </Panel>
            <Panel>
              <h2 className="font-semibold">
                分析上の制約
              </h2>
              <List items={aiReview.limitations} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
      {items.length ? (
        items.map((item) => (
          <li key={item}>・{item}</li>
        ))
      ) : (
        <li>該当項目はありません。</li>
      )}
    </ul>
  );
}

function confidenceLabel(
  confidence: AiWeeklyReviewResult["confidence"],
) {
  if (confidence === "high") return "高い";
  if (confidence === "medium") return "普通";
  return "低い";
}
