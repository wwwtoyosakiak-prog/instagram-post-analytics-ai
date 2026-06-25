import { InstagramPost } from './types';

export type MetricSource = 'api' | 'manual';

export interface ApiMediaInsights {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  saved?: number | null;
  shares?: number | null;
  total_interactions?: number | null;
  ig_reels_avg_watch_time?: number | null;
}

export interface ApiMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  latest_insights?: ApiMediaInsights | null;
}

/**
 * APIの値が存在かつ >0 なら API採用、それ以外は手入力にフォールバック。
 * preferApi=false で手入力優先に切り替え可能。
 */
export function mergePostMetrics(
  post: Pick<InstagramPost, 'views' | 'likes' | 'saves' | 'comments'>,
  ins: ApiMediaInsights | null | undefined,
  preferApi = true,
): {
  views: number; viewsSrc: MetricSource;
  likes: number; likesSrc: MetricSource;
  saves: number; savesSrc: MetricSource;
  comments: number; commentsSrc: MetricSource;
} {
  const pick = (apiVal: number | null | undefined, fallback: number): [number, MetricSource] => {
    if (preferApi && apiVal != null && apiVal > 0) return [apiVal, 'api'];
    return [fallback, 'manual'];
  };
  const [views, viewsSrc] = pick(ins?.views, post.views);
  const [likes, likesSrc] = pick(ins?.likes, post.likes);
  const [saves, savesSrc] = pick(ins?.saved, post.saves);
  const [comments, commentsSrc] = pick(ins?.comments, post.comments);
  return { views, viewsSrc, likes, likesSrc, saves, savesSrc, comments, commentsSrc };
}

/**
 * 手入力投稿に対応するAPIメディアを探す。
 * 1. permalink (post.url) の完全一致
 * 2. 投稿日(JST) + キャプション先頭20文字
 */
export function matchPostToMedia(
  post: Pick<InstagramPost, 'url' | 'date' | 'caption'>,
  mediaList: ApiMedia[],
): ApiMedia | undefined {
  if (post.url) {
    const found = mediaList.find(m => m.permalink === post.url);
    if (found) return found;
  }
  const postCaption = post.caption?.trim().slice(0, 20) ?? '';
  return mediaList.find(m => {
    const mDate = new Date(m.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 10);
    if (mDate !== post.date) return false;
    if (!postCaption) return false;
    return (m.caption?.trim().slice(0, 20) ?? '') === postCaption;
  });
}
