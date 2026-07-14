"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  buildRetrospectiveSuggestion,
  retrospectiveCompleteness,
  type RetrospectiveConfidence,
  type RetrospectiveDraft,
} from "@/lib/post-retrospective";
import {
  evaluatePostKpis,
  type PostKpiPlan,
} from "@/lib/post-kpi";

const emptyDraft: RetrospectiveDraft = {
  planId: "",
  linkedPostId: null,
  summary: "",
  positives: [],
  negatives: [],
  nextActions: [],
  hypotheses: [],
  continueActions: [],
  stopActions: [],
  confidence: "medium",
};

export default function PostRetrospectivesPage() {
  const [plans, setPlans] = useState<PostKpiPlan[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<RetrospectiveDraft>(
    emptyDraft,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlans = useEffectEvent(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/post-kpis", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "投稿企画を取得できませんでした。",
          );
        }

        const loadedPlans = data.plans ?? [];
        setPlans(loadedPlans);

        if (!selectedId && loadedPlans[0]?.id) {
          setSelectedId(loadedPlans[0].id);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "投稿企画を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    });

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    async function loadRetrospective() {
      if (!selectedId) {
        setDraft(emptyDraft);
        return;
      }

      setError("");
      setMessage("");

      try {
        const response = await fetch(
          `/api/post-retrospectives?planId=${encodeURIComponent(
            selectedId,
          )}`,
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "振り返りを取得できませんでした。",
          );
        }

        const retrospective = data.retrospectives?.[0];

        if (retrospective) {
          setDraft({
            planId: retrospective.planId,
            linkedPostId: retrospective.linkedPostId,
            summary: retrospective.summary,
            positives: retrospective.positives,
            negatives: retrospective.negatives,
            nextActions: retrospective.nextActions,
            hypotheses: retrospective.hypotheses,
            continueActions: retrospective.continueActions,
            stopActions: retrospective.stopActions,
            confidence: retrospective.confidence,
          });
        } else {
          const plan = plans.find(
            (item) => item.id === selectedId,
          );

          setDraft({
            ...emptyDraft,
            planId: selectedId,
            linkedPostId: plan?.linkedPostId ?? null,
          });
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "振り返りを取得できませんでした。",
        );
      }
    }

    void loadRetrospective();
  }, [selectedId, plans]);

  const selectedPlan = plans.find(
    (plan) => plan.id === selectedId,
  );

  const evaluation = useMemo(
    () =>
      selectedPlan
        ? evaluatePostKpis(
            selectedPlan.predicted,
            selectedPlan.actual,
          )
        : null,
    [selectedPlan],
  );

  const completeness = retrospectiveCompleteness(draft);

  function applySuggestion() {
    if (!evaluation) return;

    const suggestion =
      buildRetrospectiveSuggestion(evaluation);

    setDraft((current) => ({
      ...current,
      positives: suggestion.positives,
      negatives: suggestion.negatives,
      nextActions: suggestion.nextActions,
      hypotheses: suggestion.hypotheses,
      summary:
        evaluation.averageAchievementRate === null
          ? "実績データが不足しているため、暫定的な振り返りです。"
          : `総合達成率は${evaluation.averageAchievementRate}%でした。好調指標と未達指標を確認し、次回は変更点を1つに絞って検証します。`,
    }));
  }

  async function save() {
    if (!draft.planId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/post-retrospectives",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "振り返りを保存できませんでした。",
        );
      }

      setMessage("振り返りを保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "振り返りを保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="投稿振り返り・学習ループ"
        description="予測と実績を振り返り、次回の投稿改善へつなげます。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-72 flex-1">
            <label>振り返る投稿企画</label>
            <select
              className="mt-1"
              value={selectedId}
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
            >
              <option value="">選択してください</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                  {plan.scheduledDate
                    ? `（${plan.scheduledDate}）`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/post-kpis"
            className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            KPI評価を確認
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">{message}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : !selectedPlan || !evaluation ? (
        <Panel>
          <p className="text-sm text-stone-600">
            振り返る投稿企画を選択してください。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-stone-500">
                  {selectedPlan.postType}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {selectedPlan.title}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  総合達成率：
                  {evaluation.averageAchievementRate === null
                    ? "未評価"
                    : `${evaluation.averageAchievementRate}%`}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-semibold text-stone-500">
                  振り返り完成度
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {completeness.percentage}%
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={applySuggestion}>
                KPIから振り返り案を作成
              </Button>
            </div>
          </Panel>

          <Panel>
            <Field label="総評">
              <textarea
                rows={5}
                value={draft.summary}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    summary: event.target.value,
                  })
                }
              />
            </Field>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <ArrayEditor
                title="良かった点"
                value={draft.positives}
                onChange={(value) =>
                  setDraft({ ...draft, positives: value })
                }
              />

              <ArrayEditor
                title="改善が必要な点"
                value={draft.negatives}
                onChange={(value) =>
                  setDraft({ ...draft, negatives: value })
                }
              />

              <ArrayEditor
                title="次回の具体的な行動"
                value={draft.nextActions}
                onChange={(value) =>
                  setDraft({ ...draft, nextActions: value })
                }
              />

              <ArrayEditor
                title="次に試す仮説"
                value={draft.hypotheses}
                onChange={(value) =>
                  setDraft({ ...draft, hypotheses: value })
                }
              />

              <ArrayEditor
                title="継続する施策"
                value={draft.continueActions}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    continueActions: value,
                  })
                }
              />

              <ArrayEditor
                title="やめる・減らす施策"
                value={draft.stopActions}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    stopActions: value,
                  })
                }
              />
            </div>

            <div className="mt-5 max-w-xs">
              <label>振り返りの確信度</label>
              <select
                className="mt-1"
                value={draft.confidence}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    confidence:
                      event.target
                        .value as RetrospectiveConfidence,
                  })
                }
              >
                <option value="high">高い</option>
                <option value="medium">普通</option>
                <option value="low">低い</option>
              </select>
            </div>

            <div className="mt-6">
              <Button
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "保存中..." : "振り返りを保存"}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ArrayEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const text = value.join("\n");

  return (
    <div>
      <label>{title}</label>
      <textarea
        className="mt-1"
        rows={6}
        value={text}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
        placeholder="1行につき1項目"
      />
    </div>
  );
}
