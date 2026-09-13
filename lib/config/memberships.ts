import { Address } from "viem";

export type MembershipTier = "Creative Brand" | "Creative Investor" | "Creative Creator";

export type MembershipLock = {
  tier: MembershipTier;
  address: Address;
  priority: number;
};

export const MEMBERSHIP_LOCKS: MembershipLock[] = [
  {
    tier: "Creative Brand",
    address: "0x9c3744c96200a52d05a630d4aec0db707d7509be",
    priority: 3,
  },
  {
    tier: "Creative Investor",
    address: "0x13b818daf7016b302383737ba60c3a39fef231cf",
    priority: 2,
  },
  {
    tier: "Creative Creator",
    address: "0xf7c4cd399395d80f9d61fde833849106775269c6",
    priority: 1,
  },
];

// Tier priority for access control — higher number = more access
export const TIER_PRIORITY: Record<MembershipTier | "None", number> = {
  None: 0,
  "Creative Creator": 1,
  "Creative Investor": 2,
  "Creative Brand": 3,
};

// Tier pricing for display
export const TIER_PRICING: Record<
  MembershipTier,
  { price: string; duration: string; features: string[] }
> = {
  "Creative Creator": {
    price: "$30",
    duration: "3 months",
    features: [
      "10% performance fee floor (save 50%)",
      "Premium yield strategies",
      "Priority transaction processing",
    ],
  },
  "Creative Investor": {
    price: "$100",
    duration: "1 month",
    features: ["All Creative features", "Higher deposit limits", "Advanced analytics"],
  },
  "Creative Brand": {
    price: "$1,000",
    duration: "1 month",
    features: [
      "All Investor features",
      "Vault Factory access",
      "Custom Fee Receiver address",
      "White-label treasury tools",
    ],
  },
};

// Fee infrastructure addresses (Base Mainnet)
export const CREATIVE_TREASURY_ADDRESS: Address = "0xf46F1BA19A9280F752a451d0973b047D81c63D70";

export const YEARN_ACCOUNTANT_ADDRESS: Address = "0x1f399808fE52d0E960CAB84b6b54d5707ab27c8a";

// Tiers that can set a custom Fee Receiver Address
export const FEE_RECEIVER_TIERS: MembershipTier[] = ["Creative Brand", "Creative Creator"];

export const MEMBERSHIP_CHECKSUM = MEMBERSHIP_LOCKS.reduce<Record<Address, MembershipTier>>(
  (accumulator, lock) => {
    accumulator[lock.address] = lock.tier;
    return accumulator;
  },
  {}
);
