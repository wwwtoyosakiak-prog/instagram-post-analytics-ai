"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addPostData, loadAccountsData, upsertAccountsData, upsertPostsData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramPostInput, PostCategory, PostType } from "@/lib/types";
import { sampleAccounts, samplePosts } from "@/lib/sample-data";
import { csvTemplate, parsePostsCsv } from "@/lib/csv";
import { postCategoryOptions } from "@/lib/metrics";

const initialForm: InstagramPostInput = {
  date: new Date().toISOString().slice(0, 10),
  recordedDate: new Date().toISOString().slice(0, 10),
  url: "",
  caption: "",
  hashtags: "",
  type: "image",
  category: "other",
  mediaCount: 1,
  likes: 0,
  comments: 0,
  saves: 0,
  shares: 0,
  views: 0,
  memo: ""
};

export default function NewPostPage() {
  const router = useRouter();
  const [form, setForm] = useState<InstagramPostInput>(initialForm);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [message, setMessage] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadAccountsData().then((loaded) => {
      setAccounts(loaded);
      setForm((current) => ({ ...current, accountId: loaded[0]?.id }));
    });
  }, []);

  const setValue = (key: keyof InstagramPostInput, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setValue("screenshot", String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const accountIdByUsername = Object.fromEntries(accounts.map((account) => [account.username, account.id]));
    const posts = parsePostsCsv(text, accountIdByUsername);
    await upsertPostsData(posts);
    setMessage(`${posts.length}件をCSVから取り込みました。`);
  };

  const extractFromScreenshot = async () => {
    if (!form.screenshot) {
      setMessage("先に投稿画像スクショをアップロードしてください。");
      return;
    }

    setExtracting(true);
    setMessage("");
    try {
      const response = await fetch("/api/extract-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: form.screenshot })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "スクショ解析に失敗しました。");

      setForm((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(data.extracted ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
        )
      }));
      setMessage("スクショから読み取れた情報をフォームに反映しました。内容を確認してから登録してください。");
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "スクショ解析に失敗しました。");
    } finally {
      setExtracting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const post = await addPostData(form);
    router.push(`/posts/detail?id=${post.id}`);
  };

  return (
    <div>
      <PageHeader title="投稿登録" description="Instagram公式APIは使わず、担当者が把握している投稿データを登録します。" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label>対象アカウント</label>
              <select value={form.accountId ?? ""} onChange={(e) => setValue("accountId", e.target.value)}>
                <option value="">未選択</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}（@{account.username}）</option>
                ))}
              </select>
              {!accounts.length ? <p className="mt-2 text-xs text-stone-500">先にアカウント登録ページでアカウントを追加すると、投稿と紐づけできます。</p> : null}
            </div>
            <div>
              <label>投稿日</label>
              <input type="date" value={form.date} onChange={(e) => setValue("date", e.target.value)} required />
            </div>
            <div>
              <label>データ登録日</label>
              <input type="date" value={form.recordedDate} onChange={(e) => setValue("recordedDate", e.target.value)} required />
            </div>
            <div>
              <label>投稿タイプ</label>
              <select value={form.type} onChange={(e) => setValue("type", e.target.value as PostType)}>
                <option value="image">画像</option>
                <option value="video">動画</option>
                <option value="reel">リール</option>
                <option value="carousel">カルーセル</option>
              </select>
            </div>
            <div>
              <label>投稿カテゴリ</label>
              <select value={form.category} onChange={(e) => setValue("category", e.target.value as PostCategory)}>
                {postCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>投稿画像・動画の枚数</label>
              <input type="number" min={1} value={form.mediaCount} onChange={(e) => setValue("mediaCount", Number(e.target.value))} />
            </div>
            <div className="md:col-span-2">
              <label>投稿URL</label>
              <input value={form.url} onChange={(e) => setValue("url", e.target.value)} placeholder="https://www.instagram.com/p/..." />
            </div>
            <div className="md:col-span-2">
              <label>投稿コメント</label>
              <textarea rows={5} value={form.caption} onChange={(e) => setValue("caption", e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label>ハッシュタグ</label>
              <textarea rows={3} value={form.hashtags} onChange={(e) => setValue("hashtags", e.target.value)} placeholder="#キャンプ #アウトドア" />
            </div>
            {(["likes", "comments", "saves", "shares", "views"] as const).map((key) => (
              <div key={key}>
                <label>{labelMap[key]}</label>
                <input type="number" min={0} value={form[key]} onChange={(e) => setValue(key, Number(e.target.value))} />
              </div>
            ))}
            <div className="md:col-span-2">
              <label>メモ</label>
              <textarea rows={3} value={form.memo} onChange={(e) => setValue("memo", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label>投稿画像スクショ</label>
              <input type="file" accept="image/*" onChange={handleImage} />
              <div className="mt-3">
                <Button variant="secondary" onClick={extractFromScreenshot} disabled={!form.screenshot || extracting}>
                  {extracting ? "スクショ解析中..." : "スクショから自動入力"}
                </Button>
              </div>
              {form.screenshot ? <img src={form.screenshot} alt="投稿画像プレビュー" className="mt-3 max-h-72 rounded-md border border-stone-200 object-contain" /> : null}
            </div>
            <div className="md:col-span-2">
              <Button type="submit">登録する</Button>
            </div>
          </form>
        </Panel>
        <aside className="space-y-4">
          <Panel>
            <h2 className="font-semibold">CSV取り込み</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">列名は英語の固定形式です。画像はCSV対象外です。</p>
            <pre className="mt-3 overflow-auto rounded-md bg-stone-100 p-3 text-xs">{csvTemplate}</pre>
            <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold hover:border-moss">
              <Upload size={16} />
              CSVを選択
              <input className="hidden" type="file" accept=".csv,text/csv" onChange={handleCsv} />
            </label>
          </Panel>
          <Panel>
            <h2 className="font-semibold">サンプルデータ</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">OZOPSのようなアウトドアブランドを想定した10件を追加します。</p>
            <div className="mt-4">
              <Button variant="secondary" onClick={async () => { await upsertAccountsData(sampleAccounts); await upsertPostsData(samplePosts); setAccounts(await loadAccountsData()); setMessage("サンプルアカウントと投稿データ10件を追加しました。"); }}>
                サンプル10件を追加
              </Button>
            </div>
          </Panel>
          {message ? <p className="rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        </aside>
      </div>
    </div>
  );
}

const labelMap = {
  likes: "いいね数",
  comments: "コメント数",
  saves: "保存数",
  shares: "シェア数",
  views: "表示数 / views"
};
