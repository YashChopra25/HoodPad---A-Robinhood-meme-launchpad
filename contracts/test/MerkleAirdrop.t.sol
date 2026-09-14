// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {MerkleAirdrop} from "../src/MerkleAirdrop.sol";

/// @notice Behaviour of the claim-based distribution.
///
/// @dev The tree is built here in Solidity rather than imported from a fixture,
///      so these tests are self-contained. `npm run test:airdrop` covers the
///      other half — that the JavaScript tree builder produces roots and proofs
///      this same contract accepts.
///
///      Four leaves, so every proof is exactly two hashes:
///
///                     root
///                   /      \
///                n01        n23
///               /   \      /   \
///              l0   l1    l2   l3
contract MerkleAirdropTest is Test {
    LaunchpadToken internal token;
    MerkleAirdrop internal airdrop;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address[4] internal recipients;
    uint256[4] internal amounts = [100e18, 250e18, 50e18, 600e18];
    uint256 internal constant TOTAL = 1000e18;

    bytes32 internal root;
    bytes32[4] internal leaves;
    bytes32 internal n01;
    bytes32 internal n23;

    uint64 internal deadline;

    function setUp() public {
        recipients = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol"), makeAddr("dave")];

        for (uint256 i = 0; i < 4; i++) {
            leaves[i] = _leaf(i, recipients[i], amounts[i]);
        }
        n01 = _hashPair(leaves[0], leaves[1]);
        n23 = _hashPair(leaves[2], leaves[3]);
        root = _hashPair(n01, n23);

        deadline = uint64(block.timestamp + 30 days);

        token = new LaunchpadToken(1_000_000e18);
        airdrop = new MerkleAirdrop(IERC20(address(token)), root, deadline, TOTAL, owner);
        token.transfer(address(airdrop), TOTAL);
    }

    // --- helpers -------------------------------------------------------------

    function _leaf(uint256 index, address account, uint256 amount) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
    }

    /// @dev OpenZeppelin's MerkleProof hashes pairs commutatively, sorted.
    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function _proof(uint256 index) internal view returns (bytes32[] memory proof) {
        proof = new bytes32[](2);
        if (index == 0) (proof[0], proof[1]) = (leaves[1], n23);
        else if (index == 1) (proof[0], proof[1]) = (leaves[0], n23);
        else if (index == 2) (proof[0], proof[1]) = (leaves[3], n01);
        else (proof[0], proof[1]) = (leaves[2], n01);
    }

    function _claim(uint256 index) internal {
        airdrop.claim(index, recipients[index], amounts[index], _proof(index));
    }

    // --- setup ---------------------------------------------------------------

    function test_StoresItsConfiguration() public view {
        assertEq(address(airdrop.token()), address(token));
        assertEq(airdrop.merkleRoot(), root);
        assertEq(airdrop.claimDeadline(), deadline);
        assertEq(airdrop.totalAllocated(), TOTAL);
        assertEq(airdrop.owner(), owner);
    }

    function test_IsFullyFunded() public view {
        assertEq(token.balanceOf(address(airdrop)), TOTAL);
        assertEq(airdrop.underfundedBy(), 0);
    }

    function test_ReportsAShortfallWhenUnderfunded() public {
        MerkleAirdrop empty =
            new MerkleAirdrop(IERC20(address(token)), root, deadline, TOTAL, owner);
        assertEq(empty.underfundedBy(), TOTAL);
    }

    function test_RevertWhen_ConstructedWithoutARoot() public {
        vm.expectRevert(MerkleAirdrop.EmptyMerkleRoot.selector);
        new MerkleAirdrop(IERC20(address(token)), bytes32(0), deadline, TOTAL, owner);
    }

    function test_RevertWhen_ConstructedWithoutAToken() public {
        vm.expectRevert(MerkleAirdrop.ZeroAddress.selector);
        new MerkleAirdrop(IERC20(address(0)), root, deadline, TOTAL, owner);
    }

    function test_RevertWhen_ConstructedWithZeroAllocation() public {
        vm.expectRevert(MerkleAirdrop.ZeroAllocation.selector);
        new MerkleAirdrop(IERC20(address(token)), root, deadline, 0, owner);
    }

    // --- claiming ------------------------------------------------------------

    function test_EligibleRecipientCanClaim() public {
        _claim(0);
        assertEq(token.balanceOf(recipients[0]), amounts[0]);
        assertTrue(airdrop.isClaimed(0));
        assertEq(airdrop.totalClaimed(), amounts[0]);
    }

    function test_EveryRecipientCanClaim() public {
        for (uint256 i = 0; i < 4; i++) {
            _claim(i);
            assertEq(token.balanceOf(recipients[i]), amounts[i]);
        }
        assertEq(airdrop.totalClaimed(), TOTAL);
        assertEq(token.balanceOf(address(airdrop)), 0, "distributes exactly the allocation");
    }

    function test_ClaimEmitsClaimed() public {
        vm.expectEmit(true, true, false, true, address(airdrop));
        emit MerkleAirdrop.Claimed(0, recipients[0], amounts[0]);
        _claim(0);
    }

    /// @dev Anyone may pay the gas; the tokens still go to the recipient. This
    ///      is what lets a relayer serve users with an empty wallet.
    function test_AnyoneCanSubmitAProofButTokensGoToTheRecipient() public {
        vm.prank(relayer);
        _claim(1);

        assertEq(token.balanceOf(recipients[1]), amounts[1]);
        assertEq(token.balanceOf(relayer), 0);
    }

    function test_RevertWhen_ClaimingTwice() public {
        _claim(0);
        vm.expectRevert(abi.encodeWithSelector(MerkleAirdrop.AlreadyClaimed.selector, uint256(0)));
        _claim(0);
    }

    function test_RevertWhen_AmountIsAltered() public {
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(0, recipients[0], amounts[0] + 1, _proof(0));
    }

    function test_RevertWhen_RecipientIsSubstituted() public {
        address attacker = makeAddr("attacker");
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(0, attacker, amounts[0], _proof(0));
    }

    /// @dev A valid leaf presented under someone else's index must not verify,
    ///      or one entry could be drained through every unused index.
    function test_RevertWhen_IndexIsSwapped() public {
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(1, recipients[0], amounts[0], _proof(0));
    }

    function test_RevertWhen_ProofIsEmpty() public {
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(0, recipients[0], amounts[0], new bytes32[](0));
    }

    function test_RevertWhen_AddressIsNotInTheTree() public {
        address outsider = makeAddr("outsider");
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(4, outsider, 1e18, _proof(0));
    }

    function test_CanClaimReportsEligibilityWithoutSpendingGas() public {
        assertTrue(airdrop.canClaim(0, recipients[0], amounts[0], _proof(0)));
        _claim(0);
        assertFalse(airdrop.canClaim(0, recipients[0], amounts[0], _proof(0)));
    }

    function test_LeafForMatchesTheEncodingToolingUses() public view {
        assertEq(airdrop.leafFor(0, recipients[0], amounts[0]), leaves[0]);
    }

    // --- deadline ------------------------------------------------------------

    function test_RevertWhen_ClaimingAfterTheDeadline() public {
        vm.warp(deadline);
        vm.expectRevert(abi.encodeWithSelector(MerkleAirdrop.ClaimPeriodOver.selector, deadline));
        _claim(0);
    }

    function test_ClaimingIsOpenUpToTheLastSecond() public {
        vm.warp(deadline - 1);
        _claim(0);
        assertEq(token.balanceOf(recipients[0]), amounts[0]);
    }

    function test_OpenEndedAirdropNeverCloses() public {
        MerkleAirdrop forever = new MerkleAirdrop(IERC20(address(token)), root, 0, TOTAL, owner);
        token.transfer(address(forever), TOTAL);

        vm.warp(block.timestamp + 3650 days);
        forever.claim(0, recipients[0], amounts[0], _proof(0));
        assertEq(token.balanceOf(recipients[0]), amounts[0]);
    }

    // --- sweeping ------------------------------------------------------------

    function test_OwnerSweepsTheRemainderAfterTheDeadline() public {
        _claim(0);
        vm.warp(deadline);

        vm.prank(owner);
        airdrop.sweep(owner);

        assertEq(token.balanceOf(owner), TOTAL - amounts[0]);
        assertEq(token.balanceOf(address(airdrop)), 0);
    }

    /// @dev The whole point of a deadline: nobody can take the funds while
    ///      recipients still have a right to them.
    function test_RevertWhen_SweepingBeforeTheDeadline() public {
        vm.warp(deadline - 1);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MerkleAirdrop.ClaimPeriodNotOver.selector, deadline));
        airdrop.sweep(owner);
    }

    function test_RevertWhen_SweepingAnOpenEndedAirdrop() public {
        MerkleAirdrop forever = new MerkleAirdrop(IERC20(address(token)), root, 0, TOTAL, owner);

        vm.warp(block.timestamp + 3650 days);
        vm.prank(owner);
        vm.expectRevert(MerkleAirdrop.NoDeadlineSet.selector);
        forever.sweep(owner);
    }

    function test_RevertWhen_NonOwnerSweeps() public {
        vm.warp(deadline);
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker)
        );
        airdrop.sweep(attacker);
    }

    function test_RevertWhen_SweepingToTheZeroAddress() public {
        vm.warp(deadline);
        vm.prank(owner);
        vm.expectRevert(MerkleAirdrop.ZeroAddress.selector);
        airdrop.sweep(address(0));
    }

    function test_RevertWhen_ThereIsNothingToSweep() public {
        for (uint256 i = 0; i < 4; i++) {
            _claim(i);
        }
        vm.warp(deadline);

        vm.prank(owner);
        vm.expectRevert(MerkleAirdrop.NothingToSweep.selector);
        airdrop.sweep(owner);
    }

    // --- state view ----------------------------------------------------------

    function test_GetStateCarriesEverythingAClaimPageNeeds() public {
        _claim(0);
        MerkleAirdrop.AirdropState memory state = airdrop.getState();

        assertEq(state.token, address(token));
        assertEq(state.merkleRoot, root);
        assertEq(state.claimDeadline, deadline);
        assertEq(state.totalAllocated, TOTAL);
        assertEq(state.totalClaimed, amounts[0]);
        assertEq(state.balance, TOTAL - amounts[0]);
        assertTrue(state.open);

        vm.warp(deadline);
        assertFalse(airdrop.getState().open, "closes once the deadline passes");
    }

    // --- fuzz ----------------------------------------------------------------

    function testFuzz_OnlyTheFourRealLeavesEverVerify(uint256 index, uint256 amount) public {
        index = bound(index, 0, 3);
        vm.assume(amount != amounts[index]);

        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        airdrop.claim(index, recipients[index], amount, _proof(index));
    }
}
