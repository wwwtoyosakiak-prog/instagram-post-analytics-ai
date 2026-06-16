"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addGoalData, deleteGoalData, loadAccountsData, loadGoalsData, loadPostsData, updateGoalData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramPost, MonthlyGoal, MonthlyGoalInput } from "@/lib/types";
import { average, getMetrics } from "@/lib/metrics";

export default function GoalsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [accountId, setAccountId] = useState("all");
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState<MonthlyGoalInput>(emptyGoal(currentMonth(), null));
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([loadAccountsData(), loadPostsData(), loadGoalsData()]).then(([loadedAccounts, loadedPosts, loadedGoals]) => {
      setAccounts(loadedAccounts);
      setPosts(loadedPosts);
      setGoals(loadedGoals);
    });
  }, []);

  const selectedGoal = useMemo(() => {
    const selectedAccountId = accountId === "all" ? null : accountId;
    return goals.find((goal) => goal.month === month && (goal.accountId ?? null) === selectedAccountId) ?? null;
  }, [goals, accountId, month]);

  useEffect(() => {
    const selectedAccountId = accountId === "all" ? null : accountId;
    setForm(selectedGoal ? toInput(selectedGoal) : emptyGoal(month, selectedAccountId));
  }, [selectedGoal, accountId, month]);

  const actual = useMemo(() => {
    const targetPosts = posts.filter((post) => post.date.startsWith(month)).filter((post) => accountId === "all" || post.accountId === accountId);
    return {
      posts: targetPosts.length,
      views: targetPosts.reduce((sum, post) => sum + post.views, 0),
      saves: targetPosts.reduce((sum, post) => sum + post.saves, 0),
      saveRate: average(targetPosts.map((post) => getMetrics(post).saveRate)),
      engagementRate: average(targetPosts.map((post) => getMetrics(post).engagementRate))
    };
  }, [posts, month, accountId]);

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = normalizeGoal({ ...form, month, accountId: accountId === "all" ? null : accountId });
    const saved = selectedGoal ? await updateGoalData(selectedGoal.id, input) : await addGoalData(input);
    if (!saved) {
      setMessage("目標を保存できませんでした。設定を確認してください。");
      return;
    }
    setGoals((current) => [saved, ...current.filter((goal) => goal.id !== saved.id)]);
    setMessage(selectedGoal ? "目標を更新しました。" : "目標を保存しました。");
  };

  const removeGoal = async () => {
    if (!selectedGoal) return;
    if (!window.confirm("この月間目標を削除しますか？")) return;
    await deleteGoalData(selectedGoal.id);
    setGoals((current) => current.filter((goal) => goal.id !== selectedGoal.id));
    setMessage("目標を削除しました。");
  };

  return (
    <div>
      <PageHeader title="目標管理" description="月間投稿数、表示数、保存数、平均保存率、平均ERの目標を設定し、達成率を確認します。" />
      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label>対象月</label>
            <input className="mt-1" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div>
            <label>アカウント</label>
            <select className="mt-1" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="all">すべて</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <GoalStat label="投稿数" actual={actual.posts} target={form.targetPosts} suffix="件" />
        <GoalStat label="表示数" actual={actual.views} target={form.targetViews} suffix="" />
        <GoalStat label="保存数" actual={actual.saves} target={form.targetSaves} suffix="" />
        <GoalStat label="平均保存率" actual={actual.saveRate} target={form.targetSaveRate} suffix="%" decimal />
        <GoalStat label="平均ER" actual={actual.engagementRate} target={form.targetEngagementRate} suffix="%" decimal />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <h2 className="font-semibold">{selectedGoal ? "目標を編集" : "目標を登録"}</h2>
          <form className="mt-4 grid gap-4" onSubmit={saveGoal}>
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField label="月間投稿数目標" value={form.targetPosts} onChange={(value) => setForm({ ...form, targetPosts: value })} suffix="件" />
              <NumberField label="月間表示数目標" value={form.targetViews} onChange={(value) => setForm({ ...form, targetViews: value })} />
              <NumberField label="月間保存数目標" value={form.targetSaves} onChange={(value) => setForm({ ...form, targetSaves: value })} />
              <NumberField label="平均保存率目標" value={form.targetSaveRate} onChange={(value) => setForm({ ...form, targetSaveRate: value })} step="0.1" suffix="%" />
              <NumberField label="平均ER目標" value={form.targetEngagementRate} onChange={(value) => setForm({ ...form, targetEngagementRate: value })} step="0.1" suffix="%" />
            </div>
            <div>
              <label>メモ</label>
              <textarea className="mt-1" rows={4} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="今月の重点方針や背景を記録できます。" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{selectedGoal ? "目標を更新" : "目標を保存"}</Button>
              {selectedGoal ? <Button variant="secondary" onClick={removeGoal}>削除</Button> : null}
            </div>
          </form>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        </Panel>

        <Panel>
          <h2 className="font-semibold">保存済み目標</h2>
          <div className="mt-4 grid gap-2">
            {goals.slice(0, 12).map((goal) => {
              const account = goal.accountId ? accounts.find((item) => item.id === goal.accountId)?.name ?? "不明なアカウント" : "すべて";
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => {
                    setAccountId(goal.accountId ?? "all");
                    setMonth(goal.month);
                  }}
                  className="rounded-md border border-stone-200 bg-white/80 px-3 py-3 text-left hover:border-moss"
                >
                  <p className="font-semibold">{goal.month} / {account}</p>
                  <p className="mt-1 text-sm text-stone-600">投稿 {goal.targetPosts}件 / 表示 {goal.targetViews.toLocaleString()} / 保存 {goal.targetSaves.toLocaleString()}</p>
                </button>
              );
            })}
            {!goals.length ? <p className="text-sm text-stone-500">保存済み目標はまだありません。</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function GoalStat({ label, actual, target, suffix, decimal = false }: { label: string; actual: number; target: number; suffix: string; decimal?: boolean }) {
  const rate = target > 0 ? Math.min((actual / target) * 100, 999) : 0;
  const actualText = decimal ? actual.toFixed(2) : Math.round(actual).toLocaleString();
  const targetText = decimal ? target.toFixed(2) : Math.round(target).toLocaleString();
  return (
    <div className="rounded-lg border border-white/70 bg-white/78 p-4 shadow-panel backdrop-blur">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{target > 0 ? `${rate.toFixed(0)}%` : "未設定"}</p>
      <p className="mt-2 text-sm text-stone-600">実績 {actualText}{suffix} / 目標 {targetText}{suffix}</p>
      <div className="mt-3 h-2 rounded-full bg-stone-100">
        <div className="h-2 rounded-full bg-moss" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1", suffix = "" }: { label: string; value: number; onChange: (value: number) => void; step?: string; suffix?: string }) {
  return (
    <div>
      <label>{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <span className="text-sm text-stone-600">{suffix}</span> : null}
      </div>
    </div>
  );
}

function emptyGoal(month: string, accountId: string | null): MonthlyGoalInput {
  return {
    accountId,
    month,
    targetPosts: 12,
    targetViews: 30000,
    targetSaves: 300,
    targetSaveRate: 1,
    targetEngagementRate: 3,
    memo: ""
  };
}

function toInput(goal: MonthlyGoal): MonthlyGoalInput {
  return {
    accountId: goal.accountId,
    month: goal.month,
    targetPosts: goal.targetPosts,
    targetViews: goal.targetViews,
    targetSaves: goal.targetSaves,
    targetSaveRate: goal.targetSaveRate,
    targetEngagementRate: goal.targetEngagementRate,
    memo: goal.memo
  };
}

function normalizeGoal(goal: MonthlyGoalInput): MonthlyGoalInput {
  return {
    ...goal,
    targetPosts: Math.max(0, Number(goal.targetPosts) || 0),
    targetViews: Math.max(0, Number(goal.targetViews) || 0),
    targetSaves: Math.max(0, Number(goal.targetSaves) || 0),
    targetSaveRate: Math.max(0, Number(goal.targetSaveRate) || 0),
    targetEngagementRate: Math.max(0, Number(goal.targetEngagementRate) || 0)
  };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
