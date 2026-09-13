// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title CreativeBankBouncer
 * @notice Yearn V3 deposit limit module that gates vault deposits behind Creative Bank
 *         membership (Creative Brand, Creative Investor, or Creative Creator NFT)
 *         and enforces a minimum performance fee floor on-chain.
 *
 * @dev Fee Floor Enforcement:
 *      - Members (NFT holders): 10% minimum performance fee (MIN_MEMBER_FEE_BPS = 1000)
 *      - Non-members: 20% minimum performance fee (MIN_NON_MEMBER_FEE_BPS = 2000)
 *      - The vault's actual fee is read from the Yearn V3 Accountant
 *
 *      Fee Distribution (enforced at vault factory level, validated here):
 *        Aave Labs: 50% of total fee (protocol-level, automatic)
 *        Yearn V3:  10% of manager's half
 *        Manager:   90% of manager's half
 *        Net_Manager = (F × 0.5) × 0.9
 *
 *      Deploy with (brandNFT, investorNFT, creatorNFT, accountant) then set as the vault's
 *      deposit_limit_module via set_deposit_limit_module(bouncerAddress).
 */
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
}

interface IAccountant {
    function getPerformanceFee(address vault) external view returns (uint16);
}

contract CreativeBankBouncer {
    // --- Membership NFTs (Unlock Protocol locks on Base) ---
    address public immutable brandNFT;
    address public immutable investorNFT;
    address public immutable creatorNFT;

    // --- Fee enforcement ---
    address public immutable accountant;

    /// @notice 10% in basis points — minimum fee for NFT holders
    uint16 public constant MIN_MEMBER_FEE_BPS = 1000;

    /// @notice 20% in basis points — minimum fee for non-members
    uint16 public constant MIN_NON_MEMBER_FEE_BPS = 2000;

    /// @notice Maximum valid fee in basis points (50%)
    uint16 public constant MAX_FEE_BPS = 5000;

    // --- Events ---
    event DepositBlocked(address indexed user, string reason);
    event DepositAllowed(address indexed user, bool isMember, uint16 vaultFeeBps);

    // --- Errors ---
    error FeeBelowMemberFloor(uint16 currentFee, uint16 requiredFee);
    error FeeBelowNonMemberFloor(uint16 currentFee, uint16 requiredFee);
    error FeeExceedsMaximum(uint16 currentFee, uint16 maxFee);

    constructor(
        address _brand,
        address _investor,
        address _creator,
        address _accountant
    ) {
        brandNFT = _brand;
        investorNFT = _investor;
        creatorNFT = _creator;
        accountant = _accountant;
    }

    /**
     * @notice Yearn V3 calls this to check if a deposit is allowed.
     * @dev Enforces two rules:
     *      1. Membership gating (NFT check)
     *      2. Fee floor enforcement (reads vault fee from Accountant)
     * @param user The address trying to deposit.
     * @return The maximum amount they can deposit (uint256.max if allowed, 0 if blocked).
     */
    function availableDepositLimit(address user) external view returns (uint256) {
        return _availableDepositLimit(user);
    }

    /**
     * @notice Yearn V3 deposit_limit_module hook (snake_case variant).
     */
    function available_deposit_limit(address user) external view returns (uint256) {
        return _availableDepositLimit(user);
    }

    /**
     * @notice Check if an address holds any Creative membership NFT.
     */
    function isMember(address user) public view returns (bool) {
        return IERC721(brandNFT).balanceOf(user) > 0 ||
               IERC721(investorNFT).balanceOf(user) > 0 ||
               IERC721(creatorNFT).balanceOf(user) > 0;
    }

    /**
     * @notice Get the membership tier of an address.
     * @return tier 0 = none, 1 = creator, 2 = investor, 3 = brand
     */
    function getMembershipTier(address user) public view returns (uint8 tier) {
        if (IERC721(brandNFT).balanceOf(user) > 0) return 3;
        if (IERC721(investorNFT).balanceOf(user) > 0) return 2;
        if (IERC721(creatorNFT).balanceOf(user) > 0) return 1;
        return 0;
    }

    /**
     * @notice Get the minimum required fee for a user based on membership.
     * @return Minimum fee in basis points.
     */
    function getMinFeeForUser(address user) public view returns (uint16) {
        return isMember(user) ? MIN_MEMBER_FEE_BPS : MIN_NON_MEMBER_FEE_BPS;
    }

    /**
     * @notice Validate that a vault's fee meets the minimum for a given user.
     * @param user The user address.
     * @param vault The vault address to check fees on.
     * @return valid True if the fee meets the floor.
     * @return currentFee The vault's current performance fee in BPS.
     * @return requiredFee The minimum required fee for this user.
     */
    function validateFee(address user, address vault) public view returns (
        bool valid,
        uint16 currentFee,
        uint16 requiredFee
    ) {
        requiredFee = getMinFeeForUser(user);

        // If no accountant set, skip fee validation (backwards compatibility)
        if (accountant == address(0)) {
            return (true, 0, requiredFee);
        }

        try IAccountant(accountant).getPerformanceFee(vault) returns (uint16 fee) {
            currentFee = fee;
            valid = fee >= requiredFee && fee <= MAX_FEE_BPS;
        } catch {
            // If accountant call fails, allow deposit (graceful degradation)
            valid = true;
            currentFee = 0;
        }
    }

    function _availableDepositLimit(address user) internal view returns (uint256) {
        bool _isMember = isMember(user);

        // Rule 1: Non-members are blocked entirely from member-gated vaults
        // (They can still use non-gated vaults with 20% fee set at factory level)
        if (!_isMember) {
            return 0;
        }

        // Rule 2: Fee floor enforcement via Accountant
        // If accountant is set, verify the vault's fee meets the member minimum
        if (accountant != address(0)) {
            // Note: msg.sender is the vault calling this function
            try IAccountant(accountant).getPerformanceFee(msg.sender) returns (uint16 fee) {
                if (fee < MIN_MEMBER_FEE_BPS) {
                    return 0; // Block deposit — fee below 10% floor
                }
                if (fee > MAX_FEE_BPS) {
                    return 0; // Block deposit — fee exceeds 50% cap
                }
            } catch {
                // Graceful degradation: allow if accountant call fails
            }
        }

        return type(uint256).max;
    }
}
