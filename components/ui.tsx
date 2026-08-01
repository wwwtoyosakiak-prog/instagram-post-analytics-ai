import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-ink md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-stone-200 bg-white p-5 md:p-6 ${className}`}>{children}</section>;
}

export function Button({ children, type = "button", onClick, variant = "primary", disabled = false }: { children: ReactNode; type?: "button" | "submit"; onClick?: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const classes =
    variant === "primary"
      ? "bg-ink text-white hover:bg-stone-800"
      : "border border-stone-200 bg-white text-ink hover:bg-stone-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-stone-400">{note}</p> : null}
    </div>
  );
}

export function ActionError({ message, actionLabel, onAction, className = "" }: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 ${className}`}>
      <div className="flex gap-3">
        <AlertCircle size={19} className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">操作を完了できませんでした</p>
          <p className="mt-1 leading-6 text-red-800">{message}</p>
          {actionLabel && onAction ? (
            <button type="button" onClick={onAction} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 font-semibold text-red-900 transition hover:bg-red-100">
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, actionHref, onAction, className = "" }: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  const actionClass = "mt-4 inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-stone-800";
  return (
    <div className={`rounded-lg border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center ${className}`}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">{description}</p>
      {actionHref ? <Link href={actionHref} className={actionClass}>{actionLabel}</Link> : null}
      {!actionHref && onAction ? <button type="button" onClick={onAction} className={actionClass}>{actionLabel}</button> : null}
    </div>
  );
}

export function LoadingBlock({ className = "h-5" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-stone-200/80 ${className}`} />;
}

export function PageLoading({
  title,
  description = "必要なデータを準備しています。",
  cards = 3,
  layout = "list",
}: {
  title: string;
  description?: string;
  cards?: number;
  layout?: "list" | "detail" | "profile";
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <PageHeader title={title} description={description} />
      <span className="sr-only">読み込み中です</span>
      {layout === "profile" ? (
        <Panel>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <LoadingBlock className="h-28 w-28 shrink-0 rounded-full md:h-36 md:w-36" />
            <div className="flex-1 space-y-4">
              <LoadingBlock className="h-7 w-48" />
              <LoadingBlock className="h-4 w-32" />
              <LoadingBlock className="h-4 w-full max-w-lg" />
              <div className="grid max-w-lg grid-cols-3 gap-3">
                {Array.from({ length: 3 }, (_, index) => <LoadingBlock key={index} className="h-16" />)}
              </div>
            </div>
          </div>
        </Panel>
      ) : layout === "detail" ? (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Panel><LoadingBlock className="h-72 w-full" /><LoadingBlock className="mt-5 h-24 w-full" /></Panel>
          <Panel><LoadingBlock className="h-10 w-44" /><LoadingBlock className="mt-5 h-56 w-full" /></Panel>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <LoadingBlock key={index} className="h-24" />)}
          </div>
          <Panel className="space-y-3">
            {Array.from({ length: cards }, (_, index) => <LoadingBlock key={index} className="h-20 w-full" />)}
          </Panel>
        </>
      )}
    </div>
  );
}
