import Link from "next/link";
import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { Panel } from "@/components/ui";
import { calculateInsightGrowth } from "@/lib/insight-growth";
import type { MetricSource } from "@/lib/post-merge";
import type { GraphPeriod } from "@/components/dashboard/types";
import { videoTitle } from "@/components/dashboard/utils";

export function SourceBadge({ source }: { source: MetricSource }) {
  return source === "api"
    ? <span className="inline-block rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-blue-700">API</span>
    : <span className="inline-block rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-stone-500">未取得</span>;
}

export function GrowthPattern({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-l-2 border-clay pl-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export function GrowthSummaryPanel({ title, summary }: {
  title: string;
  summary: ReturnType<typeof calculateInsightGrowth>;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        <span className="text-xs text-stone-500">対象 {summary.syncedPosts}投稿</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Insight label="閲覧増加" value={`+${summary.viewsGrowth.toLocaleString()}`} />
        <Insight label="成長率" value={`+${summary.viewsGrowthRate.toFixed(1)}%`} />
        <Insight label="保存増加" value={`+${summary.savedGrowth.toLocaleString()}`} />
        <Insight label="シェア増加" value={`+${summary.sharesGrowth.toLocaleString()}`} />
      </div>
      <div className="mt-4 grid gap-2">
        {summary.topPosts.map((item, index) => (
          <Link
            key={item.post.id}
            href={`/posts/detail?id=${item.post.id}`}
            className="flex items-center justify-between gap-3 border-t border-stone-100 pt-2 text-sm hover:text-clay"
          >
            <span className="line-clamp-1">{index + 1}. {videoTitle(item.post)}</span>
            <span className="shrink-0 font-semibold">+{item.viewsGrowth.toLocaleString()}</span>
          </Link>
        ))}
        {!summary.topPosts.length ? <p className="text-sm text-stone-500">この期間の同期履歴はまだありません。</p> : null}
      </div>
    </div>
  );
}

export function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-base font-bold text-ink">{value}</p>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

export function SyncInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold text-stone-500">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function renderDelta(value: number, suffix = "", decimal = false) {
  const prefix = value > 0 ? "+" : "";
  return decimal ? `${prefix}${value.toFixed(2)}${suffix}` : `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
}

export function CompareStat({
  label, currentDay, previousDay, currentWeek, previousWeek, suffix = "", decimal = false,
}: {
  label: string;
  currentDay: number;
  previousDay: number;
  currentWeek: number;
  previousWeek: number;
  suffix?: string;
  decimal?: boolean;
}) {
  const renderValue = (value: number) => decimal ? `${value.toFixed(2)}${suffix}` : `${Math.round(value).toLocaleString()}${suffix}`;
  return (
    <div className="rounded-xl border border-stone-200/80 bg-fog/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <div className="mt-3 grid gap-3">
        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-xs font-semibold text-stone-500">前日比</p>
          <p className="mt-1 text-sm font-bold text-ink">{renderValue(currentDay)} / {renderValue(previousDay)}</p>
          <p className="mt-1 text-xs text-stone-600">差分 {renderDelta(currentDay - previousDay, suffix, decimal)}</p>
        </div>
        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-xs font-semibold text-stone-500">前週比</p>
          <p className="mt-1 text-sm font-bold text-ink">{renderValue(currentWeek)} / {renderValue(previousWeek)}</p>
          <p className="mt-1 text-xs text-stone-600">差分 {renderDelta(currentWeek - previousWeek, suffix, decimal)}</p>
        </div>
      </div>
    </div>
  );
}

export function SectionLead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-clay">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

export function HeroStat({ label, value, note, tone }: {
  label: string;
  value: string;
  note: string;
  tone: "moss" | "clay" | "sky" | "plum";
}) {
  const toneClasses = {
    moss: "from-moss/18 border-moss/20 text-moss",
    clay: "from-clay/18 border-clay/20 text-clay",
    sky: "from-skyglass border-skyglass/90 text-teal-800",
    plum: "from-plum/16 border-plum/20 text-plum",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-white/90 p-5 shadow-panel ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{note}</p>
    </div>
  );
}

export function ChartPanel({
  title, description, accent, children, className = "", chartHeightClassName = "h-72",
}: {
  title: string;
  description: string;
  accent: "moss" | "clay" | "sky" | "plum";
  children: ReactElement;
  className?: string;
  chartHeightClassName?: string;
}) {
  const accentClasses = { moss: "bg-moss", clay: "bg-clay", sky: "bg-teal-700", plum: "bg-plum" };
  return (
    <Panel className={`relative overflow-hidden ${className}`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${accentClasses[accent]}`} />
      <div className="pl-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
      </div>
      <div className={chartHeightClassName}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function DateWeekdayTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const [dateLabel, weekdayLabel] = String(payload?.value ?? "").split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#57534e" fontSize={12}>
        <tspan x={0}>{dateLabel}</tspan>
        <tspan x={0} dy={14} fontSize={11} fill="#78716c">{weekdayLabel}</tspan>
      </text>
    </g>
  );
}

export function GraphPeriodTabs({ graphPeriod, setGraphPeriod }: {
  graphPeriod: GraphPeriod;
  setGraphPeriod: (period: GraphPeriod) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1 rounded-md border border-stone-200 bg-white/80 p-1">
      {(["1", "7", "14", "30", "90", "365"] as const).map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => setGraphPeriod(period)}
          className={`rounded px-3 py-2 text-sm font-semibold transition ${graphPeriod === period ? "bg-ink text-white" : "text-stone-600 hover:bg-fog"}`}
        >
          {period === "1" ? "一日" : period === "7" ? "一週間" : period === "14" ? "二週間" : period === "30" ? "一ヶ月" : period === "90" ? "90日" : "一年"}
        </button>
      ))}
    </div>
  );
}
