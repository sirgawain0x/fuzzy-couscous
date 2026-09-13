import { useAuth } from "@/context/AuthContext";
import { useAppWallet } from "@/hooks/useAppWallet";
import { Modal } from "../common/Modal";
import { Details } from "../common/Details";
import { CopyWrapper } from "../common/CopyWrapper";
import { shortenAddress } from "@/utils/shortenAddress";
import { appChain } from "@/lib/wagmiConfig";

export function WalletDetails({ onClose, open }: { onClose: () => void; open: boolean }) {
  const { wallet } = useAppWallet();
  const { user } = useAuth();
  return (
    <Modal title="Wallet Details" open={open} onClose={onClose} showCloseButton>
      <Details
        values={[
          {
            label: "Address",
            value: (
              <CopyWrapper toCopy={wallet?.address} iconPosition="right">
                <span>{shortenAddress(wallet?.address || "")}</span>
              </CopyWrapper>
            ),
          },
          {
            label: "Chain",
            value: <span className="capitalize">{appChain.name}</span>,
          },
          {
            label: "Owner",
            value: user?.email || "",
          },
        ]}
      />
    </Modal>
  );
}
