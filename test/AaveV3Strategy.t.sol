// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "@forge-std/Test.sol";
import {AaveV3Strategy} from "../contracts/strategies/AaveV3Strategy.sol";
import {BaseAddresses} from "../contracts/config/BaseAddresses.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AaveV3StrategyTest is Test {
    AaveV3Strategy strategy;
    ERC20 usdc;

    function setUp() public {
        // Fork Base mainnet for testing
        vm.createSelectFork(vm.rpcUrl("base"));

        usdc = ERC20(BaseAddresses.USDC);
        strategy = new AaveV3Strategy(
            BaseAddresses.USDC,
            "Test Aave V3 Strategy"
        );
    }

    function testDeploy() public {
        // Check that strategy was deployed
        assertTrue(address(strategy) != address(0));
        assertEq(address(strategy.aavePool()), BaseAddresses.AAVE_POOL);
        assertEq(strategy.usdc(), BaseAddresses.USDC);
        // Asset is available via ERC-4626 interface
        // Can be tested with: assertEq(strategy.asset(), address(usdc));
    }

    // TODO: Add more comprehensive tests:
    // - test _deployFunds()
    // - test _freeFunds()
    // - test _harvestAndReport()
    // - test deposit/withdraw flows
    // - test error cases
}
