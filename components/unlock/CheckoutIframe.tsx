"use client";

import { useState } from "react";

const UNLOCK_CHECKOUT_URL =
  "https://app.unlock-protocol.com/checkout?id=fce0c0fb-2c39-4912-807f-e5f64a9276e0";

interface CheckoutIframeProps {
  onClose: () => void;
}

/**
 * Embeds the Unlock Protocol checkout in an in-app iframe.
 * Keeps users in the app instead of opening a new tab.
 */
export function CheckoutIframe({ onClose }: CheckoutIframeProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Complete Purchase</h4>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      )}

      <iframe
        src={UNLOCK_CHECKOUT_URL}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className={`w-full rounded-lg border-0 ${isLoading ? "h-0" : "h-[600px]"}`}
        title="Unlock Protocol Checkout"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
