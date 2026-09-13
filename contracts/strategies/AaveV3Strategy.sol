// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAaveV3Pool, IAaveV3AToken} from "../interfaces/IAaveV3Pool.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

/**
 * @title AaveV3Strategy
 * @notice Yearn V3 Tokenized Strategy for Aave V3 on Base
 * @dev Supplies USDC to Aave V3 and earns yield through lending
 */
contract AaveV3Strategy is BaseStrategy {
    // Aave V3 Pool contract
    IAaveV3Pool public constant aavePool = IAaveV3Pool(BaseAddresses.AAVE_POOL);

    // USDC token address
    address public constant usdc = BaseAddresses.USDC;

    // Referral code for Aave (0 = no referral)
    uint16 public constant REFERRAL_CODE = 0;

    /**
     * @notice Initialize the Aave V3 strategy
     * @param _asset The underlying asset (USDC)
     * @param _name Strategy name (e.g., "AaveV3 USDC")
     */
    constructor(
        address _asset,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == usdc, "Strategy only supports USDC");
    }

    /**
     * @notice Deploy funds to Aave V3 by supplying USDC
     * @param _amount Amount of USDC to supply to Aave
     */
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Approve Aave Pool to spend USDC
        asset.approve(address(aavePool), _amount);

        // Supply USDC to Aave Pool
        // onBehalfOf is this strategy contract
        aavePool.supply(usdc, _amount, address(this), REFERRAL_CODE);
    }

    /**
     * @notice Free funds from Aave V3 by withdrawing USDC
     * @param _amount Amount of USDC to withdraw from Aave
     */
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Withdraw USDC from Aave Pool
        // This will burn aTokens and return USDC
        aavePool.withdraw(usdc, _amount, address(this));
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

        // Get aToken address from Aave Pool reserve data
        // aToken address is the 9th element (index 8) in the getReserveData return tuple
        (
            , // configuration
            , // liquidityIndex
            , // currentLiquidityRate
            , // variableBorrowIndex
            , // currentVariableBorrowRate
            , // currentStableBorrowRate
            , // lastUpdateTimestamp
            , // id
            address aTokenAddr, // aTokenAddress (position 9)
            , // stableDebtTokenAddress
            , // variableDebtTokenAddress
            , // interestRateStrategyAddress
            , // accruedToTreasury
            , // unbacked
             // isolationModeTotalDebt
        ) = aavePool.getReserveData(usdc);

        // Get aToken balance (represents our position in Aave including accrued interest)
        // aTokens maintain 1:1 ratio with underlying, so balanceOf directly gives USDC equivalent
        uint256 aTokenBalance = 0;
        if (aTokenAddr != address(0)) {
            aTokenBalance = IAaveV3AToken(aTokenAddr).balanceOf(address(this));
        }

        // Total assets = aToken balance (includes deployed funds + accrued interest) + remaining idle
        _totalAssets = aTokenBalance + asset.balanceOf(address(this));
        
        // TODO: In a full implementation, you would also:
        // 1. Claim any pending rewards from RewardsController
        // 2. Swap rewards to USDC (if needed)
        // 3. Re-invest the rewards
        // 4. Add reward value to totalAssets
    }
}
