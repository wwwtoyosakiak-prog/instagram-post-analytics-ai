/**
 * Instagram Graph API ユーティリティ
 * 自分が管理権限を持つビジネス/クリエイターアカウントのみ対象
 */

const API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION ?? 'v23.0';

// INSTAGRAM_GRAPH_API_MODE=facebook_business と明示した場合のみ graph.facebook.com を使う。
// それ以外（未設定・instagram_login など）はすべて graph.instagram.com。
// 関数化することで、モジュール初期化時ではなくリクエストごとに env を読む。
function getApiBase(): string {
  return process.env.INSTAGRAM_GRAPH_API_MODE === 'facebook_business'
    ? `https://graph.facebook.com/${API_VERSION}`
    : `https://graph.instagram.com/${API_VERSION}`;
}
function getApiMode(): string {
  return process.env.INSTAGRAM_GRAPH_API_MODE === 'facebook_business'
    ? 'facebook_business'
    : 'instagram_login';
}

// ── 型定義 ────────────────────────────────────────────────

export interface IgAccountInfo {
  id: string;
  username?: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website: string;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: { id: string }[] };
  insights?: {
    data: { name: string; values: { value: number }[] }[];
  };
}

export interface IgMediaInsights {
  impressions?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  saved?: number | null;
  shares?: number | null;
  total_interactions?: number | null;
  follows?: number | null;
  profile_visits?: number | null;
  views?: number | null;
  plays?: number | null;
  ig_reels_avg_watch_time?: number | null;
  ig_reels_video_view_total_time?: number | null;
  video_view_total_time?: number | null;
  avg_watch_time?: number | null;
  navigation?: number | null;
  replies?: number | null;
  raw_response?: unknown;
}

export interface IgAccountInsights {
  reach?: number | null;
  impressions?: number | null;
  profile_views?: number | null;
  website_clicks?: number | null;
  follower_count?: number | null;
  online_followers?: unknown;
  audience_city?: unknown;
  audience_country?: unknown;
  audience_gender_age?: unknown;
  email_contacts?: number | null;
  get_directions_clicks?: number | null;
  phone_call_clicks?: number | null;
  text_message_clicks?: number | null;
}

export type ApiError =
  | { type: 'token_expired'; message: string; debug_url?: string; raw?: unknown }
  | { type: 'permission_denied'; message: string; debug_url?: string; raw?: unknown }
  | { type: 'unknown'; message: string; raw?: unknown; debug_url?: string };

// ── ヘルパー ─────────────────────────────────────────────

function getToken(): string {
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  if (!token) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN が未設定です');
  return token;
}

function getUid(igUserId?: string): string {
  if (igUserId) return igUserId;
  if (getApiMode() === 'instagram_login') return 'me';
  return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? 'me';
}

async function igFetch(url: string): Promise<unknown> {
  const debugUrl = url.replace(/access_token=[^&]+/, 'access_token=REDACTED');
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || (json as { error?: { message: string; code: number } }).error) {
    const err = (json as { error?: { message: string; code: number } }).error;
    console.error('[Instagram API Error]', debugUrl, JSON.stringify(err));
    if (err?.code === 190) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('parse')) {
        // "Cannot parse access token" はトークン種別とエンドポイントの不一致（設定ミス）
        throw { type: 'unknown', message: 'アクセストークンの形式エラーです（parse error）。INSTAGRAM_GRAPH_API_MODE 環境変数またはトークンの種類を確認してください。', debug_url: debugUrl, raw: err } as ApiError;
      }
      throw { type: 'token_expired', message: 'トークンが期限切れです。再連携してください。', debug_url: debugUrl, raw: err } as ApiError;
    }
    if (err?.code === 10 || err?.code === 200) throw { type: 'permission_denied', message: '必要なAPI権限がありません。', debug_url: debugUrl, raw: err } as ApiError;
    throw { type: 'unknown', message: err?.message ?? 'API エラー', raw: json, debug_url: debugUrl } as ApiError;
  }
  return json;
}

// ── アカウント情報取得 ────────────────────────────────────

export async function fetchAccountInfo(igUserId?: string): Promise<IgAccountInfo> {
  const token = getToken();
  const uid = getUid(igUserId);
  const fields = 'id,name,biography,profile_picture_url,followers_count,follows_count,media_count,website';
  const url = `${getApiBase()}/${uid}?fields=${fields}&access_token=${token}`;
  const data = await igFetch(url) as IgAccountInfo;
  return data;
}

// ── インサイトヘルパー ────────────────────────────────────

export function getMetric(
  insights: { data: { name: string; values: { value: number }[] }[] } | null | undefined,
  name: string
): number | null {
  return insights?.data?.find(m => m.name === name)?.values?.[0]?.value ?? null;
}

// ── 投稿一覧取得 ─────────────────────────────────────────

export async function fetchMediaList(igUserId?: string, limit = 50): Promise<IgMedia[]> {
  const token = getToken();
  const uid = getUid(igUserId);
  const insightMetrics = 'reach,views,saved,total_interactions,likes,shares,ig_reels_avg_watch_time';
  const fields = `id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children,insights.metric(${insightMetrics}){name,values}`;
  const results: IgMedia[] = [];
  let url: string | null = `${getApiBase()}/${uid}/media?fields=${fields}&limit=${limit}&access_token=${token}`;

  while (url && results.length < 200) {
    const data = await igFetch(url) as { data: IgMedia[]; paging?: { next?: string } };
    results.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }
  return results;
}

// ── 投稿インサイト取得 ────────────────────────────────────

// Business API で利用可能なメディアインサイト指標（impressions は廃止、views に置換）
const COMMON_METRICS = [
  'reach', 'views', 'likes', 'comments', 'saved',
  'shares', 'total_interactions', 'follows', 'profile_visits',
];
const VIDEO_METRICS = [
  ...COMMON_METRICS,
  'ig_reels_avg_watch_time',
];

function metricsForType(mediaType: string): string[] {
  if (mediaType === 'VIDEO') return VIDEO_METRICS;
  if (mediaType === 'CAROUSEL_ALBUM') return COMMON_METRICS;
  return COMMON_METRICS;
}

type InsightItem = {
  name: string;
  value?: number;
  values?: { value: number }[];
};

export async function fetchMediaInsights(mediaId: string, mediaType: string): Promise<IgMediaInsights> {
  const token = getToken();
  const metrics = metricsForType(mediaType).join(',');
  const url = `${getApiBase()}/${mediaId}/insights?metric=${metrics}&access_token=${token}`;
  let raw: unknown;
  try {
    raw = await igFetch(url);
    const data = (raw as { data: InsightItem[] }).data ?? [];
    const result: IgMediaInsights = { raw_response: raw };
    for (const item of data) {
      // Business API は values[0].value、一部は value 直値で返すケースもある
      const val = item.values?.[0]?.value ?? item.value ?? null;
      (result as Record<string, unknown>)[item.name] = val;
    }
    return result;
  } catch (e) {
    console.warn(`[fetchMediaInsights] ${mediaId} failed:`, e);
    return { raw_response: raw ?? e };
  }
}

// ── アカウント全体インサイト取得 ──────────────────────────

export async function fetchAccountInsights(igUserId?: string): Promise<IgAccountInsights> {
  const token = getToken();
  const uid = getUid(igUserId);

  const metrics = [
    'reach', 'impressions', 'profile_views', 'website_clicks',
    'follower_count', 'email_contacts',
    'get_directions_clicks', 'phone_call_clicks', 'text_message_clicks',
  ];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const since = Math.floor(yesterday.setHours(0, 0, 0, 0) / 1000);
  const until = Math.floor(yesterday.setHours(23, 59, 59, 999) / 1000) + 1;

  const result: IgAccountInsights = {};

  try {
    const url = `${getApiBase()}/${uid}/insights?metric=${metrics.join(',')}&period=day&since=${since}&until=${until}&access_token=${token}`;
    const raw = await igFetch(url) as { data: InsightItem[] };
    for (const item of raw.data ?? []) {
      const val = item.values?.[0]?.value ?? item.value ?? null;
      (result as Record<string, unknown>)[item.name] = val;
    }
  } catch (e) {
    console.warn('[fetchAccountInsights] スカラー指標取得失敗:', e);
  }

  const lifetimeMetrics = ['audience_city', 'audience_country', 'audience_gender_age', 'online_followers'];
  for (const metric of lifetimeMetrics) {
    try {
      const url = `${getApiBase()}/${uid}/insights?metric=${metric}&period=lifetime&access_token=${token}`;
      const raw = await igFetch(url) as { data: InsightItem[] };
      const item = raw.data?.[0];
      if (item) (result as Record<string, unknown>)[item.name] = item.values?.[0]?.value ?? item.value ?? null;
    } catch (e) {
      console.warn(`[fetchAccountInsights] ${metric} 取得失敗:`, e);
      (result as Record<string, unknown>)[metric] = null;
    }
  }

  return result;
}

// ── フォロワー数スナップショット ─────────────────────────

export async function fetchFollowerSnapshot(igUserId?: string): Promise<{
  followers_count: number;
  follows_count: number;
  media_count: number;
}> {
  const info = await fetchAccountInfo(igUserId);
  return {
    followers_count: info.followers_count,
    follows_count: info.follows_count,
    media_count: info.media_count,
  };
}

// ── リール動画かどうかの判定 ─────────────────────────────

export function isReel(mediaType: string, permalink: string): boolean {
  return mediaType === 'VIDEO' || permalink.includes('/reel/');
}
