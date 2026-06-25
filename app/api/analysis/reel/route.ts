/**
 * POST /api/analysis/reel
 * リール詳細のAI分析テキストを生成する
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  const apiKeyEnv = process.env.OPENAI_API_KEY;
  if (!apiKeyEnv) {
    return NextResponse.json({ result: 'OpenAI APIキーが設定されていません。.env.local に OPENAI_API_KEY を設定してください。' });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyEnv}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
      }),
    });

    const data = await res.json() as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };

    if (data.error) {
      console.error('[reel AI]', data.error);
      return NextResponse.json({ result: `AI分析エラー: ${data.error.message}` });
    }

    const result = data.choices?.[0]?.message?.content ?? 'AI分析に失敗しました。';
    return NextResponse.json({ result });
  } catch (e) {
    console.error('[reel AI exception]', e);
    return NextResponse.json({ result: 'AI分析中にエラーが発生しました。' });
  }
}
