// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleAirdrop} from "../src/MerkleAirdrop.sol";
import {DeployToken} from "./DeployToken.s.sol";

/// @title DeployAirdrop
/// @notice Deploys a `MerkleAirdrop` and, optionally, funds it in the same run.
///
/// @dev Reuses `DeployToken.assertSafeToDeploy` rather than restating the
///      chain guards, so there is one implementation of "is this safe to
///      broadcast" and one place to fix it.
///
///      Inputs come from `scripts/build-merkle.mjs`, which writes the root and
///      total into `airdrop/<name>.json`:
///
///        AIRDROP_TOKEN=0x...      the ERC-20 to distribute
///        AIRDROP_MERKLE_ROOT=0x...
///        AIRDROP_TOTAL=...        base units, must equal the tree's total
///        AIRDROP_DEADLINE=...     unix seconds, 0 for open-ended
///        AIRDROP_FUND=true        transfer AIRDROP_TOTAL in after deploying
///
///      Usage:
///        forge script script/DeployAirdrop.s.sol:DeployAirdrop \
///          --rpc-url sepolia --broadcast --verify
contract DeployAirdrop is Script {
    using SafeERC20 for IERC20;

    error MissingMerkleRoot();
    error InsufficientTokenBalance(uint256 held, uint256 needed);
    error DeadlineOutOfRange(uint256 deadline);

    function run() external returns (MerkleAirdrop airdrop) {
        DeployToken guards = new DeployToken();
        DeployToken.Settings memory settings = guards.settingsFromEnv();

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        guards.assertSafeToDeploy(settings, block.chainid, deployer, deployer.balance);

        address token = vm.envAddress("AIRDROP_TOKEN");
        bytes32 root = vm.envBytes32("AIRDROP_MERKLE_ROOT");
        uint256 total = vm.envUint("AIRDROP_TOTAL");
        // Checked rather than cast: a mistyped deadline that overflows uint64
        // would otherwise truncate to some arbitrary past or future instant.
        uint256 rawDeadline = vm.envOr("AIRDROP_DEADLINE", uint256(0));
        if (rawDeadline > type(uint64).max) revert DeadlineOutOfRange(rawDeadline);
        // Guarded by the check immediately above.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 deadline = uint64(rawDeadline);
        bool fund = vm.envOr("AIRDROP_FUND", false);

        if (root == bytes32(0)) revert MissingMerkleRoot();

        uint256 held = IERC20(token).balanceOf(deployer);
        if (fund && held < total) revert InsufficientTokenBalance(held, total);

        console.log("=========================================================");
        console.log("Chain id        ", block.chainid);
        console.log("Deployer        ", deployer);
        console.log("Token           ", token);
        console.log("Total allocated ", total);
        console.log("Deployer holds  ", held);
        console.log("Claim deadline  ", deadline);
        console.log("Fund on deploy  ", fund);
        console.log("=========================================================");

        vm.startBroadcast(deployerKey);
        airdrop = new MerkleAirdrop(IERC20(token), root, deadline, total, deployer);
        if (fund) {
            // The distributed token is arbitrary; one that reports failure by
            // returning false rather than reverting would otherwise leave the
            // airdrop deployed and empty.
            IERC20(token).safeTransfer(address(airdrop), total);
        }
        vm.stopBroadcast();

        console.log("MerkleAirdrop deployed");
        console.log("  address       ", address(airdrop));
        console.log("  funded with   ", IERC20(token).balanceOf(address(airdrop)));
        console.log("  shortfall     ", airdrop.underfundedBy());

        if (block.chainid == 11_155_111) {
            console.log(
                "  explorer      ",
                string.concat(
                    "https://sepolia.etherscan.io/address/", vm.toString(address(airdrop))
                )
            );
        }
        console.log("=========================================================");

        if (!fund) {
            console.log("NOT funded. Send the tokens before announcing the claim:");
            console.log("  cast send <TOKEN> 'transfer(address,uint256)' <AIRDROP> <TOTAL>");
        }
    }
}
