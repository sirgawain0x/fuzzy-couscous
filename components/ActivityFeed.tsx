import React from "react";
import { DepositButton } from "./common/DepositButton";
import Image from "next/image";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { Container } from "./common/Container";
import { useWallet } from "@crossmint/client-sdk-react-ui";

interface ActivityFeedProps {
  onDepositClick: () => void;
}

export function ActivityFeed({ onDepositClick }: ActivityFeedProps) {
  const { data, isLoading } = useActivityFeed();
  const { wallet } = useWallet();
  return (
    <Container className="flex max-h-[70vh] min-h-[280px] w-full max-w-5xl flex-grow flex-col overflow-hidden sm:max-h-[600px] sm:min-h-[350px]">
      <div className="mb-2 flex-shrink-0 text-base text-slate-600">Last Activity</div>
      <div
        className={`flex w-full flex-1 flex-col items-center overflow-hidden ${isLoading || !data?.events?.length ? "justify-center" : "justify-start"}`}
      >
        {!isLoading && !data?.events?.length && (
          <>
            <div className="mb-2 text-center text-base font-semibold text-slate-900">
              Your activity feed
            </div>
            <div className="mb-7 max-w-xl text-center text-slate-600">
              When you add, send and receive money it shows up here.
              <br />
              Get started with making a deposit to your account
            </div>
            <div>
              <DepositButton onClick={onDepositClick} />
            </div>
          </>
        )}
        <div
          className={`flex w-full flex-1 items-center overflow-hidden ${isLoading || !data?.events?.length ? "justify-center" : "justify-start"}`}
        >
          {isLoading && (
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          )}
          {!isLoading && data?.events?.length && data?.events?.length > 0 ? (
            <ul
              className="max-h-48 w-full overflow-y-auto pt-2 pr-2 pb-2 sm:max-h-56 md:max-h-72"
              aria-label="Last activity transaction history"
            >
              {data?.events.map((event) => {
                const isOutgoing =
                  event.from_address.toLowerCase() === wallet?.address.toLowerCase();
                const counterparty = isOutgoing ? event.to_address : event.from_address;
                return (
                  <li key={event.transaction_hash} className="flex items-center gap-4 py-3 sm:py-4">
                    <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-slate-50">
                      {isOutgoing ? (
                        <Image src="/arrow-up-right-icon.svg" alt="Sent" width={24} height={24} />
                      ) : (
                        <Image src="/plus-icon-black.svg" alt="Received" width={24} height={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-medium text-slate-900">
                        {counterparty.slice(0, 6)}...{counterparty.slice(-4)}
                      </div>
                      <div className="text-sm text-slate-600">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-base font-semibold ${isOutgoing ? "text-slate-700" : "text-emerald-800"}`}
                      >
                        {isOutgoing ? "-" : "+"} {Number(event.amount).toFixed(2)}
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        {event.token_symbol ? event.token_symbol : "USDC"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
