import React, { useRef } from "react";

interface AmountInputProps {
  amount: string;
  onChange: (value: string) => void;
  onMax?: () => void;
}

export function AmountInput({ amount, onChange, onMax }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace("$", "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    if (value.split(".").length > 2) return;
    if (value.split(".")[1]?.length > 2) return;

    onChange(value);
  };

  return (
    <div
      className="flex w-full cursor-text flex-col items-center"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        placeholder="$0.00"
        className="mb-1 w-full border-none text-center text-[54px] font-bold outline-none focus:ring-0"
        value={amount ? `$${amount}` : ""}
        onChange={handleChange}
        autoFocus
        style={{ maxWidth: 200 }}
      />
      {!amount && (
        <p className="animate-pulse text-sm font-medium text-gray-900">Tap above to enter amount</p>
      )}
      {onMax && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMax();
          }}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
        >
          Max
        </button>
      )}
    </div>
  );
}
