import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  icon: ReactNode;
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  options: DropdownOption[];
}

export function Dropdown({ trigger, options }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content className="rounded-md bg-gray-400 p-1 shadow-md" align="end">
        {options.map((option, index) => (
          <DropdownMenu.Item
            key={index}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 focus-visible:outline-none",
              option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-300"
            )}
            onClick={(e) => {
              if (!option.disabled && option.onClick) {
                e.preventDefault();
                option.onClick();
              }
            }}
            disabled={option.disabled}
          >
            {option.icon}
            <span>{option.label}</span>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
