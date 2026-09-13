// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {AaveV3Strategy} from "../contracts/strategies/AaveV3Strategy.sol";
import {CompoundV3Strategy} from "../contracts/strategies/CompoundV3Strategy.sol";
import {CurveStrategy} from "../contracts/strategies/CurveStrategy.sol";
import {SparkStrategy} from "../contracts/strategies/SparkStrategy.sol";
import {MorphoV3Strategy} from "../contracts/strategies/MorphoV3Strategy.sol";
import {AerodromeBeefyStrategy} from "../contracts/strategies/AerodromeBeefyStrategy.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";

/**
 * @title DeployStrategies
 * @notice Script to deploy all 6 Tokenized Strategies on Base
 */
contract DeployStrategies is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address usdc = BaseAddresses.USDC;

        // Deploy Aave V3 Strategy
        AaveV3Strategy aaveStrategy = new AaveV3Strategy(
            usdc,
            "Creative Bank Aave V3 USDC Strategy"
        );
        console.log("Aave V3 Strategy deployed at:", address(aaveStrategy));

        // Deploy Compound V3 Strategy
        CompoundV3Strategy compoundStrategy = new CompoundV3Strategy(
            usdc,
            "Creative Bank Compound V3 USDC Strategy"
        );
        console.log("Compound V3 Strategy deployed at:", address(compoundStrategy));

        // Deploy Curve Strategy
        CurveStrategy curveStrategy = new CurveStrategy(
            usdc,
            "Creative Bank Curve 3pool USDC Strategy"
        );
        console.log("Curve Strategy deployed at:", address(curveStrategy));

        // Deploy Spark Strategy
        SparkStrategy sparkStrategy = new SparkStrategy(
            usdc,
            "Creative Bank Spark USDC Strategy"
        );
        console.log("Spark Strategy deployed at:", address(sparkStrategy));

        // Deploy Morpho Strategy (MetaMorpho ERC-4626 wrapper)
        MorphoV3Strategy morphoStrategy = new MorphoV3Strategy(
            usdc,
            BaseAddresses.MORPHO_META_MORPHO_USDC_VAULT,
            "Creative Bank Morpho MetaMorpho USDC Strategy"
        );
        console.log("Morpho Strategy deployed at:", address(morphoStrategy));

        // Deploy Aerodrome Strategy (Beefy auto-compounding vault wrapper)
        AerodromeBeefyStrategy aerodromeStrategy = new AerodromeBeefyStrategy(
            usdc,
            BaseAddresses.AERODROME_BEEFY_VAULT,
            "Creative Bank Aerodrome Beefy USDC Strategy"
        );
        console.log("Aerodrome Strategy deployed at:", address(aerodromeStrategy));

        vm.stopBroadcast();

        // Output addresses for frontend integration
        console.log("\n=== Strategy Deployment Summary ===");
        console.log("Aave V3 Strategy:", address(aaveStrategy));
        console.log("Compound V3 Strategy:", address(compoundStrategy));
        console.log("Curve Strategy:", address(curveStrategy));
        console.log("Spark Strategy:", address(sparkStrategy));
        console.log("Morpho Strategy:", address(morphoStrategy));
        console.log("Aerodrome Strategy:", address(aerodromeStrategy));
    }
}
