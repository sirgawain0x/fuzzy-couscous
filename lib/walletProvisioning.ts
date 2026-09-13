import { buildEmailRecovery, getWalletChain } from "@/lib/walletConfig";
import { isPasskeyCreationFailure, shouldSkipPasskey } from "@/lib/passkeySupport";

type WalletClient = {
  getWallet: (props: { chain: ReturnType<typeof getWalletChain> }) => Promise<unknown>;
  createWallet: (props: {
    chain: ReturnType<typeof getWalletChain>;
    recovery: ReturnType<typeof buildEmailRecovery>;
    signers?: [{ type: "passkey" }];
  }) => Promise<unknown>;
};

export const provisionCrossmintWallet = async (
  walletClient: WalletClient,
  email?: string
): Promise<unknown> => {
  const chain = getWalletChain();
  const recovery = buildEmailRecovery(email);

  const existingWallet = await walletClient.getWallet({ chain });
  if (existingWallet) return existingWallet;

  const skipPasskey = await shouldSkipPasskey();

  if (!skipPasskey) {
    try {
      return await walletClient.createWallet({
        chain,
        recovery,
        signers: [{ type: "passkey" }],
      });
    } catch (error) {
      if (!isPasskeyCreationFailure(error)) {
        throw error;
      }
    }
  }

  return walletClient.createWallet({
    chain,
    recovery,
  });
};
