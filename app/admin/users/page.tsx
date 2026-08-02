"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui";
import { requestJson } from "@/lib/client-api";

type UserRow = { id: string; username: string; role: "admin" | "member"; active: boolean };

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => requestJson<{ users: UserRow[] }>("/api/admin/users").then((data) => setUsers(data.users)).catch((caught) => setError(caught instanceof Error ? caught.message : "読み込めませんでした。"));
  useEffect(() => { void load(); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    try {
      await requestJson("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role }) });
      setUsername(""); setPassword(""); setRole("member"); setMessage("ユーザーを追加しました。"); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "追加できませんでした。"); }
  };

  const update = async (user: UserRow, values: Partial<UserRow> & { password?: string }) => {
    setError(""); setMessage("");
    try {
      await requestJson("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, ...values }) });
      setMessage("ユーザー設定を更新しました。"); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "更新できませんでした。"); }
  };

  return <div>
    <PageHeader title="ユーザー管理" description="利用者の追加、停止、権限変更、パスワード再設定を行います。" />
    <Panel>
      <h2 className="font-semibold">新しいユーザーを追加</h2>
      <form onSubmit={create} className="mt-4 grid gap-4 md:grid-cols-4">
        <div><label htmlFor="new-user">ユーザーID</label><input id="new-user" required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><label htmlFor="new-password">パスワード</label><input id="new-password" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div><label htmlFor="new-role">権限</label><select id="new-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}><option value="member">一般ユーザー</option><option value="admin">管理者</option></select></div>
        <button className="btn-primary self-end" type="submit">追加する</button>
      </form>
    </Panel>
    <Panel className="mt-6">
      <h2 className="font-semibold">登録済みユーザー</h2>
      <div className="mt-4 space-y-3">{users.length ? users.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-4">
        <div className="mr-auto"><p className="font-medium">{user.username}</p><p className="text-xs text-stone-500">{user.role === "admin" ? "管理者" : "一般ユーザー"}・{user.active ? "利用中" : "停止中"}</p></div>
        <select aria-label={`${user.username}の権限`} value={user.role} onChange={(e) => void update(user, { role: e.target.value as "admin" | "member" })}><option value="member">一般ユーザー</option><option value="admin">管理者</option></select>
        <button type="button" className="btn-secondary" onClick={() => { const next = window.prompt("新しいパスワード（12文字以上）"); if (next) void update(user, { password: next }); }}>パスワード変更</button>
        <button type="button" className="btn-secondary" onClick={() => void update(user, { active: !user.active })}>{user.active ? "利用停止" : "再開"}</button>
      </div>) : <p className="text-sm text-stone-500">管理画面から追加されたユーザーはまだいません。</p>}</div>
      {message ? <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p> : null}{error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
    </Panel>
  </div>;
}
