"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <div className="rounded-md border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-900">画面を読み込めませんでした</h1>
        <p className="mt-3 text-sm leading-6 text-red-800">一時的な読み込みエラーの可能性があります。もう一度読み込んでください。</p>
        <div className="mt-5">
          <Button onClick={reset}>もう一度読み込む</Button>
        </div>
      </div>
    </main>
  );
}
