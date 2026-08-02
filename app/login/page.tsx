"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { requestJson } from "@/lib/client-api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }, "ログインできませんでした。");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "ログインできませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md items-center">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-white"><KeyRound aria-hidden /></div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">ログイン</h1>
        <p className="mt-2 text-sm text-stone-600">自分のIDとパスワードを入力してください。</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label htmlFor="username">ユーザーID</label><input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></div>
          <div><label htmlFor="password">パスワード</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "確認中..." : "ログイン"}
          </button>
        </form>
      </section>
    </div>
  );
}
