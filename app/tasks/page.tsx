"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { addTaskData, deleteTaskData, loadPostsData, loadTasksData, updateTaskData } from "@/lib/cloud-storage";
import { ImprovementTask, ImprovementTaskInput, ImprovementTaskStatus, InstagramPost } from "@/lib/types";
import { taskStatusLabels, taskStatusOptions } from "@/lib/metrics";

export default function TasksPage() {
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [status, setStatus] = useState<ImprovementTaskStatus | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ImprovementTaskInput>(emptyTask());
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([loadTasksData(), loadPostsData()]).then(([loadedTasks, loadedPosts]) => {
      setTasks(loadedTasks);
      setPosts(loadedPosts);
    });
  }, []);

  const postById = useMemo(() => Object.fromEntries(posts.map((post) => [post.id, post])), [posts]);
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => status === "all" || task.status === status)
      .sort((a, b) => {
        const statusOrder = { todo: 0, doing: 1, done: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return new Date(a.dueDate || "9999-12-31").getTime() - new Date(b.dueDate || "9999-12-31").getTime();
      });
  }, [tasks, status]);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    doing: tasks.filter((task) => task.status === "doing").length,
    done: tasks.filter((task) => task.status === "done").length
  }), [tasks]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyTask());
    setMessage("");
  };

  const startEdit = (task: ImprovementTask) => {
    setEditingId(task.id);
    setForm({
      postId: task.postId,
      analysisId: task.analysisId,
      title: task.title,
      status: task.status,
      assignee: task.assignee,
      dueDate: task.dueDate,
      memo: task.memo
    });
    setMessage("");
  };

  const saveTask = async () => {
    if (!form.title.trim()) {
      setMessage("タスク内容を入力してください。");
      return;
    }
    const saved = editingId ? await updateTaskData(editingId, form) : await addTaskData(form);
    if (saved) {
      setTasks((current) => editingId ? current.map((task) => task.id === saved.id ? saved : task) : [saved, ...current]);
      setEditingId(null);
      setForm(emptyTask());
      setMessage(editingId ? "タスクを更新しました。" : "タスクを追加しました。");
    }
  };

  const changeStatus = async (task: ImprovementTask, nextStatus: ImprovementTaskStatus) => {
    const updated = await updateTaskData(task.id, {
      postId: task.postId,
      analysisId: task.analysisId,
      title: task.title,
      status: nextStatus,
      assignee: task.assignee,
      dueDate: task.dueDate,
      memo: task.memo
    });
    if (updated) setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const removeTask = async (task: ImprovementTask) => {
    if (!window.confirm("このタスクを削除しますか？")) return;
    await deleteTaskData(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setMessage("タスクを削除しました。");
  };

  return (
    <div>
      <PageHeader title="改善タスク管理" description="AI分析から出た改善案や運用上の対応事項を、担当者・期限・状態付きで管理します。" />

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Stat label="全タスク" value={`${stats.total}件`} />
        <Stat label="対応前" value={`${stats.todo}件`} />
        <Stat label="対応中" value={`${stats.doing}件`} />
        <Stat label="完了" value={`${stats.done}件`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{editingId ? "タスク編集" : "タスク追加"}</h2>
            {editingId ? <Button variant="secondary" onClick={startCreate}>新規に戻る</Button> : null}
          </div>
          <div className="grid gap-3">
            <div>
              <label>タスク内容</label>
              <textarea rows={4} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例: 1枚目に商品の使用シーンを入れる" />
            </div>
            <div>
              <label>紐づく投稿</label>
              <select value={form.postId ?? ""} onChange={(event) => setForm({ ...form, postId: event.target.value || undefined })}>
                <option value="">紐づけなし</option>
                {posts.map((post) => (
                  <option key={post.id} value={post.id}>{post.date}</option>
                ))}
              </select>
            </div>
            <div>
              <label>状態</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ImprovementTaskStatus })}>
                {taskStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label>担当者</label>
                <input value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} placeholder="担当者名" />
              </div>
              <div>
                <label>期限</label>
                <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
              </div>
            </div>
            <div>
              <label>メモ</label>
              <textarea rows={3} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="補足や対応方針" />
            </div>
            <Button onClick={saveTask}>{editingId ? "更新する" : "追加する"}</Button>
          </div>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        </Panel>

        <Panel>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-semibold">タスク一覧</h2>
              <p className="mt-1 text-sm text-stone-600">改善案を対応状況ごとに確認できます。</p>
            </div>
            <div className="w-full md:w-48">
              <label>状態で絞り込み</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as ImprovementTaskStatus | "all")}>
                <option value="all">すべて</option>
                {taskStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3">
            {filteredTasks.map((task) => {
              const post = task.postId ? postById[task.postId] : undefined;
              return (
                <article key={task.id} className="rounded-md border border-stone-200 bg-white/82 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(task.status)}`}>{taskStatusLabels[task.status]}</span>
                      <h3 className="mt-3 font-semibold leading-6 text-ink">{task.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                        <span>担当: {task.assignee || "未設定"}</span>
                        <span>期限: {task.dueDate || "未設定"}</span>
                        {post ? <Link href={`/posts/detail?id=${post.id}`} className="font-semibold text-clay hover:underline">投稿: {post.date}</Link> : <span>投稿: 紐づけなし</span>}
                      </div>
                      {task.memo ? <p className="mt-3 rounded-md bg-fog px-3 py-2 text-sm leading-6 text-stone-700">{task.memo}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <select value={task.status} onChange={(event) => changeStatus(task, event.target.value as ImprovementTaskStatus)} className="h-10 w-32">
                        {taskStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <Button variant="secondary" onClick={() => startEdit(task)}>編集</Button>
                      <Button variant="secondary" onClick={() => removeTask(task)}>削除</Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!filteredTasks.length ? <p className="rounded-md bg-fog p-5 text-center text-sm text-stone-600">タスクがありません。</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function emptyTask(): ImprovementTaskInput {
  return {
    title: "",
    status: "todo",
    assignee: "",
    dueDate: "",
    memo: ""
  };
}

function statusClass(status: ImprovementTaskStatus) {
  if (status === "done") return "bg-emerald-100 text-emerald-800";
  if (status === "doing") return "bg-amber-100 text-amber-800";
  return "bg-stone-100 text-stone-700";
}
