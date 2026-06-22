"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addCategoryData, deleteCategoryData, loadCategoriesData, updateCategoryData } from "@/lib/cloud-storage";
import { PostCategoryDefinition } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<PostCategoryDefinition[]>([]);
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => setCategories(await loadCategoriesData());
  useEffect(() => { refresh(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = label.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateCategoryData(editingId, name);
        setMessage("カテゴリ名を変更しました。");
      } else {
        await addCategoryData(name);
        setMessage("カテゴリを追加しました。");
      }
      setLabel("");
      setEditingId(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "カテゴリを保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: PostCategoryDefinition) => {
    setEditingId(category.id);
    setLabel(category.label);
    setMessage("");
    setError("");
  };

  const remove = async (category: PostCategoryDefinition) => {
    if (!window.confirm(`${category.label} を削除しますか？このカテゴリの投稿は未分類になります。`)) return;
    setError("");
    try {
      await deleteCategoryData(category.id);
      setMessage("カテゴリを削除し、対象投稿を未分類へ移しました。");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "カテゴリを削除できませんでした。");
    }
  };

  return (
    <div>
      <PageHeader title="投稿カテゴリ管理" description="運用に合わせてカテゴリを追加し、投稿登録・編集・分析で使用できます。" />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel>
          <h2 className="font-semibold">{editingId ? "カテゴリ名を編集" : "カテゴリを追加"}</h2>
          <form onSubmit={submit} className="mt-4">
            <label>カテゴリ名</label>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例: 学生活動、イベント告知" required />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>{saving ? "保存中..." : editingId ? "変更を保存" : "追加する"}</Button>
              {editingId ? <Button variant="secondary" onClick={() => { setEditingId(null); setLabel(""); }}>キャンセル</Button> : null}
            </div>
          </form>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm">{message}</p> : null}
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        </Panel>
        <Panel>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-semibold">カテゴリ一覧</h2>
              <p className="mt-1 text-sm text-stone-600">現在 {categories.length}件</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-stone-200">
            {categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink">{category.label}</p>
                  <p className="mt-1 text-xs text-stone-500">{category.isSystem ? "初期カテゴリ" : "追加カテゴリ"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => startEdit(category)}>名前を変更</Button>
                  {!category.isSystem ? <Button variant="secondary" onClick={() => remove(category)}>削除</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
