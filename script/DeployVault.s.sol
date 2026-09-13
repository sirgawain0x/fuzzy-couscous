// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "@forge-std/Script.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";

// Interface for Role Manager Factory
interface IRoleManagerFactory {
    function newProject(
        string memory projectName,
        address governance,
        address management
    ) external returns (address roleManager);
}

// Interface for Role Manager
interface IRoleManager {
    function newVault(
        address asset,
        uint256 category,
        string memory vaultName,
        string memory vaultSymbol
    ) external returns (address vault);
}

/**
 * @title DeployVault
 * @notice Script to deploy Yearn V3 Allocator Vault using RoleManagerFactory
 */
contract DeployVault is Script {
    // Role Manager Factory address (same across all chains)
    address constant ROLE_MANAGER_FACTORY = BaseAddresses.ROLE_MANAGER_FACTORY;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get addresses from environment or use deployer as default
        address deployer = vm.addr(deployerPrivateKey);
        address governance = vm.envOr("GOVERNANCE_ADDRESS", deployer);
        address management = vm.envOr("MANAGEMENT_ADDRESS", address(0));

        require(management != address(0), "Set MANAGEMENT_ADDRESS");
        require(governance != management, "Governance and management must be different addresses");

        IRoleManagerFactory factory = IRoleManagerFactory(ROLE_MANAGER_FACTORY);

        string memory projectName = vm.envOr("PROJECT_NAME", string("Creative Bank"));
        string memory vaultName = vm.envOr("VAULT_NAME", string("Creative Bank Multi-Strategy USDC"));
        string memory vaultSymbol = vm.envOr("VAULT_SYMBOL", string("cbUSDC"));
        uint256 category = vm.envOr("VAULT_CATEGORY", uint256(1));

        console.log("Deploying Role Manager...");
        console.log("Project Name:", projectName);
        console.log("Governance:", governance);
        console.log("Management:", management);

        // Deploy new Role Manager (distinct from existing "Creative Bank" / "Creative Finance")
        address roleManager = factory.newProject(
            projectName,
            governance,
            management
        );

        console.log("Role Manager deployed at:", roleManager);

        // Deploy the Allocator Vault
        IRoleManager rm = IRoleManager(roleManager);
        address asset = BaseAddresses.USDC;
        console.log("\nDeploying Allocator Vault...");
        console.log("Asset (USDC):", asset);
        console.log("Category:", category);

        address vault = rm.newVault(
            asset,
            category,
            vaultName,
            vaultSymbol
        );

        console.log("\n=== Vault Deployment Complete ===");
        console.log("Vault Address:", vault);
        console.log("Role Manager:", roleManager);
        console.log("Asset:", asset);

        vm.stopBroadcast();
    }
}
