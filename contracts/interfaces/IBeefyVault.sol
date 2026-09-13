// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @notice Minimal interface for Beefy mooToken vaults.
 * @dev Beefy vaults are ERC-20 share tokens, with helpers like:
 * - getPricePerFullShare() for share->asset conversion
 * - deposit/withdraw/earn for investing and harvesting
 */
interface IBeefyVault {
    function deposit(uint256 amount) external;

    function withdraw(uint256 shares) external;

    function earn() external;

    function getPricePerFullShare() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);
}

