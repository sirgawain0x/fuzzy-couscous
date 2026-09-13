"use client";

import { StrategyCard } from "@/components/strategies/StrategyCard";

type StrategyGridProps = {
  items: Array<
    Omit<React.ComponentProps<typeof StrategyCard>, "actions" | "description" | "title"> & {
      id: string;
      title: string;
      description: string;
      actions?: React.ComponentProps<typeof StrategyCard>["actions"];
    }
  >;
};

export function StrategyGrid({ items }: StrategyGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {items.map((item) => (
        <StrategyCard key={item.id} {...item} />
      ))}
    </div>
  );
}
