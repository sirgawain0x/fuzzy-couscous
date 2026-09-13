const DEFAULT_UNLOCK_CLIENT_ID = "creative-bank";
const BASE_MAINNET_CHAIN_ID = 8453;
const DEFAULT_UNLOCK_ADDRESS = "0xd0b14797b9D08493392865647384974470202A78";
const DEFAULT_UNLOCK_PROVIDER_URL = "https://rpc.unlock-protocol.com/8453";

const configuredChainId = Number(process.env.NEXT_PUBLIC_UNLOCK_CHAIN_ID ?? BASE_MAINNET_CHAIN_ID);

const resolveChainLabel = (chainId: number) => {
  if (chainId === BASE_MAINNET_CHAIN_ID) {
    return "Base";
  }

  return `Chain ${chainId}`;
};

export const unlockClientId = process.env.NEXT_PUBLIC_UNLOCK_CLIENT_ID ?? DEFAULT_UNLOCK_CLIENT_ID;

export const unlockChainId = Number.isNaN(configuredChainId)
  ? BASE_MAINNET_CHAIN_ID
  : configuredChainId;

export const unlockChainLabel = resolveChainLabel(unlockChainId);

export const unlockAddress = process.env.NEXT_PUBLIC_UNLOCK_ADDRESS ?? DEFAULT_UNLOCK_ADDRESS;

export const unlockProviderUrl =
  process.env.NEXT_PUBLIC_UNLOCK_PROVIDER_URL ?? DEFAULT_UNLOCK_PROVIDER_URL;
