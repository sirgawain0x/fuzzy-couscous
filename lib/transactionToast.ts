import { toast } from "sonner";
import { mainnet } from "viem/chains";
import { appChain } from "@/lib/wagmiConfig";
import { isValidAddress } from "@/lib/utils";

const getExplorerLabel = (chainId: number): string =>
  chainId === mainnet.id ? "Etherscan" : "Basescan";

export const getTxExplorerUrl = (hash: string, chainId: number = appChain.id): string => {
  const baseUrl =
    chainId === mainnet.id
      ? (mainnet.blockExplorers?.default?.url ?? "https://etherscan.io")
      : (appChain.blockExplorers?.default?.url ?? "https://basescan.org");
  return `${baseUrl}/tx/${hash}`;
};

const resolveExplorerUrl = (
  txHash?: string | null,
  explorerLink?: string | null,
  chainId?: number
): string | null => {
  if (explorerLink) return explorerLink;
  if (txHash) return getTxExplorerUrl(txHash, chainId ?? appChain.id);
  return null;
};

const getExplorerAction = (
  url: string | null,
  chainId: number = appChain.id
): { label: string; onClick: () => void } | undefined => {
  if (!url) return undefined;
  const label = `View on ${getExplorerLabel(chainId)}`;
  return {
    label,
    onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
  };
};

export const formatRecipientLabel = (recipient: string): string => {
  if (isValidAddress(recipient)) {
    return `${recipient.slice(0, 6)}…${recipient.slice(-4)}`;
  }
  return recipient;
};

type TxSuccessToastOptions = {
  title: string;
  description?: string;
  txHash?: string | null;
  explorerLink?: string | null;
  chainId?: number;
};

export const showTxSuccessToast = ({
  title,
  description,
  txHash,
  explorerLink,
  chainId,
}: TxSuccessToastOptions): void => {
  const resolvedChainId = chainId ?? appChain.id;
  const explorerUrl = resolveExplorerUrl(txHash, explorerLink, resolvedChainId);
  const action = getExplorerAction(explorerUrl, resolvedChainId);

  toast.success(title, {
    description,
    ...(action ? { action } : {}),
  });
};

type TxErrorToastOptions = {
  title: string;
  description?: string;
};

export const showTxErrorToast = ({ title, description }: TxErrorToastOptions): void => {
  toast.error(title, { description });
};

export const extractTxHash = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.startsWith("0x")) return value;
  if (value && typeof value === "object" && "hash" in value) {
    const hash = (value as { hash: unknown }).hash;
    if (typeof hash === "string") return hash;
  }
  return undefined;
};

export const normalizeTxErrorMessage = (error: unknown, fallback: string): string => {
  let message = fallback;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    message = (error as { message: string }).message;
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("action_rejected")
  ) {
    return "Transaction was cancelled";
  }

  return message || fallback;
};
