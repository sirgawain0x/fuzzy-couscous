// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.26;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

import {IBeefyVault} from "../interfaces/IBeefyVault.sol";

/**
 * @title AerodromeBeefyStrategy
 * @notice Yearn V3 Tokenized Strategy adapter that wraps a Beefy mooToken vault.
 */
contract AerodromeBeefyStrategy is BaseStrategy {
    address public constant USDC = BaseAddresses.USDC;

    IBeefyVault public immutable beefyVault;

    constructor(
        address _asset,
        address _beefyVault,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == USDC, "Strategy only supports USDC");
        require(_beefyVault != address(0), "Invalid Beefy vault");
        beefyVault = IBeefyVault(_beefyVault);
    }

    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        asset.approve(address(beefyVault), _amount);
        beefyVault.deposit(_amount);
    }

    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        uint256 pps = beefyVault.getPricePerFullShare();
        if (pps == 0) return;

        uint256 sharesHeld = beefyVault.balanceOf(address(this));
        if (sharesHeld == 0) return;

        // Beefy pps is 1e18-scaled: sharesNeeded = assets * 1e18 / pps
        uint256 sharesNeeded = (_amount * 1e18) / pps;
        if (sharesNeeded == 0) return;

        uint256 sharesToWithdraw = sharesNeeded <= sharesHeld ? sharesNeeded : sharesHeld;
        if (sharesToWithdraw == 0) return;

        beefyVault.withdraw(sharesToWithdraw);
    }

    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        // Redeploy any idle USDC
        uint256 idle = asset.balanceOf(address(this));
        if (idle > 0) {
            _deployFunds(idle);
        }

        // Best-effort harvest. If earn reverts, we still report balances.
        try beefyVault.earn() {} catch {}

        uint256 sharesHeld = beefyVault.balanceOf(address(this));
        uint256 pps = beefyVault.getPricePerFullShare();

        // totalAssetsFromShares = shares * pps / 1e18
        uint256 deployedAssets = (sharesHeld * pps) / 1e18;
        _totalAssets = deployedAssets + asset.balanceOf(address(this));
    }
}

