import { useEffect } from "react";
import { Chain, Wallet } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";
import { useBalance } from "./useBalance";
import { useActivityFeed } from "./useActivityFeed";
import {
  formatRecipientLabel,
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

const getProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    return JSON.parse(processedTransactions)[transactionId] || false;
  }
  return false;
};

const setProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    const parsed = JSON.parse(processedTransactions);
    parsed[transactionId] = true;
    localStorage.setItem("processedTransactions", JSON.stringify(parsed));
  } else {
    localStorage.setItem("processedTransactions", JSON.stringify({ [transactionId]: true }));
  }
};

export function useProcessWithdrawal(userId?: string, wallet?: Wallet<Chain>) {
  const { refetch: refetchBalance } = useBalance();
  const { refetch: refetchActivityFeed } = useActivityFeed();

  useEffect(() => {
    if (!userId || !wallet) {
      return;
    }

    const processWithdrawal = async () => {
      try {
        console.log("Checking for pending withdrawal transactions...");
        const transactions = await getTransactions(userId);

        // Add proper null/undefined checks
        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
          console.log("No transactions found for user:", userId);
          return;
        }

        // Look for the most recent transaction that needs processing
        const pendingTransaction = transactions.find(
          (transaction) =>
            transaction?.status === "TRANSACTION_STATUS_STARTED" &&
            transaction?.transaction_id &&
            !getProccesedTransactions(transaction.transaction_id)
        );

        if (pendingTransaction) {
          console.log("Processing withdrawal transaction:", pendingTransaction.transaction_id);

          // Mark as processed to prevent duplicate processing
          setProccesedTransactions(pendingTransaction.transaction_id);

          try {
            const sendResult = await wallet.send(
              pendingTransaction.to_address,
              "usdc",
              pendingTransaction.sell_amount.value
            );

            const amount = pendingTransaction.sell_amount.value;
            showTxSuccessToast({
              title: "Withdrawal sent",
              description: `Sent $${amount} USDC to ${formatRecipientLabel(pendingTransaction.to_address)}`,
              txHash: sendResult?.hash,
              explorerLink: sendResult?.explorerLink,
            });

            await Promise.all([refetchBalance(), refetchActivityFeed()]);
          } catch (sendError) {
            const message = normalizeTxErrorMessage(sendError, "Withdrawal send failed");
            showTxErrorToast({
              title:
                message === "Transaction was cancelled"
                  ? "Transaction cancelled"
                  : "Withdrawal failed",
              description: message,
            });
            throw sendError;
          }
        } else {
          console.log("No pending withdrawal transactions found");
        }
      } catch (error) {
        console.error("Error processing withdrawal:", error);

        // Handle specific error cases more gracefully
        if (error instanceof Error) {
          if (error.message.includes("credentials") || error.message.includes("API keys")) {
            console.log("Coinbase API not configured - withdrawal processing disabled");
            return; // Silently return, don't throw
          } else if (error.message.includes("production") || error.message.includes("enabled")) {
            console.log("Withdrawal processing not available in current environment");
            return; // Silently return, don't throw
          } else if (error.message.includes("network") || error.message.includes("fetch")) {
            console.warn("Network error while processing withdrawal - will retry later");
            return; // Silently return, don't throw
          }
        }

        // For other unexpected errors, log but don't crash the app
        console.warn("Unexpected error in withdrawal processing:", error);
      }
    };

    // Run the withdrawal processing
    processWithdrawal();
  }, [userId, wallet, refetchBalance, refetchActivityFeed]);
}
