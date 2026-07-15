import { KeyRound, User, CalendarDays, Columns3 } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";

const items = [
  { href: "/accounts", label: "プロフィール", description: "アカウント情報を確認する", icon: User },
  { href: "/token-management", label: "トークン管理", description: "連携状態と期限を見る", icon: KeyRound },
  { href: "/calendar", label: "カレンダー", description: "投稿予定を整理する", icon: CalendarDays },
  { href: "/content-pipeline", label: "制作パイプライン", description: "制作の進行を確認する", icon: Columns3 }
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="設定"
        description="設定まわりのページをここにまとめています。必要なものだけを開ける形にしています。"
      />
      <Panel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="rounded-lg border border-stone-200 bg-white p-4 transition hover:bg-stone-50">
                <div className="flex items-center gap-2 text-ink">
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <p className="mt-2 text-sm text-stone-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
