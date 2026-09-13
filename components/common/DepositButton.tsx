import { PlusIcon } from "@heroicons/react/24/outline";

export function DepositButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="hover:bg-primary-hover bg-primary text-primary-foreground flex h-12 flex-grow items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition md:w-40"
      onClick={onClick}
    >
      <PlusIcon className="h-6 w-6 text-gray-500 dark:text-gray-100" /> Add USDC
    </button>
  );
}
