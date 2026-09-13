// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.26;

import {BaseStrategy} from "@tokenized-strategy/BaseStrategy.sol";
import {BaseAddresses} from "../config/BaseAddresses.sol";

import {IMorphoMetaMorphoVault} from "../interfaces/IMorphoMetaMorphoVault.sol";

/**
 * @title MorphoV3Strategy
 * @notice Yearn V3 Tokenized Strategy adapter that wraps a MetaMorpho ERC-4626 vault.
 */
contract MorphoV3Strategy is BaseStrategy {
    // USDC token address (Base mainnet)
    address public constant USDC = BaseAddresses.USDC;

    IMorphoMetaMorphoVault public immutable morphoVault;

    constructor(
        address _asset,
        address _morphoVault,
        string memory _name
    ) BaseStrategy(_asset, _name) {
        require(_asset == USDC, "Strategy only supports USDC");
        require(_morphoVault != address(0), "Invalid Morpho vault");
        morphoVault = IMorphoMetaMorphoVault(_morphoVault);
    }

    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        asset.approve(address(morphoVault), _amount);
        morphoVault.deposit(_amount, address(this));
    }

    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;

        uint256 maxW = morphoVault.maxWithdraw(address(this));
        uint256 toWithdraw = _amount <= maxW ? _amount : maxW;
        if (toWithdraw == 0) return;

        morphoVault.withdraw(toWithdraw, address(this), address(this));
    }

    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        // Redeploy idle funds so the accounting stays tight.
        uint256 idle = asset.balanceOf(address(this));
        if (idle > 0) {
            _deployFunds(idle);
        }

        uint256 shares = morphoVault.balanceOf(address(this));
        uint256 deployedAssets = morphoVault.convertToAssets(shares);

        _totalAssets = deployedAssets + asset.balanceOf(address(this));
    }
}

