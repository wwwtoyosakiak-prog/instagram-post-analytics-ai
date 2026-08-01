import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui";
import { ChartPanel, DateWeekdayTick, GrowthSummaryPanel, SectionLead } from "@/components/dashboard/widgets";
import type { InsightGrowthSummary } from "@/lib/insight-growth";

type ChartData = {
  graphPeriodLabel: string;
  graphCount: number;
  dailyViews: Array<{ axisLabel: string; tooltipLabel: string; date: string; views: number }>;
  typeData: Array<{ name: string; averageViews: number; averageEngagementRate: number }>;
  weekdayData: Array<{ name: string; averageEngagementRate: number }>;
  saveRank: Array<{ name: string; saves: number }>;
  likeRank: Array<{ name: string; likes: number }>;
};

type HourlyInsightRow = {
  hour: string;
  views: number;
  growth: number;
  postCount: number;
};

export function DashboardCharts({ data }: { data: ChartData }) {
  return (
    <>
      <section className="mt-8">
        <SectionLead eyebrow="Charts" title="推移と比較" description="時系列の流れ、投稿タイプ差、カテゴリ差を横断して確認できるグラフ群です。" />
        <p className="mt-4 text-sm text-stone-600">{data.graphPeriodLabel}の投稿 {data.graphCount}件をもとに集計しています。期間切替は上のタブと共通です。</p>
      </section>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="日別表示数の推移" description="投稿日ごとの表示数の流れです。大きく伸びた日を先に把握できます。" accent="clay" className="lg:col-span-2" chartHeightClassName="h-80">
          <LineChart data={data.dailyViews} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="axisLabel" interval="preserveStartEnd" minTickGap={18} tickMargin={10} tick={<DateWeekdayTick />} height={52} />
            <YAxis />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""} />
            <Line type="monotone" dataKey="views" name="表示数" stroke="#b55d3e" strokeWidth={2} />
          </LineChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均表示数" description="動画・画像など、形式ごとの平均表示数を比較します。" accent="moss">
          <BarChart data={data.typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageViews" name="平均表示数" fill="#53624a" /></BarChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均エンゲージメント率" description="反応率が高い投稿形式を比較します。" accent="clay">
          <BarChart data={data.typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#b55d3e" /></BarChart>
        </ChartPanel>
        <ChartPanel title="曜日別の平均エンゲージメント率" description="反応が出やすい曜日の偏りを確認します。" accent="sky">
          <BarChart data={data.weekdayData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#2f766d" /></BarChart>
        </ChartPanel>
        <ChartPanel title="保存数ランキング" description="保存されやすかった投稿を上位順に見ます。" accent="moss">
          <BarChart data={data.saveRank}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="saves" name="保存数" fill="#53624a" /></BarChart>
        </ChartPanel>
        <ChartPanel title="いいね数ランキング" description="いいね数の上位投稿を一覧で確認します。" accent="clay">
          <BarChart data={data.likeRank}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="likes" name="いいね数" fill="#b55d3e" /></BarChart>
        </ChartPanel>
      </div>
    </>
  );
}

export function HourlyInsightPanel({ insightDate, onInsightDateChange, rows }: {
  insightDate: string;
  onInsightDateChange: (date: string) => void;
  rows: HourlyInsightRow[];
}) {
  return (
    <Panel className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold">時間別の閲覧数変化</h2>
          <p className="mt-1 text-sm text-stone-600">1日4回の定期同期で保存したインサイトを、選択日の時間帯ごとに表示します。</p>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="insight-date">表示する日</label>
          <input id="insight-date" type="date" value={insightDate} onChange={(event) => onInsightDateChange(event.target.value)} />
        </div>
      </div>
      {rows.length ? (
        <div className="mt-5 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" /><YAxis />
              <Tooltip formatter={(value, name) => [Number(value ?? 0).toLocaleString(), String(name)]} />
              <Legend />
              <Line type="monotone" dataKey="views" name="合計閲覧数" stroke="#b55d3e" strokeWidth={2} />
              <Line type="monotone" dataKey="growth" name="前回からの増加" stroke="#2f766d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-fog p-4 text-sm text-stone-600">選択日の同期履歴はまだありません。</p>
      )}
    </Panel>
  );
}

export function PeriodGrowthSection({ week, month }: { week: InsightGrowthSummary; month: InsightGrowthSummary }) {
  return (
    <section className="mt-6 border-y border-stone-200 py-6">
      <SectionLead eyebrow="Growth" title="週・月の伸び" description="Instagram API の同期履歴から、期間内にどれだけ増えたかを比較します。" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GrowthSummaryPanel title="一週間" summary={week} />
        <GrowthSummaryPanel title="一ヶ月" summary={month} />
      </div>
    </section>
  );
}
