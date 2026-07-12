"use client";

import { useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  OperationConsultantContext,
  OperationConsultantResult,
} from "@/lib/operation-consultant";

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function OperationConsultantPage() {
  const initial = defaultPeriod();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [accountId, setAccountId] = useState("");
  const [context, setContext] =
    useState<OperationConsultantContext | null>(null);
  const [result, setResult] =
    useState<OperationConsultantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const scoreLabel = useMemo(() => {
    if (!context || context.summary.averageAiScore <= 0) return "未分析";
    return `${context.summary.averageAiScore}点`;
  }, [context]);

  async function loadData() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const params = new URLSearchParams({ from, to });
      if (accountId.trim()) params.set("accountId", accountId.trim());

      const response = await fetch(
        `/api/operation-consultant?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok || !data.context) {
        throw new Error(
          data.error ?? "分析データを取得できませんでした。",
        );
      }

      setContext(data.context);
    } catch (caught) {
      setContext(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "分析データを取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generatePlan() {
    if (!context) return;

    setAiLoading(true);
    setError("");

    try {
      const response = await fetch("/api/operation-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const data = await response.json();

      if (!response.ok || !data.result) {
        throw new Error(
          data.error ?? "AI運用計画を作成できませんでした。",
        );
      }

      setResult(data.result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI運用計画を作成できませんでした。",
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI運用コンサル"
        description="投稿実績とAIスコアをもとに、次の7日間の投稿戦略を作成します。"
      />

      <Panel className="mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label>分析開始日</label>
            <input
              className="mt-1"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label>分析終了日</label>
            <input
              className="mt-1"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div>
            <label>アカウントID（任意）</label>
            <input
              className="mt-1"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="空欄なら全投稿"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void loadData()} disabled={loading}>
              {loading ? "集計中..." : "運用データを集計"}
            </Button>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {!context ? (
        <Panel>
          <p className="text-sm leading-6 text-stone-600">
            分析期間を選び、「運用データを集計」を押してください。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">運用状況</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {context.period.from} 〜 {context.period.to}
                </p>
              </div>
              <Button
                onClick={() => void generatePlan()}
                disabled={aiLoading || context.summary.postCount === 0}
              >
                {aiLoading ? "AI計画作成中..." : "7日間の運用計画を作成"}
              </Button>
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="投稿数" value={`${context.summary.postCount}件`} />
            <Metric
              label="平均表示数"
              value={context.summary.averageViews.toLocaleString()}
            />
            <Metric
              label="平均反応率"
              value={`${context.summary.averageEngagementRate}%`}
            />
            <Metric
              label="平均保存率"
              value={`${context.summary.averageSaveRate}%`}
            />
            <Metric label="平均AIスコア" value={scoreLabel} />
          </div>

          {result ? (
            <>
              <Panel>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Weekly Strategy
                </p>
                <h2 className="mt-1 text-xl font-bold">今週の総評</h2>
                <p className="mt-4 leading-7 text-stone-700">
                  {result.weeklySummary}
                </p>
              </Panel>

              <Panel>
                <h2 className="font-semibold">改善の優先順位</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {result.priorities.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="rounded-lg border border-stone-200 bg-white p-4"
                    >
                      <span className="rounded-full bg-skyglass px-3 py-1 text-xs font-semibold">
                        {priorityLabel(item.priority)}
                      </span>
                      <h3 className="mt-3 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {item.reason}
                      </p>
                      <p className="mt-3 rounded-md bg-fog px-3 py-2 text-sm leading-6">
                        {item.action}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <h2 className="font-semibold">7日間の投稿カレンダー</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {result.weeklyCalendar.map((item) => (
                    <div
                      key={item.day}
                      className="rounded-lg border border-stone-200 bg-white p-4"
                    >
                      <p className="text-xs font-semibold text-stone-500">
                        {item.day}
                      </p>
                      <p className="mt-2 font-bold">
                        {postTypeLabel(item.postType)}
                      </p>
                      <p className="mt-2 text-sm">{item.theme}</p>
                      <p className="mt-2 text-xs leading-5 text-stone-500">
                        {item.purpose}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel>
                  <SimpleList
                    title="次に試す投稿テーマ"
                    items={result.contentThemes}
                  />
                </Panel>
                <Panel>
                  <SimpleList
                    title="期待できる効果"
                    items={result.expectedEffects}
                  />
                </Panel>
                <Panel>
                  <SimpleList title="注意点" items={result.cautions} />
                </Panel>
                <Panel>
                  <SimpleList title="数値根拠" items={result.evidence} />
                </Panel>
              </div>
            </>
          ) : (
            <Panel>
              <p className="text-sm leading-6 text-stone-600">
                集計結果を確認し、「7日間の運用計画を作成」を押してください。
              </p>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function SimpleList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {items.length ? (
          items.map((item) => <li key={item}>・{item}</li>)
        ) : (
          <li>該当項目はありません。</li>
        )}
      </ul>
    </div>
  );
}

function priorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "優先度：高";
  if (priority === "medium") return "優先度：中";
  return "優先度：低";
}

function postTypeLabel(
  type: "reel" | "carousel" | "image" | "video" | "rest",
) {
  const labels = {
    reel: "リール",
    carousel: "カルーセル",
    image: "画像",
    video: "動画",
    rest: "投稿休み・準備",
  };

  return labels[type];
}
