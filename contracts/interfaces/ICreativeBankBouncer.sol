// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ICreativeBankBouncer
 * @notice Interface for the Creative Bank Bouncer — Yearn V3 deposit limit module
 *         with membership gating and on-chain fee floor enforcement.
 */
interface ICreativeBankBouncer {
    // --- View Functions ---

    /// @notice Check deposit eligibility (Yearn V3 hook)
    function availableDepositLimit(address user) external view returns (uint256);

    /// @notice Snake_case variant for Yearn V3 compatibility
    function available_deposit_limit(address user) external view returns (uint256);

    /// @notice Check if an address holds any Creative membership NFT
    function isMember(address user) external view returns (bool);

    /// @notice Get membership tier: 0=none, 1=creator, 2=investor, 3=brand
    function getMembershipTier(address user) external view returns (uint8);

    /// @notice Get the minimum required fee in BPS for a user
    function getMinFeeForUser(address user) external view returns (uint16);

    /// @notice Validate vault fee meets the minimum for a user
    function validateFee(address user, address vault) external view returns (
        bool valid,
        uint16 currentFee,
        uint16 requiredFee
    );

    // --- Immutable Addresses ---

    function brandNFT() external view returns (address);
    function investorNFT() external view returns (address);
    function creatorNFT() external view returns (address);
    function accountant() external view returns (address);

    // --- Constants ---

    function MIN_MEMBER_FEE_BPS() external pure returns (uint16);
    function MIN_NON_MEMBER_FEE_BPS() external pure returns (uint16);
    function MAX_FEE_BPS() external pure returns (uint16);

    // --- Events ---

    event DepositBlocked(address indexed user, string reason);
    event DepositAllowed(address indexed user, bool isMember, uint16 vaultFeeBps);

    // --- Errors ---

    error FeeBelowMemberFloor(uint16 currentFee, uint16 requiredFee);
    error FeeBelowNonMemberFloor(uint16 currentFee, uint16 requiredFee);
    error FeeExceedsMaximum(uint16 currentFee, uint16 maxFee);
}
