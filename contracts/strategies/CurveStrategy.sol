// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ICurvePool, ICurveLPToken} from "../interfaces/ICurvePool.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

/**
 * @title CurveStrategy
 * @notice Yearn V3 Tokenized Strategy for Curve 3pool on Base
 * @dev Provides liquidity to Curve 3pool (USDC/USDT/DAI) and earns trading fees + CRV rewards
 */
contract CurveStrategy is BaseStrategy {
    // Curve 3pool contract
    ICurvePool public constant curvePool = ICurvePool(BaseAddresses.CURVE_3POOL);

    // Curve LP token (3CRV)
    ICurveLPToken public constant curveLPToken = ICurveLPToken(BaseAddresses.CURVE_3CRV_TOKEN);

    // USDC token address
    address public constant usdc = BaseAddresses.USDC;

    // Index for USDC in the 3pool (typically 0)
    int128 public constant USDC_INDEX = 0;

    /**
     * @notice Initialize the Curve strategy
     * @param _asset The underlying asset (USDC)
     * @param _name Strategy name (e.g., "Curve 3pool USDC")
     */
    constructor(
        address _asset,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == usdc, "Strategy only supports USDC");
    }

    /**
     * @notice Deploy funds to Curve by adding USDC liquidity
     * @param _amount Amount of USDC to add as liquidity
     */
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Approve Curve Pool to spend USDC
        asset.approve(address(curvePool), _amount);

        // Add liquidity to Curve 3pool
        // amounts array: [USDC, USDT, DAI] - only USDC amount is non-zero
        uint256[3] memory amounts = [_amount, 0, 0];
        uint256 minLPTokens = 0; // TODO: Calculate minimum LP tokens with slippage protection

        curvePool.add_liquidity(amounts, minLPTokens);
    }

    /**
     * @notice Free funds from Curve by removing USDC liquidity
     * @param _amount Amount of USDC to withdraw from Curve
     */
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Get current LP token balance
        uint256 lpBalance = curveLPToken.balanceOf(address(this));

        if (lpBalance == 0) return;

        // Calculate how many LP tokens to burn to get _amount of USDC
        // This is a simplified calculation - in production, you'd need to account for
        // slippage and use calc_withdraw_one_coin for accuracy
        uint256 lpToBurn = _calculateLPToBurn(_amount);

        // Don't burn more than we have
        if (lpToBurn > lpBalance) {
            lpToBurn = lpBalance;
        }

        // Approve Curve Pool to spend LP tokens
        curveLPToken.approve(address(curvePool), lpToBurn);

        // Remove liquidity as single coin (USDC)
        uint256 minAmount = 0; // TODO: Add slippage protection
        curvePool.remove_liquidity_one_coin(lpToBurn, USDC_INDEX, minAmount);
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

        // Get LP token balance (includes LP tokens from deployed idle)
        uint256 lpBalance = curveLPToken.balanceOf(address(this));

        // Get remaining idle after deployment (should be zero, but account for any dust)
        uint256 remainingIdle = asset.balanceOf(address(this));

        // Calculate USDC value of LP tokens
        // This converts LP tokens back to USDC equivalent
        if (lpBalance > 0) {
            // Use Curve's calc_withdraw_one_coin to get USDC value
            try curvePool.calc_withdraw_one_coin(lpBalance, USDC_INDEX) returns (uint256 usdcValue) {
                // LP balance already includes the deployed idle, so only add remaining idle
                _totalAssets = usdcValue + remainingIdle;
            } catch {
                // Fallback: use simple ratio calculation
                // This is not ideal but prevents reverts
                _totalAssets = remainingIdle + (lpBalance / 2); // Rough estimate
            }
        } else {
            _totalAssets = remainingIdle;
        }

        // TODO: Implement CRV reward claiming and swapping
        // 1. Claim CRV rewards from gauge (if staked)
        // 2. Swap CRV to USDC
        // 3. Re-invest or add to totalAssets
    }

    /**
     * @notice Calculate LP tokens to burn for a given USDC amount
     * @param _usdcAmount Amount of USDC desired
     * @return lpTokens Number of LP tokens to burn
     */
    function _calculateLPToBurn(uint256 _usdcAmount) internal view returns (uint256) {
        if (_usdcAmount == 0) return 0;

        // Use Curve's calc_withdraw_one_coin to find how much USDC we'd get for all LP tokens
        uint256 totalLPTokens = curveLPToken.balanceOf(address(this));
        if (totalLPTokens == 0) return 0;

        try curvePool.calc_withdraw_one_coin(totalLPTokens, USDC_INDEX) returns (uint256 maxUsdcFromLP) {
            if (maxUsdcFromLP == 0) return 0;
            
            // Calculate LP tokens needed: (desired USDC * total LP) / max USDC from LP
            // Use fixed-point math with extra precision to avoid rounding errors
            uint256 lpNeeded = (_usdcAmount * totalLPTokens) / maxUsdcFromLP;
            
            // Add 1% buffer for slippage/precision
            return lpNeeded + (lpNeeded / 100);
        } catch {
            // Fallback: if calc fails, return all LP tokens (will be capped by caller)
            return totalLPTokens;
        }
    }
}
