export type PipelineStage =
  | "idea"
  | "planning"
  | "script"
  | "shooting"
  | "editing"
  | "review"
  | "scheduled"
  | "posted";

export type PipelinePriority = "high" | "medium" | "low";

export type PipelineCard = {
  id: string;
  title: string;
  theme: string;
  postType: string;
  stage: PipelineStage;
  priority: PipelinePriority;
  assignee: string;
  dueDate: string | null;
  scheduledDate: string | null;
  caption: string;
  updatedAt: string;
};

export const pipelineStages: Array<{
  value: PipelineStage;
  label: string;
}> = [
  { value: "idea", label: "アイデア" },
  { value: "planning", label: "企画" },
  { value: "script", label: "台本" },
  { value: "shooting", label: "撮影" },
  { value: "editing", label: "編集" },
  { value: "review", label: "レビュー" },
  { value: "scheduled", label: "予約" },
  { value: "posted", label: "投稿済み" },
];

export const pipelinePriorityLabels: Record<
  PipelinePriority,
  string
> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function isPipelineStage(
  value: unknown,
): value is PipelineStage {
  return pipelineStages.some((stage) => stage.value === value);
}

export function isPipelinePriority(
  value: unknown,
): value is PipelinePriority {
  return value === "high" || value === "medium" || value === "low";
}

export function groupPipelineCards(cards: PipelineCard[]) {
  return pipelineStages.reduce<Record<PipelineStage, PipelineCard[]>>(
    (result, stage) => {
      result[stage.value] = cards
        .filter((card) => card.stage === stage.value)
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const priorityDifference =
            priorityOrder[a.priority] - priorityOrder[b.priority];

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          if (a.dueDate && b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }

          if (a.dueDate) return -1;
          if (b.dueDate) return 1;

          return b.updatedAt.localeCompare(a.updatedAt);
        });

      return result;
    },
    {
      idea: [],
      planning: [],
      script: [],
      shooting: [],
      editing: [],
      review: [],
      scheduled: [],
      posted: [],
    },
  );
}

export function dueDateStatus(
  dueDate: string | null,
  today: string,
): "none" | "overdue" | "today" | "soon" | "later" {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";

  const current = new Date(`${today}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  const difference = Math.ceil(
    (due.getTime() - current.getTime()) / 86_400_000,
  );

  return difference <= 3 ? "soon" : "later";
}
