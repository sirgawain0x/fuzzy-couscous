"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address, type PublicClient, parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";

import { YEARN_CASHFLOW_RPC_FROM_BLOCK, YEARN_CHAIN_ID } from "@/lib/config/yearn";

const GOLD_SKY_ENDPOINT =
  "https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/usdc-finance-yearn-v3/1.0.0/gn";

const ERC4626_DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
);
const ERC4626_WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed owner, address indexed receiver, uint256 assets, uint256 shares)"
);

/** Stay under typical provider eth_getLogs window limits (e.g. 8k blocks). */
const RPC_LOG_CHUNK_BLOCKS = 7999n;

type YearnVaultCashflowPoint = {
  blockNumber: bigint;
  // Cumulative net deposits (depositAssets - withdrawAssets) up to and including this block.
  netDepositsWei: bigint;
};

type GoldskyDeposit = {
  id: string;
  block_number: number | string;
  timestamp_: string | number;
  transactionHash_: string;
  contractId_: string;
  owner?: string | null;
  assets: string | number;
  shares: string | number;
};

type GoldskyWithdraw = {
  id: string;
  block_number: number | string;
  timestamp_: string | number;
  transactionHash_: string;
  contractId_: string;
  owner?: string | null;
  receiver?: string | null;
  assets: string | number;
  shares: string | number;
};

function getNetDepositsWeiAtBlock(points: YearnVaultCashflowPoint[], blockNumber: bigint): bigint {
  if (points.length === 0) return 0n;

  // Upper bound: last index where points[i].blockNumber <= blockNumber
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid]?.blockNumber <= blockNumber) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best === -1) return 0n;
  return points[best]?.netDepositsWei ?? 0n;
}

function toBigIntFromGoldskyScalar(value: string | number | null | undefined): bigint {
  if (value == null) return 0n;
  // Goldsky often returns large integers as strings.
  try {
    return typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    return 0n;
  }
}

function toNumberBlock(block: bigint | undefined): number | undefined {
  if (block == null) return undefined;
  // Base block numbers are far below JS safe integer limits, so this is safe.
  const n = Number(block);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function effectiveRpcFromBlock(fromBlockNum: number | undefined): bigint {
  if (fromBlockNum != null) return BigInt(fromBlockNum);
  return YEARN_CASHFLOW_RPC_FROM_BLOCK;
}

async function fetchGoldskyDeposits(params: {
  where: Record<string, unknown>;
  first: number;
  skip: number;
}): Promise<{ rows: GoldskyDeposit[]; graphqlErrors: boolean }> {
  const query = `
    query Deposits($where: Deposit_filter, $first: Int, $skip: Int) {
      deposits(first: $first, skip: $skip, where: $where, orderBy: block_number, orderDirection: asc) {
        id
        block_number
        timestamp_
        transactionHash_
        contractId_
        owner
        assets
        shares
      }
    }
  `;

  const res = await fetch(GOLD_SKY_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        where: params.where,
        first: params.first,
        skip: params.skip,
      },
    }),
  });

  const json = (await res.json()) as {
    data?: { deposits?: GoldskyDeposit[] };
    errors?: unknown;
  };
  const graphqlErrors = Boolean(json.errors) || !res.ok;
  if (!json.data?.deposits) return { rows: [], graphqlErrors };
  return { rows: json.data.deposits, graphqlErrors };
}

async function fetchGoldskyWithdraws(params: {
  where: Record<string, unknown>;
  first: number;
  skip: number;
}): Promise<{ rows: GoldskyWithdraw[]; graphqlErrors: boolean }> {
  const query = `
    query Withdraws($where: Withdraw_filter, $first: Int, $skip: Int) {
      withdraws(first: $first, skip: $skip, where: $where, orderBy: block_number, orderDirection: asc) {
        id
        block_number
        timestamp_
        transactionHash_
        contractId_
        owner
        receiver
        assets
        shares
      }
    }
  `;

  const res = await fetch(GOLD_SKY_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        where: params.where,
        first: params.first,
        skip: params.skip,
      },
    }),
  });

  const json = (await res.json()) as {
    data?: { withdraws?: GoldskyWithdraw[] };
    errors?: unknown;
  };
  const graphqlErrors = Boolean(json.errors) || !res.ok;
  if (!json.data?.withdraws) return { rows: [], graphqlErrors };
  return { rows: json.data.withdraws, graphqlErrors };
}

async function fetchAllGoldskyCashflows(params: {
  vaultAddress: Address;
  userAddress: Address;
  fromBlock: number | undefined;
  toBlock: number | undefined;
}): Promise<Array<{ blockNumber: bigint; deltaWei: bigint; sortKey: string }>> {
  const PAGE_SIZE = 1000;
  const fromBlock = params.fromBlock;
  const toBlock = params.toBlock;

  const baseDepositWhere: Record<string, unknown> = {
    contractId_: params.vaultAddress.toLowerCase(),
    owner: params.userAddress.toLowerCase(),
  };
  if (fromBlock != null) baseDepositWhere.block_number_gte = fromBlock;
  if (toBlock != null) baseDepositWhere.block_number_lte = toBlock;

  const baseWithdrawWhere: Record<string, unknown> = {
    contractId_: params.vaultAddress.toLowerCase(),
    owner: params.userAddress.toLowerCase(),
  };
  if (fromBlock != null) baseWithdrawWhere.block_number_gte = fromBlock;
  if (toBlock != null) baseWithdrawWhere.block_number_lte = toBlock;

  const deposits: GoldskyDeposit[] = [];
  const withdrawals: GoldskyWithdraw[] = [];
  // Deposits
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const { rows: page } = await fetchGoldskyDeposits({
      where: baseDepositWhere,
      first: PAGE_SIZE,
      skip,
    });
    if (!page.length) break;
    deposits.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // Withdraws
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const { rows: page } = await fetchGoldskyWithdraws({
      where: baseWithdrawWhere,
      first: PAGE_SIZE,
      skip,
    });
    if (!page.length) break;
    withdrawals.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const deltas: Array<{ blockNumber: bigint; deltaWei: bigint; sortKey: string }> = [];

  for (const d of deposits) {
    const blockNumber = BigInt(String(d.block_number));
    const assetsWei = toBigIntFromGoldskyScalar(d.assets);
    deltas.push({
      blockNumber,
      deltaWei: assetsWei,
      sortKey: `${d.transactionHash_}-${d.id}`,
    });
  }

  for (const w of withdrawals) {
    const blockNumber = BigInt(String(w.block_number));
    const assetsWei = toBigIntFromGoldskyScalar(w.assets);
    deltas.push({
      blockNumber,
      deltaWei: -assetsWei,
      sortKey: `${w.transactionHash_}-${w.id}`,
    });
  }

  // Sort by blockNumber asc, then stable tie-breaker.
  deltas.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
    if (a.sortKey === b.sortKey) return 0;
    return a.sortKey < b.sortKey ? -1 : 1;
  });

  return deltas;
}

async function fetchCashflowsFromRpc(params: {
  publicClient: PublicClient;
  vaultAddress: Address;
  userAddress: Address;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<Array<{ blockNumber: bigint; deltaWei: bigint; sortKey: string }>> {
  const { publicClient, vaultAddress, userAddress, fromBlock, toBlock } = params;
  const deltas: Array<{ blockNumber: bigint; deltaWei: bigint; sortKey: string }> = [];

  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkEnd =
      cursor + RPC_LOG_CHUNK_BLOCKS > toBlock ? toBlock : cursor + RPC_LOG_CHUNK_BLOCKS;

    const [depositLogs, withdrawLogs] = await Promise.all([
      publicClient.getLogs({
        address: vaultAddress,
        event: ERC4626_DEPOSIT_EVENT,
        args: { owner: userAddress },
        fromBlock: cursor,
        toBlock: chunkEnd,
      }),
      publicClient.getLogs({
        address: vaultAddress,
        event: ERC4626_WITHDRAW_EVENT,
        args: { owner: userAddress },
        fromBlock: cursor,
        toBlock: chunkEnd,
      }),
    ]);

    for (const log of depositLogs) {
      const assets = log.args?.assets;
      if (assets == null) continue;
      deltas.push({
        blockNumber: log.blockNumber,
        deltaWei: assets,
        sortKey: `${log.transactionHash}-${log.logIndex}`,
      });
    }

    for (const log of withdrawLogs) {
      const assets = log.args?.assets;
      if (assets == null) continue;
      deltas.push({
        blockNumber: log.blockNumber,
        deltaWei: -assets,
        sortKey: `${log.transactionHash}-${log.logIndex}`,
      });
    }

    cursor = chunkEnd + 1n;
  }

  deltas.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
    if (a.sortKey === b.sortKey) return 0;
    return a.sortKey < b.sortKey ? -1 : 1;
  });

  return deltas;
}

function deltasToPoints(
  deltas: Array<{ blockNumber: bigint; deltaWei: bigint }>
): YearnVaultCashflowPoint[] {
  let cumulative = 0n;
  const computedPoints: YearnVaultCashflowPoint[] = [];
  for (const d of deltas) {
    cumulative += d.deltaWei;
    computedPoints.push({
      blockNumber: d.blockNumber,
      netDepositsWei: cumulative,
    });
  }
  return computedPoints;
}

export function useYearnVaultCashflows(
  vaultAddress: Address | undefined,
  userAddress: Address | undefined,
  fromBlock: bigint | undefined
) {
  const publicClient = usePublicClient({ chainId: YEARN_CHAIN_ID });

  const [points, setPoints] = useState<YearnVaultCashflowPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastToBlock, setLastToBlock] = useState<bigint | undefined>(undefined);

  const fromBlockNum = useMemo(() => toNumberBlock(fromBlock), [fromBlock]);

  const fetchAndBuild = useCallback(
    async (toBlock?: bigint) => {
      if (!vaultAddress || !userAddress) return;
      if (!publicClient) return;

      setIsLoading(true);
      setError(null);

      try {
        const resolvedToBlock = toBlock ?? (await publicClient.getBlockNumber());
        const toBlockNum = toNumberBlock(resolvedToBlock);

        const goldskyDeltas = await fetchAllGoldskyCashflows({
          vaultAddress,
          userAddress,
          fromBlock: fromBlockNum,
          toBlock: toBlockNum,
        });

        let finalDeltas = goldskyDeltas;

        if (goldskyDeltas.length === 0) {
          const rpcFrom = effectiveRpcFromBlock(fromBlockNum);
          const rpcDeltas = await fetchCashflowsFromRpc({
            publicClient,
            vaultAddress,
            userAddress,
            fromBlock: rpcFrom,
            toBlock: resolvedToBlock,
          });
          finalDeltas = rpcDeltas;
        }

        const computedPoints = deltasToPoints(finalDeltas);
        setPoints(computedPoints);
        setLastToBlock(resolvedToBlock);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Failed to fetch Yearn cashflows");
        setError(err);
        setPoints([]);
      } finally {
        setIsLoading(false);
      }
    },
    [vaultAddress, userAddress, publicClient, fromBlockNum]
  );

  useEffect(() => {
    // Reset whenever inputs change.
    setPoints([]);
    setLastToBlock(undefined);
    if (!vaultAddress || !userAddress) return;
    void fetchAndBuild();
  }, [vaultAddress, userAddress, fromBlockNum, fetchAndBuild]);

  const refetch = useCallback(
    async (toBlock?: bigint) => {
      await fetchAndBuild(toBlock);
    },
    [fetchAndBuild]
  );

  const getNetDepositsWeiAtBlockCached = useCallback(
    (blockNumber: bigint) => getNetDepositsWeiAtBlock(points, blockNumber),
    [points]
  );

  return {
    points,
    isLoading,
    error,
    refetch,
    getNetDepositsWeiAtBlock: getNetDepositsWeiAtBlockCached,
    lastToBlock,
  };
}
