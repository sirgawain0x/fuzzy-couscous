"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import type {
  PrivyEarnActionPublic,
  PrivyEarnPositionPublic,
  PrivyEarnVaultPublic,
} from "@/lib/privyEarnTypes";

const readError = async (response: Response, fallback: string): Promise<string> => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
};

export const usePrivyEarnVault = () => {
  const query = useQuery<PrivyEarnVaultPublic>({
    queryKey: ["privy-earn-vault"],
    queryFn: async () => {
      const response = await fetch("/api/earn/vault", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to load Privy Earn vault"));
      }
      return (await response.json()) as PrivyEarnVaultPublic;
    },
    staleTime: 30_000,
  });

  return {
    vault: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
};

export const usePrivyEarnPosition = (enabled: boolean) => {
  const { jwt } = useAuth();

  const query = useQuery<PrivyEarnPositionPublic>({
    queryKey: ["privy-earn-position", jwt],
    enabled: enabled && Boolean(jwt),
    queryFn: async () => {
      if (!jwt) throw new Error("Authentication required");
      const response = await fetch("/api/earn/position", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to load vault position"));
      }
      return (await response.json()) as PrivyEarnPositionPublic;
    },
    staleTime: 15_000,
  });

  return {
    position: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
};

const pollEarnAction = async (actionId: string, jwt: string): Promise<PrivyEarnActionPublic> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`/api/earn/actions/${actionId}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to check transaction status"));
    }
    const action = (await response.json()) as PrivyEarnActionPublic;
    if (action.status !== "pending") {
      return action;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Timed out waiting for the vault transaction to confirm");
};

type EarnMutationInput =
  | { mode: "deposit"; amount: string }
  | { mode: "withdraw"; amount: string; max?: boolean };

export const usePrivyEarnAction = () => {
  const { jwt } = useAuth();
  const queryClient = useQueryClient();

  const submit = useCallback(
    async (input: EarnMutationInput): Promise<PrivyEarnActionPublic> => {
      if (!jwt) {
        throw new Error("Sign in to continue");
      }

      const path = input.mode === "deposit" ? "/api/earn/deposit" : "/api/earn/withdraw";
      const body =
        input.mode === "withdraw" && input.max ? { max: true } : { amount: input.amount };

      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, input.mode === "deposit" ? "Deposit failed" : "Withdraw failed")
        );
      }

      const created = (await response.json()) as PrivyEarnActionPublic;
      const action = created.status === "pending" ? await pollEarnAction(created.id, jwt) : created;

      await queryClient.invalidateQueries({ queryKey: ["privy-earn-position"] });
      await queryClient.invalidateQueries({ queryKey: ["privy-earn-vault"] });
      await queryClient.invalidateQueries({ queryKey: ["balances"] });

      return action;
    },
    [jwt, queryClient]
  );

  return { submit };
};
