// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";

// Minimal Yearn V3 Vault interface for deposit limit module (snake_case)
interface IVaultDepositLimit {
    function set_deposit_limit_module(address deposit_limit_module) external;
    function set_deposit_limit_module(address deposit_limit_module, bool override_existing) external;
}

/**
 * @title WireYearnVaultBouncer
 * @notice Sets the Creative Bank Bouncer as the vault's deposit_limit_module so only members can deposit.
 * @dev Requires DEPOSIT_LIMIT_MANAGER (or vault owner). Use override if vault already has a module/limit.
 *
 * Usage:
 *   forge script script/WireYearnVaultBouncer.s.sol --rpc-url base --broadcast
 *
 * Env: VAULT_ADDRESS, BOUNCER_ADDRESS, PRIVATE_KEY (e.g. from .env)
 */
contract WireYearnVaultBouncer is Script {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address bouncerAddress = vm.envAddress("BOUNCER_ADDRESS");

        console.log("Vault:", vaultAddress);
        console.log("Bouncer (deposit_limit_module):", bouncerAddress);

        IVaultDepositLimit vault = IVaultDepositLimit(vaultAddress);
        // Use override=true in case vault already has a deposit limit or module set
        vault.set_deposit_limit_module(bouncerAddress, true);

        console.log("Done. Vault deposit_limit_module set to bouncer.");

        vm.stopBroadcast();
    }
}
