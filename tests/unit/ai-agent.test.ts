import { describe, expect, it } from "vitest";
import {
  defaultAiAgentSteps,
  summarizeAiAgentSteps,
} from "@/lib/ai-agent";

describe("AI agent", () => {
  it("全工程成功なら成功判定にする", () => {
    const steps = defaultAiAgentSteps().map((step) => ({
      ...step,
      status: "success" as const,
    }));

    const summary = summarizeAiAgentSteps(steps);

    expect(summary.status).toBe("success");
    expect(summary.completedSteps).toBe(3);
  });

  it("必須工程が途中で失敗した場合は一部成功にする", () => {
    const steps = defaultAiAgentSteps();
    steps[0] = { ...steps[0], status: "success" };
    steps[1] = { ...steps[1], status: "failed" };
    steps[2] = { ...steps[2], status: "skipped" };

    const summary = summarizeAiAgentSteps(steps);

    expect(summary.status).toBe("partial");
    expect(summary.failedSteps).toBe(1);
  });

  it("最初の必須工程失敗なら失敗判定にする", () => {
    const steps = defaultAiAgentSteps();
    steps[0] = { ...steps[0], status: "failed" };
    steps[1] = { ...steps[1], status: "skipped" };
    steps[2] = { ...steps[2], status: "skipped" };

    expect(summarizeAiAgentSteps(steps).status).toBe(
      "failed",
    );
  });
});
