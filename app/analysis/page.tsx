import { BarChart3, FileText, Gauge, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";

const sections = [
  {
    title: "基本の確認",
    items: [
      { href: "/dashboard", label: "ダッシュボード", description: "投稿全体の数値を見る", icon: BarChart3 },
      { href: "/reports", label: "レポート", description: "月次のまとめを確認する", icon: FileText }
    ]
  },
  {
    title: "AI分析",
    items: [
      { href: "/ai-chat", label: "AIチャット", description: "質問しながら整理する", icon: Sparkles }
    ]
  },
  {
    title: "競合比較",
    items: [
      { href: "/competitors", label: "競合分析", description: "競合の投稿を比較する", icon: Swords },
      { href: "/competitor-dashboard", label: "競合ダッシュボード", description: "競合の数字をまとめて見る", icon: Gauge }
    ]
  }
];

export default function AnalysisPage() {
  return (
    <div>
      <PageHeader
        title="分析"
        description="数字を見る、AIで読む、競合と比べる、の3つに整理しています。"
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
