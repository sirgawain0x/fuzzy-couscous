// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {AaveV3Strategy} from "../contracts/strategies/AaveV3Strategy.sol";
import {CompoundV3Strategy} from "../contracts/strategies/CompoundV3Strategy.sol";
import {CurveStrategy} from "../contracts/strategies/CurveStrategy.sol";
import {SparkStrategy} from "../contracts/strategies/SparkStrategy.sol";
import {BaseSepoliaAddresses} from "../contracts/config/BaseSepoliaAddresses.sol";

/**
 * @title DeployStrategiesTestnet
 * @notice Script to deploy Tokenized Strategies on Base Sepolia testnet
 * @dev Uses BaseSepoliaAddresses for testnet-specific addresses
 * Note: Some protocols may not be available on Base Sepolia
 */
contract DeployStrategiesTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address usdc = BaseSepoliaAddresses.USDC;
        
        console.log("Deploying strategies on Base Sepolia testnet...");
        console.log("USDC address:", usdc);

        // Deploy Aave V3 Strategy
        // Note: Aave V3 may not be deployed on Base Sepolia
        console.log("\nDeploying Aave V3 Strategy...");
        try this.deployAaveStrategy(usdc) returns (address aaveStrategy) {
            console.log("Aave V3 Strategy deployed at:", aaveStrategy);
        } catch {
            console.log("Aave V3 Strategy deployment failed (protocol may not be on testnet)");
        }

        // Deploy Compound V3 Strategy
        console.log("\nDeploying Compound V3 Strategy...");
        try this.deployCompoundStrategy(usdc) returns (address compoundStrategy) {
            console.log("Compound V3 Strategy deployed at:", compoundStrategy);
        } catch {
            console.log("Compound V3 Strategy deployment failed (protocol may not be on testnet)");
        }

        // Deploy Curve Strategy
        console.log("\nDeploying Curve Strategy...");
        try this.deployCurveStrategy(usdc) returns (address curveStrategy) {
            console.log("Curve Strategy deployed at:", curveStrategy);
        } catch {
            console.log("Curve Strategy deployment failed (protocol may not be on testnet)");
        }

        // Deploy Spark Strategy
        console.log("\nDeploying Spark Strategy...");
        try this.deploySparkStrategy(usdc) returns (address sparkStrategy) {
            console.log("Spark Strategy deployed at:", sparkStrategy);
        } catch {
            console.log("Spark Strategy deployment failed (protocol may not be on testnet)");
        }

        vm.stopBroadcast();
    }

    function deployAaveStrategy(address usdc) external returns (address) {
        AaveV3Strategy strategy = new AaveV3Strategy(
            usdc,
            "Creative Bank Aave V3 USDC Strategy (Testnet)"
        );
        return address(strategy);
    }

    function deployCompoundStrategy(address usdc) external returns (address) {
        CompoundV3Strategy strategy = new CompoundV3Strategy(
            usdc,
            "Creative Bank Compound V3 USDC Strategy (Testnet)"
        );
        return address(strategy);
    }

    function deployCurveStrategy(address usdc) external returns (address) {
        CurveStrategy strategy = new CurveStrategy(
            usdc,
            "Creative Bank Curve 3pool USDC Strategy (Testnet)"
        );
        return address(strategy);
    }

    function deploySparkStrategy(address usdc) external returns (address) {
        SparkStrategy strategy = new SparkStrategy(
            usdc,
            "Creative Bank Spark USDC Strategy (Testnet)"
        );
        return address(strategy);
    }
}
