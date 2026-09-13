// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "@forge-std/Test.sol";
import {AaveV3Strategy} from "../contracts/strategies/AaveV3Strategy.sol";
import {CompoundV3Strategy} from "../contracts/strategies/CompoundV3Strategy.sol";
import {CurveStrategy} from "../contracts/strategies/CurveStrategy.sol";
import {SparkStrategy} from "../contracts/strategies/SparkStrategy.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ForkTests
 * @notice Fork tests using Base mainnet for realistic testing
 */
contract ForkTests is Test {
    ERC20 usdc;

    function setUp() public {
        // Fork Base mainnet at a specific block
        vm.createSelectFork(vm.rpcUrl("base"));
        usdc = ERC20(BaseAddresses.USDC);
    }

    function testAllStrategiesDeploy() public {
        // Test that all strategies can be deployed
        AaveV3Strategy aave = new AaveV3Strategy(
            BaseAddresses.USDC,
            "Test Aave Strategy"
        );
        assertTrue(address(aave) != address(0));
        assertEq(address(aave.aavePool()), BaseAddresses.AAVE_POOL);

        CompoundV3Strategy compound = new CompoundV3Strategy(
            BaseAddresses.USDC,
            "Test Compound Strategy"
        );
        assertTrue(address(compound) != address(0));
        assertEq(address(compound.comet()), BaseAddresses.COMPOUND_COMET);

        CurveStrategy curve = new CurveStrategy(
            BaseAddresses.USDC,
            "Test Curve Strategy"
        );
        assertTrue(address(curve) != address(0));
        assertEq(address(curve.curvePool()), BaseAddresses.CURVE_3POOL);

        SparkStrategy spark = new SparkStrategy(
            BaseAddresses.USDC,
            "Test Spark Strategy"
        );
        assertTrue(address(spark) != address(0));
        assertEq(address(spark.sparkPool()), BaseAddresses.SPARK_POOL);
    }

    // TODO: Add more fork tests:
    // - Test actual deposits to protocols
    // - Test withdrawals
    // - Test harvest operations
    // - Test with real balances
}
