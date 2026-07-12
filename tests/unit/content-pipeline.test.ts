import { describe, expect, it } from "vitest";
import {
  dueDateStatus,
  groupPipelineCards,
  type PipelineCard,
} from "@/lib/content-pipeline";

const card: PipelineCard = {
  id: "1",
  title: "段ボール工作",
  theme: "制作工程",
  postType: "reel",
  stage: "idea",
  priority: "high",
  assignee: "",
  dueDate: "2026-07-15",
  scheduledDate: null,
  caption: "",
  updatedAt: "2026-07-13T00:00:00Z",
};

describe("content pipeline", () => {
  it("工程ごとにカードを分類する", () => {
    const grouped = groupPipelineCards([card]);

    expect(grouped.idea).toHaveLength(1);
    expect(grouped.editing).toHaveLength(0);
  });

  it("締切状態を判定する", () => {
    expect(dueDateStatus("2026-07-12", "2026-07-13")).toBe(
      "overdue",
    );
    expect(dueDateStatus("2026-07-13", "2026-07-13")).toBe(
      "today",
    );
    expect(dueDateStatus("2026-07-15", "2026-07-13")).toBe(
      "soon",
    );
  });
});
