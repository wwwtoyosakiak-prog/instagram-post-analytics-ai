import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-clay">Instagram Analytics</p>
        <h1 className="max-w-4xl text-3xl font-bold leading-tight text-ink md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-white/70 bg-white/78 p-5 shadow-panel backdrop-blur md:p-6 ${className}`}>{children}</section>;
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-moss">
      {children}
    </Link>
  );
}

export function Button({ children, type = "button", onClick, variant = "primary", disabled = false }: { children: ReactNode; type?: "button" | "submit"; onClick?: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const classes =
    variant === "primary"
      ? "bg-ink text-white shadow-soft hover:bg-moss"
      : "border border-stone-200 bg-white/90 text-ink hover:border-moss hover:bg-fog";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/78 p-4 shadow-panel backdrop-blur">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-stone-400">{note}</p> : null}
    </div>
  );
}
