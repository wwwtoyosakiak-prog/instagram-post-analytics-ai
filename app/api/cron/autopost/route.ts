import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/instagram-token-manager";
import { ApiRequestError, apiErrorResponse, isRecord, readJsonObject } from "@/lib/server-api";
import {
  appendAutopostHistory,
  createReelContainer,
  createVideoUploadUrl,
  planTodaysPost,
  publishContainer,
  readAutopostHistory,
  readContainerStatus,
  type AutopostPhoto,
} from "@/lib/autopost";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readString(body: Record<string, unknown>, key: string, max = 2200) {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) throw new ApiRequestError(`${key} がありません。`, 400);
  return value.trim().slice(0, max);
}

function readPhotos(body: Record<string, unknown>): AutopostPhoto[] {
  const photos = body.photos;
  if (!Array.isArray(photos) || photos.length === 0) throw new ApiRequestError("photos がありません。", 400);
  return photos.filter(isRecord).slice(0, 120).map((photo) => ({
    id: String(photo.id ?? "").slice(0, 64),
    tags: Array.isArray(photo.tags) ? photo.tags.map((tag) => String(tag).slice(0, 20)).slice(0, 8) : [],
  })).filter((photo) => /^[A-Za-z0-9_-]+$/.test(photo.id));
}

/**
 * GitHub Actions の毎日自動投稿ワークフローから呼ばれる。
 * action: history | plan | upload-url | create | status | publish
 */
export async function POST(request: Request) {
  const auth = isCronAuthorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await readJsonObject(request);
    const action = readString(body, "action", 32);

    switch (action) {
      case "history":
        return NextResponse.json({ history: await readAutopostHistory() });
      case "plan": {
        const ideas = Array.isArray(body.ideas) ? body.ideas.map((idea) => String(idea).slice(0, 60)).slice(0, 40) : [];
        const result = await planTodaysPost({
          date: readString(body, "date", 10),
          weekday: readString(body, "weekday", 8),
          photos: readPhotos(body),
          ideas,
          quizzes: Array.isArray(body.quizzes)
            ? body.quizzes.filter(isRecord).slice(0, 20).map((quiz) => ({ id: String(quiz.id ?? "").slice(0, 40), q: String(quiz.q ?? "").slice(0, 40) })).filter((quiz) => quiz.id)
            : [],
        });
        return NextResponse.json(result);
      }
      case "upload-url":
        return NextResponse.json(await createVideoUploadUrl(readString(body, "path", 120)));
      case "create":
        return NextResponse.json({ containerId: await createReelContainer(readString(body, "path", 120), readString(body, "caption")) });
      case "status":
        return NextResponse.json(await readContainerStatus(readString(body, "containerId", 40)));
      case "publish": {
        const result = await publishContainer(readString(body, "containerId", 40));
        const entry = isRecord(body.entry) ? body.entry : {};
        await appendAutopostHistory({
          date: readString(body, "date", 10),
          theme: String(entry.theme ?? "").slice(0, 40),
          style: String(entry.style ?? "").slice(0, 20),
          photos: Array.isArray(entry.photos) ? entry.photos.map(String).slice(0, 10) : [],
          caption: String(entry.caption ?? "").slice(0, 2200),
          source: entry.source === "queue" || entry.source === "fallback" ? entry.source : "ai",
          ...result,
        });
        return NextResponse.json(result);
      }
      default:
        throw new ApiRequestError(`不明な action です: ${action}`, 400);
    }
  } catch (error) {
    return apiErrorResponse(error, "autopost-api");
  }
}
