"use client";

import { useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const examples = [
  "直近の投稿で保存率が低い理由を教えて",
  "最も伸びた投稿の共通点は？",
  "次に投稿すべきテーマを3つ提案して",
  "リール投稿だけを見て改善点を教えて",
];

export default function AiChatPage() {
  const [question, setQuestion] = useState("");
  const [accountId, setAccountId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (value?: string) => {
    const nextQuestion = (value ?? question).trim();
    if (!nextQuestion || loading) return;

    setLoading(true);
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: nextQuestion },
    ]);
    setQuestion("");

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          accountId: accountId.trim() || undefined,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok || !data.answer) {
        throw new Error(data.error || "AIの回答を取得できませんでした。");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer! },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AIの回答を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Instagram AIチャット"
        description="投稿データやAIスコアについて、自然な言葉で質問できます。"
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel>
          <h2 className="font-semibold">分析条件</h2>
          <div className="mt-4">
            <label>アカウントID（任意）</label>
            <input
              className="mt-1"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="空欄なら全投稿"
            />
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold">質問例</p>
            <div className="mt-3 grid gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void ask(example)}
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm leading-6 hover:border-moss"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="min-h-[420px] space-y-4">
            {!messages.length ? (
              <div className="rounded-lg bg-fog p-5 text-sm leading-7 text-stone-600">
                質問を入力すると、登録済み投稿・実績値・AIスコアをもとに回答します。
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-xl p-4 ${
                  message.role === "user"
                    ? "ml-auto max-w-2xl bg-ink text-white"
                    : "mr-auto max-w-3xl border border-stone-200 bg-white"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {message.content}
                </p>
              </div>
            ))}

            {loading ? (
              <div className="mr-auto max-w-md rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
                投稿データを分析しています...
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-5">
            <textarea
              rows={4}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例：最近の投稿で保存されやすい内容は何ですか？"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  void ask();
                }
              }}
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => void ask()}
                disabled={loading || !question.trim()}
              >
                {loading ? "分析中..." : "質問する"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
