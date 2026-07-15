import { BarChart3, FileText, Gauge, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";

const items = [
  { href: "/dashboard", label: "ダッシュボード", description: "投稿全体の数字を一度に見る", icon: BarChart3 },
  { href: "/reports", label: "レポート", description: "月ごとのまとまりを確認する", icon: FileText },
  { href: "/competitors", label: "競合分析", description: "競合の投稿内容を比べる", icon: Swords },
  { href: "/competitor-dashboard", label: "競合ダッシュボード", description: "競合の数字を一覧で見る", icon: Gauge },
  { href: "/ai-chat", label: "AIチャット", description: "数字の見方をAIに聞く", icon: Sparkles }
];

export default function AnalysisPage() {
  return (
    <div>
      <PageHeader
        title="分析"
        description="分析まわりのページをここにまとめています。まずはダッシュボードから見る形がわかりやすいです。"
      />
      <Panel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
