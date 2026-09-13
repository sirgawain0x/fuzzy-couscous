// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {CreativeBankBouncer} from "../contracts/CreativeBankBouncer.sol";

/**
 * @title DeployCreativeBankBouncer
 * @notice Deploys the Creative Bank Bouncer v2 (Yearn V3 deposit limit module) on Base.
 *         v2 adds on-chain fee floor enforcement via the Yearn V3 Accountant.
 *
 * @dev Membership NFT addresses (Unlock locks on Base):
 *      - Creative Brand:    0x9c3744c96200A52D05a630D4AEC0db707D7509Be
 *      - Creative Investor: 0x13b818dAf7016B302383737bA60c3A39FeF231cF
 *      - Creative Creator:  0xf7c4cd399395D80f9d61FDe833849106775269c6
 *
 *      Yearn V3 Accountant on Base:
 *      - 0x928a31A7727e53CBE9f99fAb39eFb705c933093e
 *
 * Run:
 *   forge script script/DeployCreativeBankBouncer.s.sol --rpc-url base --broadcast --env-file contracts/.env
 *
 * After deployment:
 * 1. Set NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS in your app .env
 * 2. On the Yearn vault, call set_deposit_limit_module(bouncerAddress) (vault owner only)
 *
 * Verify on Basescan:
 *   forge verify-contract <BOUNCER_ADDRESS> CreativeBankBouncer --chain base \
 *     --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
 *       0x9c3744c96200A52D05a630D4AEC0db707D7509Be \
 *       0x13b818dAf7016B302383737bA60c3A39FeF231cF \
 *       0xf7c4cd399395D80f9d61FDe833849106775269c6 \
 *       0x928a31A7727e53CBE9f99fAb39eFb705c933093e)
 */
contract DeployCreativeBankBouncer is Script {
    // Unlock Protocol membership locks on Base Mainnet
    address constant CREATIVE_BRAND = 0x9c3744c96200A52D05a630D4AEC0db707D7509Be;
    address constant CREATIVE_INVESTOR = 0x13b818dAf7016B302383737bA60c3A39FeF231cF;
    address constant CREATIVE_CREATOR = 0xf7c4cd399395D80f9d61FDe833849106775269c6;

    // Yearn V3 Accountant on Base (from lib/config/kalani.ts)
    address constant ACCOUNTANT = 0x928a31A7727e53CBE9f99fAb39eFb705c933093e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        CreativeBankBouncer bouncer = new CreativeBankBouncer(
            CREATIVE_BRAND,
            CREATIVE_INVESTOR,
            CREATIVE_CREATOR,
            ACCOUNTANT
        );

        console.log("CreativeBankBouncer v2 deployed at:", address(bouncer));
        console.log("Fee floor enforcement: 10%% member / 20%% non-member");
        console.log("Accountant:", ACCOUNTANT);
        console.log("");
        console.log("Next steps:");
        console.log("1. Set vault deposit_limit_module to this address (vault owner only)");
        console.log("2. Set NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS=%s", address(bouncer));

        vm.stopBroadcast();
    }
}
