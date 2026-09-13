"use client";

import type { ReactNode } from "react";

type StrategyAction = {
  id: string;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  /** Native tooltip when hovered (e.g. reason when disabled). */
  title?: string;
};

type StrategyCardProps = {
  title: string;
  subtitle?: string;
  apr?: string;
  tvl?: string;
  badge?: ReactNode;
  description: string;
  footnote?: ReactNode;
  actions?: StrategyAction[];
};

export function StrategyCard({
  title,
  subtitle,
  apr,
  tvl,
  description,
  badge,
  actions,
  footnote,
}: StrategyCardProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            {badge}
          </div>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
          <div className="flex flex-col">
            <span className="text-xs tracking-wide text-slate-400 uppercase">Estimated APY</span>
            <span className="text-lg font-medium text-slate-900">{apr ?? "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs tracking-wide text-slate-400 uppercase">TVL</span>
            <span className="text-lg font-medium text-slate-900">{tvl ?? "—"}</span>
          </div>
        </div>
      </header>

      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>

      <div className="mt-auto flex flex-col gap-4 pt-6">
        {actions?.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400 disabled:hover:border-slate-400 disabled:hover:bg-slate-400"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!action.disabled && action.onClick) {
                    action.onClick();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!action.disabled && action.onClick) {
                      action.onClick();
                    }
                  }
                }}
                aria-label={action.ariaLabel ?? action.label}
                title={action.title}
                tabIndex={0}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        {footnote ? <div className="text-xs text-slate-500">{footnote}</div> : null}
      </div>
    </section>
  );
}
