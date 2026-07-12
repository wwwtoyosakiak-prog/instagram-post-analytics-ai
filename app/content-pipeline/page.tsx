"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import {
  dueDateStatus,
  groupPipelineCards,
  pipelinePriorityLabels,
  pipelineStages,
  type PipelineCard,
  type PipelinePriority,
  type PipelineStage,
} from "@/lib/content-pipeline";

export default function ContentPipelinePage() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(() => groupPipelineCards(cards), [cards]);

  useEffect(() => {
    async function loadCards() {
      try {
        const response = await fetch("/api/content-pipeline", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "パイプラインを取得できませんでした。",
          );
        }

        setCards(data.cards ?? []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "パイプラインを取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCards();
  }, []);

  async function updateCard(
    id: string,
    patch: {
      stage?: PipelineStage;
      priority?: PipelinePriority;
      assignee?: string;
      dueDate?: string | null;
      scheduledDate?: string | null;
    },
  ) {
    const previous = cards;
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, ...patch } : card,
      ),
    );

    const response = await fetch("/api/content-pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await response.json();

    if (!response.ok || !data.card) {
      setCards(previous);
      setError(data.error ?? "更新できませんでした。");
      return;
    }

    setCards((current) =>
      current.map((card) =>
        card.id === id ? data.card : card,
      ),
    );
  }

  function dropCard(stage: PipelineStage) {
    if (!draggingId) return;
    void updateCard(draggingId, { stage });
    setDraggingId(null);
  }

  return (
    <div>
      <PageHeader
        title="コンテンツパイプライン"
        description="保存した投稿企画を、アイデアから投稿済みまでカンバン形式で管理します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm leading-6 text-stone-600">
              カードをドラッグして工程を移動できます。担当者・締切・優先度もカード内で変更できます。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/post-planner"
              className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
            >
              新しい企画を作る
            </Link>
            <Link
              href="/post-plan-history"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              企画履歴
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[2400px] grid-cols-8 gap-4">
            {pipelineStages.map((stage) => (
              <section
                key={stage.value}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropCard(stage.value)}
                className="min-h-[520px] rounded-xl border border-stone-200 bg-white/55 p-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{stage.label}</h2>
                  <span className="rounded-full bg-fog px-2 py-1 text-xs font-semibold">
                    {grouped[stage.value].length}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {grouped[stage.value].map((card) => (
                    <PipelineCardView
                      key={card.id}
                      card={card}
                      today={today}
                      onDragStart={() => setDraggingId(card.id)}
                      onUpdate={(patch) =>
                        void updateCard(card.id, patch)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineCardView({
  card,
  today,
  onDragStart,
  onUpdate,
}: {
  card: PipelineCard;
  today: string;
  onDragStart: () => void;
  onUpdate: (patch: {
    priority?: PipelinePriority;
    assignee?: string;
    dueDate?: string | null;
    scheduledDate?: string | null;
  }) => void;
}) {
  const dueStatus = dueDateStatus(card.dueDate, today);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-lg border border-stone-200 bg-white p-4 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-stone-500">
            {postTypeLabel(card.postType)}
          </p>
          <h3 className="mt-1 font-bold leading-6">{card.title}</h3>
        </div>
        <span className="rounded-full bg-skyglass px-2 py-1 text-xs font-semibold">
          優先度 {pipelinePriorityLabels[card.priority]}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-stone-500">
        {card.theme}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs">優先度</label>
          <select
            className="mt-1 text-sm"
            value={card.priority}
            onChange={(event) =>
              onUpdate({
                priority:
                  event.target.value as PipelinePriority,
              })
            }
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>

        <div>
          <label className="text-xs">担当者</label>
          <input
            className="mt-1 text-sm"
            value={card.assignee}
            onChange={(event) =>
              onUpdate({ assignee: event.target.value })
            }
            placeholder="未設定"
          />
        </div>

        <div>
          <label className="text-xs">作業締切</label>
          <input
            className="mt-1 text-sm"
            type="date"
            value={card.dueDate ?? ""}
            onChange={(event) =>
              onUpdate({
                dueDate: event.target.value || null,
              })
            }
          />
          <DueLabel status={dueStatus} dueDate={card.dueDate} />
        </div>

        <div>
          <label className="text-xs">投稿予定日</label>
          <input
            className="mt-1 text-sm"
            type="date"
            value={card.scheduledDate ?? ""}
            onChange={(event) =>
              onUpdate({
                scheduledDate: event.target.value || null,
              })
            }
          />
        </div>
      </div>
    </article>
  );
}

function DueLabel({
  status,
  dueDate,
}: {
  status: ReturnType<typeof dueDateStatus>;
  dueDate: string | null;
}) {
  if (!dueDate || status === "none") return null;

  const labels = {
    overdue: "期限切れ",
    today: "本日締切",
    soon: "締切まで3日以内",
    later: `締切 ${dueDate}`,
  };

  return (
    <p
      className={`mt-1 text-xs font-semibold ${
        status === "overdue"
          ? "text-red-600"
          : status === "today" || status === "soon"
            ? "text-amber-700"
            : "text-stone-500"
      }`}
    >
      {labels[status]}
    </p>
  );
}

function postTypeLabel(type: string) {
  const labels: Record<string, string> = {
    reel: "リール",
    carousel: "カルーセル",
    image: "画像",
    video: "動画",
  };

  return labels[type] ?? type;
}
