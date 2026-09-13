// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @notice Minimal ERC-4626 interface for MetaMorpho vaults.
 * @dev Morpho MetaMorpho vaults are ERC-4626 compatible and expose
 * deposit/withdraw plus share accounting helpers.
 */
interface IMorphoMetaMorphoVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    function balanceOf(address account) external view returns (uint256);

    function maxWithdraw(address owner) external view returns (uint256 assets);
}

