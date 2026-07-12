"use client";

import { useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  PostPlannerInput,
  PostPlannerResult,
} from "@/lib/post-planner";

const initialForm: PostPlannerInput = {
  goal: "reach",
  postType: "reel",
  theme: "",
  audience: "",
  keyMessage: "",
  tone: "親しみやすく、分かりやすい",
  duration: "15〜30秒",
  notes: "",
};

export default function PostPlannerPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] =
    useState<PostPlannerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/post-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.result) {
        throw new Error(
          data.error ?? "投稿企画を作成できませんでした。",
        );
      }

      setResult(data.result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "投稿企画を作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div>
      <PageHeader
        title="AI投稿企画"
        description="目的とテーマを入力すると、台本・構成・キャプション・ハッシュタグまでまとめて作成します。"
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel>
          <h2 className="font-semibold">企画条件</h2>

          <div className="mt-4 space-y-4">
            <Field label="投稿目的">
              <select
                value={form.goal}
                onChange={(event) =>
                  setForm({
                    ...form,
                    goal: event.target.value as PostPlannerInput["goal"],
                  })
                }
              >
                <option value="reach">リーチを増やす</option>
                <option value="engagement">反応を増やす</option>
                <option value="saves">保存を増やす</option>
                <option value="followers">フォローにつなげる</option>
                <option value="awareness">認知を広げる</option>
              </select>
            </Field>

            <Field label="投稿形式">
              <select
                value={form.postType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    postType:
                      event.target.value as PostPlannerInput["postType"],
                  })
                }
              >
                <option value="reel">リール</option>
                <option value="carousel">カルーセル</option>
                <option value="image">1枚画像</option>
                <option value="video">動画</option>
              </select>
            </Field>

            <Field label="投稿テーマ">
              <input
                value={form.theme}
                onChange={(event) =>
                  setForm({ ...form, theme: event.target.value })
                }
                placeholder="例：段ボールガチャの制作工程"
              />
            </Field>

            <Field label="対象者">
              <input
                value={form.audience}
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value })
                }
                placeholder="例：小学生の保護者、工作が好きな人"
              />
            </Field>

            <Field label="伝えたい内容">
              <textarea
                rows={4}
                value={form.keyMessage}
                onChange={(event) =>
                  setForm({
                    ...form,
                    keyMessage: event.target.value,
                  })
                }
                placeholder="例：身近な段ボールから楽しく学べる"
              />
            </Field>

            <Field label="文章・動画の雰囲気">
              <input
                value={form.tone}
                onChange={(event) =>
                  setForm({ ...form, tone: event.target.value })
                }
              />
            </Field>

            {(form.postType === "reel" ||
              form.postType === "video") && (
              <Field label="動画の長さ">
                <input
                  value={form.duration ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      duration: event.target.value,
                    })
                  }
                />
              </Field>
            )}

            <Field label="追加条件（任意）">
              <textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="使いたい言葉、避けたい表現、素材など"
              />
            </Field>

            <Button
              onClick={() => void generate()}
              disabled={loading}
            >
              {loading ? "企画作成中..." : "AIで投稿企画を作成"}
            </Button>
          </div>
        </Panel>

        <div>
          {error ? (
            <Panel className="mb-6 border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </Panel>
          ) : null}

          {!result ? (
            <Panel>
              <p className="text-sm leading-6 text-stone-600">
                左側に条件を入力して、投稿企画を作成してください。
              </p>
            </Panel>
          ) : (
            <div className="space-y-6">
              <Panel>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Content Plan
                </p>
                <h2 className="mt-1 text-2xl font-bold">{result.title}</h2>
                <p className="mt-3 leading-7 text-stone-700">
                  {result.concept}
                </p>
                <div className="mt-4 rounded-lg bg-skyglass p-4">
                  <p className="text-xs font-semibold text-stone-500">
                    冒頭フック
                  </p>
                  <p className="mt-2 text-lg font-bold">{result.hook}</p>
                </div>
              </Panel>

              {result.reelScript.length ? (
                <Panel>
                  <h2 className="font-semibold">動画・リール台本</h2>
                  <div className="mt-4 space-y-3">
                    {result.reelScript.map((scene) => (
                      <div
                        key={`${scene.order}-${scene.timing}`}
                        className="rounded-lg border border-stone-200 bg-white p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
                            {scene.order}
                          </span>
                          <span className="text-sm font-semibold">
                            {scene.timing}
                          </span>
                        </div>
                        <p className="mt-3 text-sm">
                          <strong>映像：</strong>{scene.visual}
                        </p>
                        <p className="mt-2 text-sm">
                          <strong>音声：</strong>{scene.narration}
                        </p>
                        <p className="mt-2 text-sm">
                          <strong>テロップ：</strong>{scene.textOverlay}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {result.carouselSlides.length ? (
                <Panel>
                  <h2 className="font-semibold">カルーセル構成</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {result.carouselSlides.map((slide) => (
                      <div
                        key={`${slide.order}-${slide.title}`}
                        className="rounded-lg border border-stone-200 bg-white p-4"
                      >
                        <p className="text-xs font-semibold text-stone-500">
                          {slide.order}枚目
                        </p>
                        <h3 className="mt-2 font-bold">{slide.title}</h3>
                        <p className="mt-2 text-sm leading-6">
                          {slide.body}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          デザイン：{slide.visual}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : null}

              <CopyPanel
                title="完成版キャプション"
                value={result.caption}
                copied={copied}
                onCopy={copy}
              />

              <CopyPanel
                title="短文版キャプション"
                value={result.shortCaption}
                copied={copied}
                onCopy={copy}
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <CopyPanel
                  title="ハッシュタグ"
                  value={result.hashtags.join(" ")}
                  copied={copied}
                  onCopy={copy}
                />

                <CopyPanel
                  title="CTA"
                  value={result.callToAction}
                  copied={copied}
                  onCopy={copy}
                />

                <CopyPanel
                  title="サムネイル文字"
                  value={result.thumbnailText}
                  copied={copied}
                  onCopy={copy}
                />

                <Panel>
                  <List
                    title="制作チェックリスト"
                    items={result.productionChecklist}
                  />
                </Panel>
              </div>

              <Panel>
                <List title="注意点" items={result.cautions} />
              </Panel>
            </div>
          )}
        </div>
      </div>
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

function CopyPanel({
  title,
  value,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  copied: string;
  onCopy: (label: string, value: string) => Promise<void>;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => void onCopy(title, value)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          {copied === title ? "コピー済み" : "コピー"}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
        {value || "内容なし"}
      </p>
    </Panel>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {items.length ? (
          items.map((item) => <li key={item}>・{item}</li>)
        ) : (
          <li>該当項目はありません。</li>
        )}
      </ul>
    </div>
  );
}
