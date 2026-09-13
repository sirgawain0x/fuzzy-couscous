import { useEffect, useState } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";

export function WithdrawalStatus() {
  const { wallet } = useWallet();
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = wallet?.address;

  useEffect(() => {
    if (!walletAddress) return;

    const checkPendingTransactions = async () => {
      setIsChecking(true);
      setError(null);
      try {
        const transactions = await getTransactions(walletAddress);
        const pending = transactions.find((tx: any) => tx.status === "TRANSACTION_STATUS_STARTED");
        setPendingTransaction(pending);
      } catch (error) {
        console.error("Error checking pending transactions:", error);

        // Handle specific error cases gracefully
        if (error instanceof Error) {
          if (error.message.includes("credentials") || error.message.includes("API keys")) {
            console.log("Coinbase API not configured - withdrawal status disabled");
            return; // Don't show error to user
          } else if (error.message.includes("production") || error.message.includes("enabled")) {
            console.log("Withdrawal status not available in current environment");
            return; // Don't show error to user
          } else if (error.message.includes("network") || error.message.includes("fetch")) {
            setError("Network error - unable to check withdrawal status");
          } else {
            setError("Unable to check withdrawal status");
          }
        } else {
          setError("Failed to check withdrawal status");
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkPendingTransactions();
  }, [walletAddress]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-gray-500">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        Checking withdrawal status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-red-500">
        Error: {error}
      </div>
    );
  }

  if (pendingTransaction) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-blue-600">
        Pending withdrawal: {pendingTransaction.id}
      </div>
    );
  }

  return null;
}
