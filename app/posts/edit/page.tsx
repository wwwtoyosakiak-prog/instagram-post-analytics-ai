"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, PageHeader, Panel } from "@/components/ui";
import { loadAccountsData, loadPostsData, updatePostData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramPostInput, PostType } from "@/lib/types";

export default function EditPostPage() {
  return (
    <Suspense fallback={<PageHeader title="投稿編集" description="投稿データを読み込んでいます。" />}>
      <EditPostContent />
    </Suspense>
  );
}

function EditPostContent() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState<InstagramPostInput | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([loadAccountsData(), loadPostsData()]).then(([loadedAccounts, posts]) => {
      setAccounts(loadedAccounts);
      const post = posts.find((item) => item.id === id);
      if (!post) return;
      setForm({
        accountId: post.accountId,
        date: post.date,
        recordedDate: post.recordedDate ?? post.date,
        url: post.url,
        caption: post.caption,
        hashtags: post.hashtags ?? "",
        type: post.type,
        mediaCount: post.mediaCount ?? 1,
        likes: post.likes,
        comments: post.comments,
        saves: post.saves,
        shares: post.shares,
        views: post.views,
        memo: post.memo,
        screenshot: post.screenshot
      });
    });
  }, [id]);

  if (!form) {
    return <PageHeader title="投稿が見つかりません" description="一覧から投稿を選び直してください。" />;
  }

  const setValue = (key: keyof InstagramPostInput, value: string | number) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setValue("screenshot", String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await updatePostData(id, form);
    setMessage("投稿を更新しました。");
    router.push(`/posts/detail?id=${id}`);
  };

  return (
    <div>
      <PageHeader title="投稿編集" description="投稿データを変更すると、編集日時が自動で更新されます。" />
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
            <label>投稿画像・動画の枚数</label>
            <input type="number" min={1} value={form.mediaCount} onChange={(e) => setValue("mediaCount", Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <label>投稿URL</label>
            <input value={form.url} onChange={(e) => setValue("url", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label>投稿コメント</label>
            <textarea rows={5} value={form.caption} onChange={(e) => setValue("caption", e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label>ハッシュタグ</label>
            <textarea rows={3} value={form.hashtags} onChange={(e) => setValue("hashtags", e.target.value)} />
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
            {form.screenshot ? <img src={form.screenshot} alt="投稿画像プレビュー" className="mt-3 max-h-72 rounded-md border border-stone-200 object-contain" /> : null}
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit">変更を保存</Button>
            <Button variant="secondary" onClick={() => router.push(`/posts/detail?id=${id}`)}>キャンセル</Button>
          </div>
        </form>
        {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
      </Panel>
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
