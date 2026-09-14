// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {MerkleAirdrop} from "../src/MerkleAirdrop.sol";
import {DeployToken} from "./DeployToken.s.sol";

/// @title DeployDemo
/// @notice Deploys the token and its airdrop, and funds the airdrop, in one
///         broadcast.
///
/// @dev `DeployToken` then `DeployAirdrop` is the composable path, but it makes
///      you copy the token address between two commands. This does the whole
///      thing at once, which is what you want for a first deployment or a
///      demo — one command, one confirmation, everything wired up.
///
///      Chain guards are `DeployToken`'s, not a second copy.
///
///      Usage:
///        AIRDROP_MERKLE_ROOT=0x… AIRDROP_TOTAL=… \
///        forge script script/DeployDemo.s.sol:DeployDemo \
///          --rpc-url sepolia --broadcast --verify
contract DeployDemo is Script {
    using SafeERC20 for IERC20;

    error MissingMerkleRoot();
    error SupplyBelowAllocation(uint256 supply, uint256 allocated);
    error DeadlineOutOfRange(uint256 deadline);

    uint256 internal constant DEFAULT_SUPPLY = 1_000_000;

    function run() external returns (LaunchpadToken token, MerkleAirdrop airdrop) {
        DeployToken guards = new DeployToken();
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        guards.assertSafeToDeploy(
            guards.settingsFromEnv(), block.chainid, deployer, deployer.balance
        );

        Plan memory plan = _plan(deployer);
        _banner(guards, deployer, plan);

        vm.startBroadcast(deployerKey);
        token = new LaunchpadToken(plan.supply);
        airdrop = new MerkleAirdrop(
            IERC20(address(token)), plan.root, plan.deadline, plan.allocated, deployer
        );
        IERC20(address(token)).safeTransfer(address(airdrop), plan.allocated);
        vm.stopBroadcast();

        _report(token, airdrop, deployer, guards.explorerBase(block.chainid));
    }

    struct Plan {
        bytes32 root;
        uint256 allocated;
        uint64 deadline;
        uint256 supply;
    }

    /// @dev Gathered into a struct so `run` stays inside the EVM's stack limit;
    ///      a script with this many locals otherwise fails to compile.
    function _plan(address) internal view returns (Plan memory plan) {
        plan.root = vm.envBytes32("AIRDROP_MERKLE_ROOT");
        plan.allocated = vm.envUint("AIRDROP_TOTAL");
        plan.supply = vm.envOr("INITIAL_SUPPLY", DEFAULT_SUPPLY) * 1e18;

        uint256 rawDeadline = vm.envOr("AIRDROP_DEADLINE", uint256(0));
        // Checked rather than cast: a mistyped deadline that overflows uint64
        // would truncate to some arbitrary instant.
        if (rawDeadline > type(uint64).max) revert DeadlineOutOfRange(rawDeadline);
        // forge-lint: disable-next-line(unsafe-typecast)
        plan.deadline = uint64(rawDeadline);

        if (plan.root == bytes32(0)) revert MissingMerkleRoot();
        // Caught here rather than after the token exists and the funding
        // transfer reverts.
        if (plan.supply < plan.allocated) {
            revert SupplyBelowAllocation(plan.supply, plan.allocated);
        }
    }

    function _banner(DeployToken guards, address deployer, Plan memory plan) internal view {
        console.log("=========================================================");
        console.log("Network         ", guards.networkNameFor(block.chainid));
        console.log("Chain id        ", block.chainid);
        console.log("Deployer        ", deployer);
        console.log("Gas balance     ", deployer.balance);
        console.log("Token supply    ", plan.supply);
        console.log("Airdrop total   ", plan.allocated);
        console.log("Claim deadline  ", plan.deadline);
        console.log("=========================================================");
    }

    function _report(
        LaunchpadToken token,
        MerkleAirdrop airdrop,
        address deployer,
        string memory explorer
    ) internal view {
        console.log("LaunchpadToken");
        console.log("  address       ", address(token));
        console.log("  symbol        ", token.symbol());
        console.log("  total supply  ", token.totalSupply());
        console.log("  deployer holds", token.balanceOf(deployer));
        _explorer(explorer, address(token));

        console.log("MerkleAirdrop");
        console.log("  address       ", address(airdrop));
        console.log("  funded with   ", token.balanceOf(address(airdrop)));
        console.log("  shortfall     ", airdrop.underfundedBy());
        _explorer(explorer, address(airdrop));

        console.log("=========================================================");
        console.log("Add to .env.local:");
        console.log(
            string.concat("  NEXT_PUBLIC_LAUNCHPAD_TOKEN_ADDRESS=", vm.toString(address(token)))
        );
        console.log(string.concat("  NEXT_PUBLIC_AIRDROP_ADDRESS=", vm.toString(address(airdrop))));
    }

    function _explorer(string memory base, address target) internal pure {
        if (bytes(base).length == 0) return;
        console.log("  explorer      ", string.concat(base, "/address/", vm.toString(target)));
    }
}
