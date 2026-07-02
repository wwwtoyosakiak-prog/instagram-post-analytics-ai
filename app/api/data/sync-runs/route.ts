import { NextResponse } from "next/server";
import { isSupabaseConfigured, listSyncRunsFromSupabase } from "@/lib/supabase-admin";
import type { InstagramSyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";

const GITHUB_REPO = "wwwtoyosakiak-prog/instagram-post-analytics-ai";
const GITHUB_WORKFLOW_FILE = "instagram-scheduled-sync.yml";
const SCHEDULED_SYNC_HOURS = [0, 6, 12, 18] as const;

type GitHubWorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  jobs_url: string;
};

type GitHubJobsResponse = {
  jobs?: Array<{
    name: string;
    conclusion: string | null;
    steps?: Array<{
      name: string;
      conclusion: string | null;
    }>;
  }>;
};

function toTokyoDateParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function shiftTokyoDateKey(dateKey: string, offsetDays: number) {
  const base = new Date(`${dateKey}T00:00:00+09:00`);
  base.setDate(base.getDate() + offsetDays);
  return toTokyoDateParts(base).date;
}

function getScheduledPlannedLabel(iso: string) {
  const parts = toTokyoDateParts(new Date(iso));
  const currentMinutes = parts.hour * 60 + parts.minute;
  const plannedHour = [...SCHEDULED_SYNC_HOURS].reverse().find((hour) => currentMinutes >= (hour * 60 + 17));
  const targetDateKey = typeof plannedHour === "number" ? parts.date : shiftTokyoDateKey(parts.date, -1);
  const targetHour = typeof plannedHour === "number" ? plannedHour : SCHEDULED_SYNC_HOURS[SCHEDULED_SYNC_HOURS.length - 1];
  return `${targetDateKey} ${String(targetHour).padStart(2, "0")}:17`;
}

function formatDateTimeJst(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "instagram-post-analytics-ai",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getGitHubFailureSummary(jobsUrl: string) {
  try {
    const data = await fetchJson<GitHubJobsResponse>(jobsUrl);
    const failedJob = data.jobs?.find((job) => job.conclusion === "failure");
    const failedStep = failedJob?.steps?.find((step) => step.conclusion === "failure");
    if (failedStep?.name) return `${failedStep.name} で失敗`;
    if (failedJob?.name) return `${failedJob.name} で失敗`;
  } catch {
    // ignore GitHub detail fetch errors and fall back below
  }
  return "GitHub Actions 実行失敗";
}

async function loadGitHubScheduledRuns() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/runs?per_page=10`;
  const data = await fetchJson<{ workflow_runs?: GitHubWorkflowRun[] }>(url);
  const workflowRuns = data.workflow_runs ?? [];

  const mappedRuns = await Promise.all(
    workflowRuns.map(async (run): Promise<InstagramSyncRun> => {
      const status =
        run.conclusion === "success"
          ? "success"
          : run.conclusion === "failure"
            ? "failed"
            : "partial";

      const errorSummary = run.conclusion === "failure"
        ? await getGitHubFailureSummary(run.jobs_url)
        : `GitHub Actions で ${formatDateTimeJst(run.created_at)} に実行`;

      return {
        id: `github-${run.id}`,
        triggerType: "scheduled",
        status,
        startedAt: run.created_at,
        finishedAt: run.updated_at,
        fetchedPosts: 0,
        savedPosts: 0,
        savedSnapshots: 0,
        failedPosts: run.conclusion === "failure" ? 1 : 0,
        apiMode: "github_actions",
        errorSummary,
        errors: run.conclusion === "failure"
          ? [{ stage: "github_actions", message: errorSummary }]
          : [{ stage: "github_actions", message: `GitHub Actions で ${formatDateTimeJst(run.created_at)} に実行` }],
      };
    })
  );

  return mappedRuns;
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
  }

  const syncRuns = await listSyncRunsFromSupabase();
  let mergedRuns = syncRuns;

  try {
    const githubRuns = await loadGitHubScheduledRuns();
    const existingScheduledPlannedLabels = new Set(
      syncRuns
        .filter((run) => run.triggerType === "scheduled")
        .map((run) => getScheduledPlannedLabel(run.startedAt))
    );

    const supplementalRuns = githubRuns.filter((run) => !existingScheduledPlannedLabels.has(getScheduledPlannedLabel(run.startedAt)));
    mergedRuns = [...supplementalRuns, ...syncRuns].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch {
    mergedRuns = syncRuns;
  }

  return NextResponse.json(
    { syncRuns: mergedRuns },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
