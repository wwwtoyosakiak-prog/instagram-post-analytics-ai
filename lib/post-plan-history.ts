import type {
  PostPlannerInput,
  PostPlannerResult,
} from "@/lib/post-planner";

export type PostPlanStatus =
  | "draft"
  | "adopted"
  | "in_progress"
  | "posted"
  | "archived";

export type SavedPostPlan = {
  id: string;
  title: string;
  status: PostPlanStatus;
  scheduledDate: string | null;
  input: PostPlannerInput;
  result: PostPlannerResult;
  createdAt: string;
  updatedAt: string;
};

export const postPlanStatusLabels: Record<PostPlanStatus, string> = {
  draft: "下書き",
  adopted: "採用",
  in_progress: "制作中",
  posted: "投稿済み",
  archived: "保留・アーカイブ",
};

export function isPostPlanStatus(value: unknown): value is PostPlanStatus {
  return (
    value === "draft" ||
    value === "adopted" ||
    value === "in_progress" ||
    value === "posted" ||
    value === "archived"
  );
}

export function filterPostPlans(
  plans: SavedPostPlan[],
  query: string,
  status: PostPlanStatus | "all",
) {
  const normalized = query.trim().toLowerCase();

  return plans.filter((plan) => {
    if (status !== "all" && plan.status !== status) return false;
    if (!normalized) return true;

    const target = [
      plan.title,
      plan.input.theme,
      plan.input.audience,
      plan.input.keyMessage,
      plan.result.caption,
      plan.result.hashtags.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return target.includes(normalized);
  });
}
