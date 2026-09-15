"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";

type EligibilityResponse = {
  allowed: boolean;
  country: string | null;
  attested: boolean;
  reason?: string;
};

type GateState = {
  allowed: boolean;
  attested: boolean;
  country: string | null;
  reason?: string;
  loading: boolean;
  error: string | null;
};

type Props = {
  onReady: () => void;
};

const ATTEST_CHECKBOX_ID = "trade-eligibility-attest";

export const TradeEligibilityGate = ({ onReady }: Props) => {
  const [state, setState] = useState<GateState>({
    allowed: false,
    attested: false,
    country: null,
    loading: true,
    error: null,
  });
  const [checked, setChecked] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [attestError, setAttestError] = useState<string | null>(null);
  const readyCalledRef = useRef(false);

  const handleReady = () => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;
    onReady();
  };

  useEffect(() => {
    let cancelled = false;

    const loadEligibility = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch("/api/trade/eligibility", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to verify eligibility. Please try again.");
        }

        const data = (await response.json()) as EligibilityResponse;
        if (cancelled) return;

        setState({
          allowed: data.allowed,
          attested: data.attested,
          country: data.country,
          reason: data.reason,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify eligibility. Please try again.";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }
    };

    void loadEligibility();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.loading || state.error) return;
    if (!state.allowed || !state.attested) return;
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;
    onReady();
  }, [state.loading, state.error, state.allowed, state.attested, onReady]);

  const handleAttestChange = (event: ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
    setAttestError(null);
  };

  const handleContinue = async () => {
    if (!checked || isPosting) return;

    setIsPosting(true);
    setAttestError(null);

    try {
      const response = await fetch("/api/trade/attest", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        throw new Error(body?.error ?? "Attestation failed. Please try again.");
      }

      handleReady();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Attestation failed. Please try again.";
      setAttestError(message);
    } finally {
      setIsPosting(false);
    }
  };

  if (state.loading) {
    return (
      <div
        className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-600"
        aria-busy="true"
        aria-live="polite"
      >
        Checking eligibility…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Eligibility check failed</p>
        <p className="mt-2">{state.error}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (!state.allowed) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Trade is not available in your region</p>
        <p className="mt-2">
          Robinhood Stock Tokens are not offered where you are currently accessing Creative Finance
          from
          {state.country ? ` (${state.country})` : ""}.
        </p>
        {state.reason ? (
          <p className="mt-2 text-xs text-slate-500">Reason: {state.reason}</p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (state.attested) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Eligibility confirmation
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Confirm you may trade</h2>
          <p className="text-sm leading-6 text-slate-600">
            Before continuing, confirm you are eligible to access Robinhood Stock Tokens on this
            platform.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
          <input
            id={ATTEST_CHECKBOX_ID}
            type="checkbox"
            checked={checked}
            onChange={handleAttestChange}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            aria-describedby={attestError ? "trade-attest-error" : undefined}
          />
          <label htmlFor={ATTEST_CHECKBOX_ID} className="text-sm leading-6 text-slate-700">
            I confirm I am not a U.S. person and am not located in a restricted jurisdiction for
            Robinhood Stock Tokens.
          </label>
        </div>

        {attestError ? (
          <p id="trade-attest-error" className="text-center text-sm text-red-600" role="alert">
            {attestError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void handleContinue();
          }}
          disabled={!checked || isPosting}
          aria-busy={isPosting}
          className="inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isPosting ? "Continuing…" : "Continue"}
        </button>
      </div>
    </div>
  );
};
