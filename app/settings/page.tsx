import { KeyRound, User, CalendarDays, Columns3 } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";

const sections = [
  {
    title: "基本設定",
    items: [
      { href: "/accounts", label: "プロフィール", description: "アカウント情報を管理する", icon: User },
      { href: "/token-management", label: "トークン管理", description: "連携状態と期限を確認する", icon: KeyRound }
    ]
  },
  {
    title: "運用準備",
    items: [
      { href: "/calendar", label: "カレンダー", description: "投稿予定を整理する", icon: CalendarDays }
    ]
  },
  {
    title: "AI・制作",
    items: [
      { href: "/content-pipeline", label: "制作パイプライン", description: "制作の進行を確認する", icon: Columns3 }
    ]
  }
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="設定"
        description="必要な設定と最低限の導線だけをまとめています。"
      />
      <div className="grid gap-4">
        {sections.map((section) => (
          <Panel key={section.title}>
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {section.items.map((item) => {
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
        ))}
      </div>
    </div>
  );
}
