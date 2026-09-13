// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAaveV3Pool, IAaveV3AToken} from "../interfaces/IAaveV3Pool.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

/**
 * @title SparkStrategy
 * @notice Yearn V3 Tokenized Strategy for Spark Protocol on Base
 * @dev Supplies USDC to Spark Protocol (Aave fork) and earns yield through lending
 */
contract SparkStrategy is BaseStrategy {
    // Spark Pool contract (same interface as Aave V3)
    IAaveV3Pool public constant sparkPool = IAaveV3Pool(BaseAddresses.SPARK_POOL);

    // USDC token address
    address public constant usdc = BaseAddresses.USDC;

    // Referral code for Spark (0 = no referral)
    uint16 public constant REFERRAL_CODE = 0;

    /**
     * @notice Initialize the Spark strategy
     * @param _asset The underlying asset (USDC)
     * @param _name Strategy name (e.g., "Spark USDC")
     */
    constructor(
        address _asset,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == usdc, "Strategy only supports USDC");
    }

    /**
     * @notice Deploy funds to Spark Protocol by supplying USDC
     * @param _amount Amount of USDC to supply to Spark
     */
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Approve Spark Pool to spend USDC
        asset.approve(address(sparkPool), _amount);

        // Supply USDC to Spark Pool
        sparkPool.supply(usdc, _amount, address(this), REFERRAL_CODE);
    }

    /**
     * @notice Free funds from Spark Protocol by withdrawing USDC
     * @param _amount Amount of USDC to withdraw from Spark
     */
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Withdraw USDC from Spark Pool
        sparkPool.withdraw(usdc, _amount, address(this));
    }

    /**
     * @notice Harvest rewards and report total assets
     * @return _totalAssets Total assets managed by the strategy
     */
    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        // Get idle USDC in the strategy
        uint256 idle = asset.balanceOf(address(this));

        // Deploy any idle funds
        if (idle > 0) {
            _deployFunds(idle);
        }

        // Get sToken address from Spark Pool reserve data (same interface as Aave)
        // sToken address is the 9th element (index 8) in the getReserveData return tuple
        (
            , // configuration
            , // liquidityIndex
            , // currentLiquidityRate
            , // variableBorrowIndex
            , // currentVariableBorrowRate
            , // currentStableBorrowRate
            , // lastUpdateTimestamp
            , // id
            address sTokenAddr, // aTokenAddress (position 9)
            , // stableDebtTokenAddress
            , // variableDebtTokenAddress
            , // interestRateStrategyAddress
            , // accruedToTreasury
            , // unbacked
             // isolationModeTotalDebt
        ) = sparkPool.getReserveData(usdc);

        // Get sToken balance (represents our position in Spark including accrued interest)
        // sTokens maintain 1:1 ratio with underlying, so balanceOf directly gives USDC equivalent
        uint256 sTokenBalance = 0;
        if (sTokenAddr != address(0)) {
            sTokenBalance = IAaveV3AToken(sTokenAddr).balanceOf(address(this));
        }

        // Total assets = sToken balance (includes deployed funds + accrued interest) + remaining idle
        _totalAssets = sTokenBalance + asset.balanceOf(address(this));
        
        // TODO: In a full implementation, you would also:
        // 1. Claim any pending rewards from Spark's rewards controller
        // 2. Swap rewards to USDC (if needed)
        // 3. Re-invest the rewards
        // 4. Add reward value to totalAssets
    }
}
