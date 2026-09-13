// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "@forge-std/Test.sol";
import {CreativeBankBouncer} from "../contracts/CreativeBankBouncer.sol";

/// @dev Mock ERC721 that tracks balances per address
contract MockERC721 {
    mapping(address => uint256) public balanceOf;

    function mint(address to) external {
        balanceOf[to] += 1;
    }

    function burn(address from) external {
        require(balanceOf[from] > 0, "No balance");
        balanceOf[from] -= 1;
    }
}

/// @dev Mock Accountant that returns a configurable performance fee
contract MockAccountant {
    uint16 public fee;

    function setFee(uint16 _fee) external {
        fee = _fee;
    }

    function getPerformanceFee(address) external view returns (uint16) {
        return fee;
    }
}

contract CreativeBankBouncerTest is Test {
    CreativeBankBouncer public bouncer;
    MockERC721 public brandNFT;
    MockERC721 public investorNFT;
    MockERC721 public creatorNFT;
    MockAccountant public accountant;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public vault = makeAddr("vault");

    function setUp() public {
        brandNFT = new MockERC721();
        investorNFT = new MockERC721();
        creatorNFT = new MockERC721();
        accountant = new MockAccountant();

        bouncer = new CreativeBankBouncer(
            address(brandNFT),
            address(investorNFT),
            address(creatorNFT),
            address(accountant)
        );

        // Default: 12% fee (valid for members)
        accountant.setFee(1200);
    }

    // ========== Membership Tests ==========

    function test_nonMemberBlocked() public view {
        assertEq(bouncer.availableDepositLimit(alice), 0);
        assertFalse(bouncer.isMember(alice));
    }

    function test_brandMemberAllowed() public {
        brandNFT.mint(alice);
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
        assertTrue(bouncer.isMember(alice));
        assertEq(bouncer.getMembershipTier(alice), 3);
    }

    function test_investorMemberAllowed() public {
        investorNFT.mint(alice);
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
        assertTrue(bouncer.isMember(alice));
        assertEq(bouncer.getMembershipTier(alice), 2);
    }

    function test_creatorMemberAllowed() public {
        creatorNFT.mint(alice);
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
        assertTrue(bouncer.isMember(alice));
        assertEq(bouncer.getMembershipTier(alice), 1);
    }

    function test_multipleMemberships_highestPriority() public {
        brandNFT.mint(alice);
        creatorNFT.mint(alice);
        // Brand (3) takes priority
        assertEq(bouncer.getMembershipTier(alice), 3);
    }

    function test_snakeCaseAlias() public {
        creatorNFT.mint(alice);
        assertEq(bouncer.available_deposit_limit(alice), type(uint256).max);
    }

    // ========== Fee Floor Tests ==========

    function test_memberWith10PercentFee_allowed() public {
        creatorNFT.mint(alice);
        accountant.setFee(1000); // 10% — exactly the floor
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
    }

    function test_memberWith9PercentFee_blocked() public {
        creatorNFT.mint(alice);
        accountant.setFee(900); // 9% — below 10% floor
        // When vault calls availableDepositLimit, msg.sender = vault
        vm.prank(vault);
        assertEq(bouncer.availableDepositLimit(alice), 0);
    }

    function test_memberWith20PercentFee_allowed() public {
        brandNFT.mint(alice);
        accountant.setFee(2000); // 20%
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
    }

    function test_memberWith50PercentFee_allowed() public {
        investorNFT.mint(alice);
        accountant.setFee(5000); // 50% — max allowed
        assertEq(bouncer.availableDepositLimit(alice), type(uint256).max);
    }

    function test_memberWith51PercentFee_blocked() public {
        investorNFT.mint(alice);
        accountant.setFee(5100); // 51% — exceeds max
        vm.prank(vault);
        assertEq(bouncer.availableDepositLimit(alice), 0);
    }

    // ========== Fee Validation Helper Tests ==========

    function test_validateFee_memberValid() public {
        creatorNFT.mint(alice);
        accountant.setFee(1500); // 15%
        (bool valid, uint16 currentFee, uint16 requiredFee) = bouncer.validateFee(alice, vault);
        assertTrue(valid);
        assertEq(currentFee, 1500);
        assertEq(requiredFee, 1000); // Member floor = 10%
    }

    function test_validateFee_memberInvalid() public {
        creatorNFT.mint(alice);
        accountant.setFee(500); // 5% — below floor
        (bool valid, uint16 currentFee, uint16 requiredFee) = bouncer.validateFee(alice, vault);
        assertFalse(valid);
        assertEq(currentFee, 500);
        assertEq(requiredFee, 1000);
    }

    function test_validateFee_nonMember() public {
        accountant.setFee(1500); // 15% — below non-member floor of 20%
        (bool valid, uint16 currentFee, uint16 requiredFee) = bouncer.validateFee(bob, vault);
        assertFalse(valid);
        assertEq(currentFee, 1500);
        assertEq(requiredFee, 2000); // Non-member floor = 20%
    }

    function test_validateFee_nonMemberValid() public {
        accountant.setFee(2000); // 20% — meets non-member floor
        (bool valid, uint16 currentFee, uint16 requiredFee) = bouncer.validateFee(bob, vault);
        assertTrue(valid);
        assertEq(currentFee, 2000);
        assertEq(requiredFee, 2000);
    }

    // ========== Minimum Fee Helper Tests ==========

    function test_getMinFeeForUser_member() public {
        creatorNFT.mint(alice);
        assertEq(bouncer.getMinFeeForUser(alice), 1000);
    }

    function test_getMinFeeForUser_nonMember() public view {
        assertEq(bouncer.getMinFeeForUser(bob), 2000);
    }

    // ========== Graceful Degradation Tests ==========

    function test_noAccountant_memberAllowed() public {
        // Deploy bouncer without accountant
        CreativeBankBouncer noAcctBouncer = new CreativeBankBouncer(
            address(brandNFT),
            address(investorNFT),
            address(creatorNFT),
            address(0) // No accountant
        );

        brandNFT.mint(alice);
        assertEq(noAcctBouncer.availableDepositLimit(alice), type(uint256).max);
    }

    function test_noAccountant_nonMemberBlocked() public {
        CreativeBankBouncer noAcctBouncer = new CreativeBankBouncer(
            address(brandNFT),
            address(investorNFT),
            address(creatorNFT),
            address(0)
        );

        assertEq(noAcctBouncer.availableDepositLimit(bob), 0);
    }

    // ========== Immutable State Tests ==========

    function test_immutableAddresses() public view {
        assertEq(bouncer.brandNFT(), address(brandNFT));
        assertEq(bouncer.investorNFT(), address(investorNFT));
        assertEq(bouncer.creatorNFT(), address(creatorNFT));
        assertEq(bouncer.accountant(), address(accountant));
    }

    function test_constants() public pure {
        assertEq(CreativeBankBouncer(address(0)).MIN_MEMBER_FEE_BPS(), 1000);
        assertEq(CreativeBankBouncer(address(0)).MIN_NON_MEMBER_FEE_BPS(), 2000);
        assertEq(CreativeBankBouncer(address(0)).MAX_FEE_BPS(), 5000);
    }
}
