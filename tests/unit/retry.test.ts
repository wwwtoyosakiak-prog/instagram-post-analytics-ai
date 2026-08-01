import { describe, expect, it, vi } from "vitest";
import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("retries temporary failures and returns the successful result", async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();

    await expect(withRetry(task, { delaysMs: [0], onRetry })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(2);
  });

  it("does not retry permanent failures", async () => {
    const error = new Error("permanent");
    const task = vi.fn().mockRejectedValue(error);

    await expect(withRetry(task, { delaysMs: [0], shouldRetry: () => false })).rejects.toBe(error);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
