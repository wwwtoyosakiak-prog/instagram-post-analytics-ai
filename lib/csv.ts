import { InstagramPost, PostCategory, PostType } from "@/lib/types";

const headers = ["accountUsername", "date", "recordedDate", "url", "caption", "hashtags", "type", "category", "mediaCount", "likes", "comments", "saves", "shares", "views", "memo"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parsePostsCsv(csv: string, accountIdByUsername: Record<string, string> = {}): InstagramPost[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sourceHeaders = parseCsvLine(lines[0]).map((value) => value.trim());
  const index = Object.fromEntries(sourceHeaders.map((header, i) => [header, i]));
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const value = (key: string) => cells[index[key]]?.trim() ?? "";
    const rawType = value("type");
    const type: PostType = rawType === "video" || rawType === "reel" || rawType === "carousel" ? rawType : "image";
    const rawCategory = value("category");
    const category: PostCategory = ["product", "howto", "campaign", "voice", "recruit", "store", "sale", "brand"].includes(rawCategory) ? rawCategory as PostCategory : "other";
    const now = new Date().toISOString();
    return {
      id: `csv-${Date.now()}-${rowIndex}`,
      createdAt: now,
      updatedAt: now,
      accountId: accountIdByUsername[value("accountUsername").replace(/^@/, "")],
      date: value("date"),
      recordedDate: value("recordedDate") || new Date().toISOString().slice(0, 10),
      url: value("url"),
      caption: value("caption"),
      hashtags: value("hashtags"),
      type,
      category,
      mediaCount: Number(value("mediaCount")) || 1,
      likes: Number(value("likes")) || 0,
      comments: Number(value("comments")) || 0,
      saves: Number(value("saves")) || 0,
      shares: Number(value("shares")) || 0,
      views: Number(value("views")) || 0,
      memo: value("memo")
    };
  });
}

export const csvTemplate = `${headers.join(",")}
ozops_outdoor,2026-05-01,2026-05-02,https://www.instagram.com/p/example/,"軽量焚き火ギアの紹介","#アウトドアギア #キャンプ道具",reel,product,1,438,28,96,42,12800,"動画冒頭で使用シーンを見せた"`;
