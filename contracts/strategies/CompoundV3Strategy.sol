// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IComet} from "../interfaces/ICompoundComet.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

/**
 * @title CompoundV3Strategy
 * @notice Yearn V3 Tokenized Strategy for Compound V3 on Base
 * @dev Supplies USDC to Compound V3 Comet and earns yield through lending
 */
contract CompoundV3Strategy is BaseStrategy {
    // Compound V3 Comet contract
    IComet public constant comet = IComet(BaseAddresses.COMPOUND_COMET);

    // USDC token address
    address public constant usdc = BaseAddresses.USDC;

    /**
     * @notice Initialize the Compound V3 strategy
     * @param _asset The underlying asset (USDC)
     * @param _name Strategy name (e.g., "CompoundV3 USDC")
     */
    constructor(
        address _asset,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == usdc, "Strategy only supports USDC");
    }

    /**
     * @notice Deploy funds to Compound V3 by supplying USDC
     * @param _amount Amount of USDC to supply to Compound
     */
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Approve Comet to spend USDC
        asset.approve(address(comet), _amount);

        // Supply USDC to Compound V3 Comet
        comet.supply(usdc, _amount);
    }

    /**
     * @notice Free funds from Compound V3 by withdrawing USDC
     * @param _amount Amount of USDC to withdraw from Compound
     */
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        // Withdraw USDC from Compound V3 Comet
        comet.withdraw(usdc, _amount);
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

        // Get balance from Comet (this represents our position including deployed idle)
        // balanceOf returns the balance in baseToken terms (USDC)
        uint256 positionBalance = comet.balanceOf(address(this));

        // Get remaining idle after deployment (should be zero, but account for any dust)
        uint256 remainingIdle = asset.balanceOf(address(this));

        // Total assets = position in Compound + any remaining idle
        // Note: positionBalance already includes the deployed idle funds, so we don't double-count
        _totalAssets = positionBalance + remainingIdle;
    }
}
