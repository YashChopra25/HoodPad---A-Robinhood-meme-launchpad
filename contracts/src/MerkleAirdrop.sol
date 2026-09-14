// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title MerkleAirdrop
/// @notice Claim-based token distribution against a Merkle root.
///
/// @dev The recipient list never goes on-chain — only its root does. That is
///      what makes the cost of an airdrop independent of its size: a list of
///      ten addresses and a list of a hundred thousand deploy identically, and
///      each claimer pays for their own claim rather than the project paying to
///      push tokens at wallets that may never look.
///
///      Leaves are `keccak256(bytes.concat(keccak256(abi.encode(index, account,
///      amount))))`. The inner hash is ABI-encoded rather than packed, so no two
///      distinct tuples can collide; the outer hash is what OpenZeppelin's
///      `StandardMerkleTree` calls a second-preimage guard, ensuring a leaf can
///      never be mistaken for an internal node. `scripts/build-merkle.mjs`
///      produces exactly this encoding, and `npm run test:airdrop` proves the
///      two agree by verifying a JavaScript-built proof against this contract.
///
///      `claim` is permissionless in caller but not in destination: anyone may
///      submit a proof, and the tokens always go to `account`. That allows a
///      relayer to cover gas for users who have none, with no way to redirect.
contract MerkleAirdrop is Ownable2Step {
    using SafeERC20 for IERC20;
    using BitMaps for BitMaps.BitMap;

    // These are public immutables, so their names are the external ABI. The
    // ecosystem expects `token()` and `merkleRoot()`; SCREAMING_SNAKE would
    // publish `TOKEN()` and break every explorer, wallet and indexer default.
    // forge-lint: disable-start(screaming-snake-case-immutable)

    /// @notice Token being distributed.
    IERC20 public immutable token;
    /// @notice Root of the recipient tree.
    bytes32 public immutable merkleRoot;
    /// @notice Unix seconds after which claiming stops. Zero means never.
    uint64 public immutable claimDeadline;
    /// @notice Sum of every allocation in the tree, for funding and reporting.
    uint256 public immutable totalAllocated;

    // forge-lint: disable-end(screaming-snake-case-immutable)

    /// @notice Total claimed so far.
    uint256 public totalClaimed;

    /// @dev One bit per index; far cheaper than a mapping to bool.
    BitMaps.BitMap private _claimed;

    event Claimed(uint256 indexed index, address indexed account, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    error EmptyMerkleRoot();
    error ZeroAddress();
    error ZeroAllocation();
    error AlreadyClaimed(uint256 index);
    error InvalidProof();
    error ClaimPeriodOver(uint64 deadline);
    error ClaimPeriodNotOver(uint64 deadline);
    error NoDeadlineSet();
    error NothingToSweep();

    /// @param token_ The ERC-20 being distributed.
    /// @param merkleRoot_ Root of the recipient tree.
    /// @param claimDeadline_ Unix seconds; zero for an open-ended claim window.
    /// @param totalAllocated_ Sum of every allocation, used to fund and report.
    /// @param owner_ Receives the sweep right. Never the ability to take funds
    ///        before the deadline.
    constructor(
        IERC20 token_,
        bytes32 merkleRoot_,
        uint64 claimDeadline_,
        uint256 totalAllocated_,
        address owner_
    ) Ownable(owner_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        if (merkleRoot_ == bytes32(0)) revert EmptyMerkleRoot();
        if (totalAllocated_ == 0) revert ZeroAllocation();

        token = token_;
        merkleRoot = merkleRoot_;
        claimDeadline = claimDeadline_;
        totalAllocated = totalAllocated_;
    }

    // --- claiming ------------------------------------------------------------

    /// @notice Whether the allocation at `index` has been claimed.
    function isClaimed(uint256 index) public view returns (bool) {
        return _claimed.get(index);
    }

    /// @notice Claim `amount` for `account`, proving membership of the tree.
    /// @dev Callable by anyone; the tokens always go to `account`. State is
    ///      written before the transfer, so a token with a callback cannot
    ///      re-enter into a second claim on the same index.
    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata proof)
        external
    {
        // A claim window is measured in days; the seconds a proposer could
        // shift `block.timestamp` by cannot change who is able to claim.
        // forge-lint: disable-next-line(block-timestamp)
        if (claimDeadline != 0 && block.timestamp >= claimDeadline) {
            revert ClaimPeriodOver(claimDeadline);
        }
        if (isClaimed(index)) revert AlreadyClaimed(index);

        bytes32 leaf = leafFor(index, account, amount);
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        _claimed.set(index);
        totalClaimed += amount;

        emit Claimed(index, account, amount);
        token.safeTransfer(account, amount);
    }

    /// @notice The leaf hash for an entry, exposed so tooling and front ends
    ///         can reproduce it without re-implementing the encoding.
    function leafFor(uint256 index, address account, uint256 amount) public pure returns (bytes32) {
        // Hand-rolled assembly would save a little gas, but this hash is the
        // whole security boundary of the airdrop and it must match exactly what
        // OpenZeppelin's StandardMerkleTree produces off-chain. Clarity wins.
        // forge-lint: disable-next-line(asm-keccak256)
        return keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
    }

    /// @notice Whether a proof would currently succeed, without spending gas.
    function canClaim(uint256 index, address account, uint256 amount, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        // forge-lint: disable-next-line(block-timestamp)
        if (claimDeadline != 0 && block.timestamp >= claimDeadline) return false;
        if (isClaimed(index)) return false;
        return MerkleProof.verifyCalldata(proof, merkleRoot, leafFor(index, account, amount));
    }

    // --- administration ------------------------------------------------------

    /// @notice Recover whatever is left once the claim window has closed.
    /// @dev Deliberately impossible while claiming is open, and impossible at
    ///      all when no deadline was set. An airdrop whose owner can pull the
    ///      funds mid-window is not an airdrop.
    function sweep(address to) external onlyOwner {
        if (claimDeadline == 0) revert NoDeadlineSet();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < claimDeadline) revert ClaimPeriodNotOver(claimDeadline);
        if (to == address(0)) revert ZeroAddress();

        uint256 remaining = token.balanceOf(address(this));
        if (remaining == 0) revert NothingToSweep();

        emit Swept(to, remaining);
        token.safeTransfer(to, remaining);
    }

    // --- views ---------------------------------------------------------------

    struct AirdropState {
        address token;
        bytes32 merkleRoot;
        uint64 claimDeadline;
        uint256 totalAllocated;
        uint256 totalClaimed;
        uint256 balance;
        bool open;
    }

    /// @notice Everything a claim page renders, in one call.
    function getState() external view returns (AirdropState memory) {
        return AirdropState({
            token: address(token),
            merkleRoot: merkleRoot,
            claimDeadline: claimDeadline,
            totalAllocated: totalAllocated,
            totalClaimed: totalClaimed,
            balance: token.balanceOf(address(this)),
            // forge-lint: disable-next-line(block-timestamp)
            open: claimDeadline == 0 || block.timestamp < claimDeadline
        });
    }

    /// @notice Shortfall between what the tree promises and what is funded.
    function underfundedBy() external view returns (uint256) {
        uint256 owed = totalAllocated - totalClaimed;
        uint256 held = token.balanceOf(address(this));
        return held >= owed ? 0 : owed - held;
    }
}
