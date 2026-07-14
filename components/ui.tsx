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

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-stone-800">
      {children}
    </Link>
  );
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
