import { cn } from "@/lib/utils";
import { XMarkIcon, ArrowLongLeftIcon } from "@heroicons/react/24/outline";
import React, { ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
  title?: ReactNode;
  showCloseButton?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  showBackButton,
  onBack,
  className,
  title,
  showCloseButton,
}: ModalProps) {
  // Store original values in a ref so they persist across open/close cycles
  const originalStylesRef = useRef<{
    overflow: string;
    touchAction: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      // When modal is closed, restore original styles via cleanup
      // Don't clear styles here - let cleanup handle it
      return;
    }

    // Capture the current body styles every time the modal opens
    // This ensures we always restore to the state that existed when we opened,
    // even if other components modified the styles between close and open
    originalStylesRef.current = {
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
    };

    // Lock body scroll - works better on mobile with touch-action
    document.body.style.overflow = "hidden";
    // Prevent touch scrolling on mobile devices
    document.body.style.touchAction = "none";

    // Cleanup function to restore original values
    // This runs when the modal closes (open becomes false) or component unmounts
    return () => {
      const original = originalStylesRef.current;
      if (original) {
        // Restore original overflow value or remove the style
        if (original.overflow) {
          document.body.style.overflow = original.overflow;
        } else {
          document.body.style.overflow = "";
        }

        // Restore original touch-action or remove the style
        if (original.touchAction) {
          document.body.style.touchAction = original.touchAction;
        } else {
          document.body.style.touchAction = "";
        }
      } else {
        // Fallback: remove styles if original values weren't captured
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/30 py-6 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "relative mx-4 flex w-full max-w-md flex-col items-center overflow-y-auto rounded-2xl bg-gray-400 p-6 shadow-xl",
          "max-h-[calc(100dvh-48px)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-9 w-full items-center justify-between">
          {showBackButton && (
            <button
              onClick={onBack || onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-400 hover:bg-gray-300"
              aria-label="Back"
              type="button"
            >
              <ArrowLongLeftIcon className="h-6 w-6 text-gray-900" />
            </button>
          )}
          {title && (
            <div className="absolute left-1/2 w-max transform-[translateX(-50%)] text-lg font-semibold">
              {title}
            </div>
          )}
          {showCloseButton && (
            <button onClick={onClose} className="absolute right-0">
              <XMarkIcon className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
