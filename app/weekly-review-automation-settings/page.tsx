"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  defaultWeeklyReviewAutomationSettings,
  type WeeklyReviewAutomationSettings,
} from "@/lib/weekly-review-automation-settings";

export default function WeeklyReviewAutomationSettingsPage() {
  const [settings, setSettings] =
    useState<WeeklyReviewAutomationSettings>(
      defaultWeeklyReviewAutomationSettings(),
    );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/weekly-review-automation-settings",
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "自動化設定を取得できませんでした。",
          );
        }

        setSettings(data.settings);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "自動化設定を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/weekly-review-automation-settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "自動化設定を保存できませんでした。",
        );
      }

      setSettings(data.settings);
      setMessage("自動化設定を保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "自動化設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="週次自動化設定"
        description="週次レビュー自動生成の実行条件とAIモデルを管理します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            記録が少ない週にAI生成を止めることで、不要なAPI利用を抑えられます。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void save()}
              disabled={saving || loading}
            >
              {saving ? "保存中..." : "設定を保存"}
            </Button>
            <Link
              href="/weekly-review-automation"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              自動化管理
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            {message}
          </p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">
            設定を読み込み中...
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <h2 className="font-semibold">
              実行設定
            </h2>

            <div className="mt-5 space-y-5">
              <Toggle
                label="週次レビュー自動化を有効にする"
                description="無効にすると自動実行・手動実行ともにスキップします。"
                checked={settings.enabled}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    enabled: checked,
                  }))
                }
              />

              <Toggle
                label="手動実行のみにする"
                description="Cronからの実行を止め、管理画面からの手動実行だけを許可します。"
                checked={settings.manualOnly}
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    manualOnly: checked,
                  }))
                }
              />

              <Toggle
                label="記録不足時はAI生成をスキップする"
                description="数値レビューだけ保存し、OpenAI APIは呼び出しません。"
                checked={
                  settings.skipAiWhenInsufficient
                }
                onChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    skipAiWhenInsufficient:
                      checked,
                  }))
                }
              />
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              データ条件
            </h2>

            <div className="mt-5 max-w-md">
              <label>
                AI生成に必要な最低記録日数
              </label>
              <select
                className="mt-1"
                value={
                  settings.minimumRecordedDays
                }
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    minimumRecordedDays: Number(
                      event.target.value,
                    ),
                  }))
                }
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map(
                  (days) => (
                    <option key={days} value={days}>
                      {days}日
                    </option>
                  ),
                )}
              </select>
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              AIモデル
            </h2>

            <div className="mt-5 max-w-xl">
              <label>OpenAIモデル名</label>
              <input
                className="mt-1"
                value={settings.aiModel}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    aiModel: event.target.value,
                  }))
                }
                placeholder="gpt-4.1-mini"
              />
              <p className="mt-2 text-xs leading-5 text-stone-500">
                利用可能なモデル名だけを設定してください。誤ったモデル名では自動実行が失敗します。
              </p>
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              現在の状態
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Status
                label="自動化"
                value={
                  settings.enabled
                    ? "有効"
                    : "無効"
                }
              />
              <Status
                label="実行方法"
                value={
                  settings.manualOnly
                    ? "手動のみ"
                    : "Cron＋手動"
                }
              />
              <Status
                label="最低記録日数"
                value={`${settings.minimumRecordedDays}日`}
              />
              <Status
                label="使用モデル"
                value={settings.aiModel}
              />
            </dl>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />
      <span>
        <span className="block font-semibold">
          {label}
        </span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          {description}
        </span>
      </span>
    </label>
  );
}

function Status({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <dt className="text-xs font-semibold text-stone-500">
        {label}
      </dt>
      <dd className="mt-2 font-bold">
        {value}
      </dd>
    </div>
  );
}
