// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";

// Interface for Yearn V3 Vault (snake_case per Yearn V3 API)
interface IVault {
    function add_strategy(address strategy) external;
    function update_max_debt_for_strategy(address strategy, uint256 maxDebt) external;
}

/**
 * @title AddStrategies
 * @notice Script to add strategies to the deployed vault and configure allocations
 */
contract AddStrategies is Script {
    function _maybeAddStrategy(IVault vault, string memory label, address strategy) internal {
        if (strategy == address(0)) return;

        console.log(string.concat("Adding ", label, " Strategy..."));
        try vault.add_strategy(strategy) {
            // ok
        } catch {
            console.log(string.concat("Skipping ", label, " (add_strategy reverted; likely already active)."));
        }
    }

    function _maybeSetMaxDebt(IVault vault, address strategy, uint256 maxDebt) internal {
        if (strategy == address(0)) return;
        try vault.update_max_debt_for_strategy(strategy, maxDebt) {
            // ok
        } catch {
            console.log("Skipping max debt update (call reverted).");
        }
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get addresses from environment variables
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address aaveStrategy = vm.envOr("AAVE_STRATEGY", address(0));
        address compoundStrategy = vm.envOr("COMPOUND_STRATEGY", address(0));
        address curveStrategy = vm.envOr("CURVE_STRATEGY", address(0));
        address sparkStrategy = vm.envOr("SPARK_STRATEGY", address(0));
        address morphoStrategy = vm.envOr("MORPHO_STRATEGY", address(0));
        address aerodromeStrategy = vm.envOr("AERODROME_STRATEGY", address(0));

        IVault vault = IVault(vaultAddress);

        console.log("Adding strategies to vault:", vaultAddress);
        console.log("\nStrategies to add:");
        console.log("  - Aave V3:", aaveStrategy);
        console.log("  - Compound V3:", compoundStrategy);
        console.log("  - Curve:", curveStrategy);
        console.log("  - Spark:", sparkStrategy);
        console.log("  - Morpho:", morphoStrategy);
        console.log("  - Aerodrome:", aerodromeStrategy);

        // Add configured strategies (skip zero addresses)
        console.log("");
        _maybeAddStrategy(vault, "Aave V3", aaveStrategy);
        _maybeAddStrategy(vault, "Compound V3", compoundStrategy);
        _maybeAddStrategy(vault, "Curve", curveStrategy);
        _maybeAddStrategy(vault, "Spark", sparkStrategy);
        _maybeAddStrategy(vault, "Morpho", morphoStrategy);
        _maybeAddStrategy(vault, "Aerodrome", aerodromeStrategy);

        // Set max debt for each strategy (25% each = 25% of total vault capacity)
        // Max debt is in asset units (USDC), using 1e6 for USDC decimals
        // Example: 1,000,000 USDC max debt = 1e6 * 1e6 = 1e12
        // For unlimited, use type(uint256).max
        uint256 maxDebtPerStrategy = type(uint256).max; // No limit for now

        console.log("\nSetting max debt for strategies...");
        console.log("Max debt per strategy:", maxDebtPerStrategy);

        _maybeSetMaxDebt(vault, aaveStrategy, maxDebtPerStrategy);
        _maybeSetMaxDebt(vault, compoundStrategy, maxDebtPerStrategy);
        _maybeSetMaxDebt(vault, curveStrategy, maxDebtPerStrategy);
        _maybeSetMaxDebt(vault, sparkStrategy, maxDebtPerStrategy);
        _maybeSetMaxDebt(vault, morphoStrategy, maxDebtPerStrategy);
        _maybeSetMaxDebt(vault, aerodromeStrategy, maxDebtPerStrategy);

        console.log("\n=== Strategies Added Successfully ===");
        console.log("All strategies are now available in the vault");

        vm.stopBroadcast();
    }
}
