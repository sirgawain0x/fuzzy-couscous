// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title BaseSepoliaAddresses
 * @notice Centralized configuration for Base Sepolia testnet protocol addresses
 */
library BaseSepoliaAddresses {
    // USDC on Base Sepolia
    address public constant USDC = 0x29684075a3C86ea11D9964BcAf0F956e801396bD;

    // Note: Many protocols may not be deployed on Base Sepolia testnet
    // These addresses may need to be updated or strategies may need to be skipped
    // For now, using placeholder addresses - verify these exist on Base Sepolia
    
    // Aave V3 on Base Sepolia (verify if deployed)
    address public constant AAVE_POOL = 0x0000000000000000000000000000000000000000; // TODO: Verify
    address public constant AAVE_POOL_ADDRESSES_PROVIDER = 0x0000000000000000000000000000000000000000; // TODO: Verify
    address public constant AAVE_REWARDS_CONTROLLER = 0x0000000000000000000000000000000000000000; // TODO: Verify

    // Spark Protocol on Base Sepolia (verify if deployed)
    address public constant SPARK_POOL = 0x0000000000000000000000000000000000000000; // TODO: Verify
    address public constant SPARK_POOL_ADDRESSES_PROVIDER = 0x0000000000000000000000000000000000000000; // TODO: Verify

    // Compound V3 on Base Sepolia (verify if deployed)
    address public constant COMPOUND_COMET = 0x0000000000000000000000000000000000000000; // TODO: Verify

    // Curve on Base Sepolia (verify if deployed)
    address public constant CURVE_3POOL = 0x0000000000000000000000000000000000000000; // TODO: Verify
    address public constant CURVE_3CRV_TOKEN = 0x0000000000000000000000000000000000000000; // TODO: Verify

    // Yearn V3 Infrastructure (should be same across networks)
    address public constant ROLE_MANAGER_FACTORY = 0xca12459a931643BF28388c67639b3F352fe9e5Ce;
    address public constant PROTOCOL_ADDRESS_PROVIDER = 0x775F09d6f3c8D2182DFA8bce8628acf51105653c;
    address public constant TOKENIZED_STRATEGY = 0xD377919FA87120584B21279a491F82D5265A139c; // Version 3.0.4
}
