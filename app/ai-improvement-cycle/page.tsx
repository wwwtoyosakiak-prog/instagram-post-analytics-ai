"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  cycleStatusLabel,
  evaluateImprovementCycle,
  type ImprovementCycle,
  type ImprovementCycleStatus,
} from "@/lib/ai-improvement-cycle";

const initialForm = {
  weekStart: "",
  weekEnd: "",
  title: "",
  hypothesis: "",
  action: "",
  metricName: "",
  baselineValue: "",
  targetValue: "",
};

export default function AiImprovementCyclePage() {
  const [cycles, setCycles] = useState<ImprovementCycle[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCycles() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ai-improvement-cycles",
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "改善サイクルを取得できませんでした。",
        );
      }

      setCycles(data.cycles ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "改善サイクルを取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCycles();
  }, []);

  const activeCycle = useMemo(
    () =>
      cycles.find(
        (cycle) =>
          cycle.status === "planned" ||
          cycle.status === "in_progress" ||
          cycle.status === "completed",
      ) ?? null,
    [cycles],
  );

  function numberOrNull(value: string) {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function createCycle() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-improvement-cycles",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            baselineValue: numberOrNull(
              form.baselineValue,
            ),
            targetValue: numberOrNull(
              form.targetValue,
            ),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "改善サイクルを作成できませんでした。",
        );
      }

      setForm(initialForm);
      setMessage("改善サイクルを作成しました。");
      await loadCycles();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "改善サイクルを作成できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateCycle(
    cycle: ImprovementCycle,
    patch: {
      resultValue?: number | null;
      status?: ImprovementCycleStatus;
      evaluation?: string;
    },
  ) {
    setError("");
    setMessage("");

    const response = await fetch(
      "/api/ai-improvement-cycles",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: cycle.id,
          ...patch,
        }),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(
        data.error ??
          "改善サイクルを更新できませんでした。",
      );
      return;
    }

    setMessage("改善サイクルを更新しました。");
    await loadCycles();
  }

  async function evaluateCycle(
    cycle: ImprovementCycle,
    resultValue: number | null,
  ) {
    const result = evaluateImprovementCycle(
      cycle.baselineValue,
      cycle.targetValue,
      resultValue,
    );

    await updateCycle(cycle, {
      resultValue,
      status: result.decision,
      evaluation: `${result.message}${
        result.achievementRate === null
          ? ""
          : ` 達成率: ${result.achievementRate}%`
      }`,
    });
  }

  return (
    <div>
      <PageHeader
        title="AI改善サイクル"
        description="週次レビューの課題を、1週間で検証できる改善施策へ変換します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            同時に試す主要な改善テーマは1つに絞ると、結果の原因を判断しやすくなります。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/weekly-operation-review-ai-history"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              AI週次履歴
            </Link>
            <Button
              onClick={() => void loadCycles()}
              disabled={loading}
            >
              更新
            </Button>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            {message}
          </p>
        </Panel>
      ) : null}

      {activeCycle ? (
        <Panel className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800">
            現在の改善テーマ
          </p>
          <h2 className="mt-2 text-xl font-bold">
            {activeCycle.title}
          </h2>
          <p className="mt-3 text-sm leading-6">
            {activeCycle.action}
          </p>
          <p className="mt-3 text-sm">
            状態：
            {cycleStatusLabel(activeCycle.status)}
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Panel>
          <h2 className="font-semibold">
            改善施策を作成
          </h2>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="開始日"
                type="date"
                value={form.weekStart}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    weekStart: value,
                  }))
                }
              />
              <Field
                label="終了日"
                type="date"
                value={form.weekEnd}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    weekEnd: value,
                  }))
                }
              />
            </div>

            <Field
              label="改善テーマ"
              value={form.title}
              placeholder="例：保存率を改善する"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  title: value,
                }))
              }
            />

            <TextArea
              label="仮説"
              value={form.hypothesis}
              placeholder="例：冒頭で完成形を見せると保存率が上がる"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  hypothesis: value,
                }))
              }
            />

            <TextArea
              label="実行する施策"
              value={form.action}
              placeholder="例：今週のリール3本すべてで最初の1秒に完成形を表示する"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  action: value,
                }))
              }
            />

            <Field
              label="成功判定KPI"
              value={form.metricName}
              placeholder="例：保存率（%）"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  metricName: value,
                }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="基準値"
                type="number"
                value={form.baselineValue}
                placeholder="例：2.5"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    baselineValue: value,
                  }))
                }
              />
              <Field
                label="目標値"
                type="number"
                value={form.targetValue}
                placeholder="例：4.0"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    targetValue: value,
                  }))
                }
              />
            </div>

            <Button
              onClick={() => void createCycle()}
              disabled={saving}
            >
              {saving
                ? "作成中..."
                : "改善サイクルを作成"}
            </Button>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-semibold">
            改善履歴
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-stone-500">
              読み込み中...
            </p>
          ) : cycles.length ? (
            <div className="mt-4 space-y-4">
              {cycles.map((cycle) => (
                <CycleCard
                  key={cycle.id}
                  cycle={cycle}
                  onStart={() =>
                    void updateCycle(cycle, {
                      status: "in_progress",
                    })
                  }
                  onComplete={() =>
                    void updateCycle(cycle, {
                      status: "completed",
                    })
                  }
                  onEvaluate={(resultValue) =>
                    void evaluateCycle(
                      cycle,
                      resultValue,
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-500">
              改善サイクルはまだありません。
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CycleCard({
  cycle,
  onStart,
  onComplete,
  onEvaluate,
}: {
  cycle: ImprovementCycle;
  onStart: () => void;
  onComplete: () => void;
  onEvaluate: (value: number | null) => void;
}) {
  const [result, setResult] = useState(
    cycle.resultValue?.toString() ?? "",
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-500">
            {cycle.weekStart}〜{cycle.weekEnd}
          </p>
          <h3 className="mt-2 text-lg font-bold">
            {cycle.title}
          </h3>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
          {cycleStatusLabel(cycle.status)}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm leading-6">
        <div>
          <dt className="font-semibold">仮説</dt>
          <dd className="text-stone-600">
            {cycle.hypothesis}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">施策</dt>
          <dd className="text-stone-600">
            {cycle.action}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">KPI</dt>
          <dd className="text-stone-600">
            {cycle.metricName}：
            {cycle.baselineValue ?? "未設定"} →{" "}
            {cycle.targetValue ?? "未設定"}
          </dd>
        </div>
      </dl>

      {cycle.evaluation ? (
        <div className="mt-4 rounded-lg bg-stone-50 p-4 text-sm leading-6">
          {cycle.evaluation}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        {cycle.status === "planned" ? (
          <Button onClick={onStart}>
            実行を開始
          </Button>
        ) : null}

        {cycle.status === "in_progress" ? (
          <Button onClick={onComplete}>
            実施完了
          </Button>
        ) : null}

        {cycle.status === "completed" ? (
          <>
            <div className="min-w-40">
              <label>結果値</label>
              <input
                className="mt-1"
                type="number"
                step="any"
                value={result}
                onChange={(event) =>
                  setResult(event.target.value)
                }
              />
            </div>
            <Button
              onClick={() =>
                onEvaluate(
                  result.trim()
                    ? Number(result)
                    : null,
                )
              }
            >
              結果を評価
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        className="mt-1"
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <textarea
        className="mt-1 min-h-24"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}
