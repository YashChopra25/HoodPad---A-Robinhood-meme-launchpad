// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

/// @title DeployToken
/// @notice Deploys `LaunchpadToken`, reading every input from the environment
///         so no key or endpoint is ever written into the repository.
///
/// @dev Three guards stand between a mistyped `--rpc-url` and a real
///      transaction:
///
///      1. Ethereum mainnet is refused outright unless `ALLOW_MAINNET=true` is
///         set explicitly, so a stale endpoint cannot spend real ETH.
///      2. The chain the RPC reports must equal `EXPECTED_CHAIN_ID`.
///      3. The deployer must hold gas.
///
///      All three run inside the simulation forge performs before broadcasting,
///      so a mismatch fails without a transaction ever being signed. They live
///      in `assertSafeToDeploy`, which is `pure` and takes its inputs as
///      arguments — that is what lets the test suite exercise each guard
///      directly, instead of through process environment variables that forge's
///      parallel test runner shares between cases.
///
///      They are custom errors rather than strings because the parameters —
///      which chain was expected, which was found — are the useful part.
///
///      Usage:
///        forge script script/DeployToken.s.sol:DeployToken \
///          --rpc-url sepolia --broadcast --verify
contract DeployToken is Script {
    /// @notice The RPC reported Ethereum mainnet and `ALLOW_MAINNET` was unset.
    error MainnetDeploymentBlocked();
    /// @notice The RPC is pointed at a different chain than the one configured.
    error UnexpectedChain(uint256 expected, uint256 actual);
    /// @notice The deployer cannot pay for gas on this chain.
    error DeployerHasNoGas(address deployer, uint256 chainId);

    uint256 internal constant ETHEREUM_MAINNET = 1;
    uint256 internal constant SEPOLIA = 11_155_111;
    uint256 internal constant ANVIL = 31_337;
    uint256 internal constant ROBINHOOD = 4663;
    uint256 internal constant ROBINHOOD_TESTNET = 46_630;

    /// @dev Whole tokens; scaled to base units when settings are read.
    uint256 internal constant DEFAULT_SUPPLY = 1_000_000;

    struct Settings {
        uint256 expectedChainId;
        bool allowMainnet;
        /// @dev Base units, already scaled by 1e18.
        uint256 initialSupply;
    }

    // --- entry point ---------------------------------------------------------

    function run() external returns (LaunchpadToken token) {
        Settings memory settings = settingsFromEnv();

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        assertSafeToDeploy(settings, block.chainid, deployer, deployer.balance);

        console.log("=========================================================");
        console.log("Network         ", networkName(block.chainid));
        console.log("Chain id        ", block.chainid);
        console.log("Deployer        ", deployer);
        console.log("Gas balance     ", deployer.balance);
        console.log("Initial supply  ", settings.initialSupply);
        console.log("=========================================================");

        vm.startBroadcast(deployerKey);
        token = new LaunchpadToken(settings.initialSupply);
        vm.stopBroadcast();

        console.log("LaunchpadToken deployed");
        console.log("  address       ", address(token));
        console.log("  name          ", token.name());
        console.log("  symbol        ", token.symbol());
        console.log("  decimals      ", token.decimals());
        console.log("  total supply  ", token.totalSupply());
        console.log("  deployer holds", token.balanceOf(deployer));

        string memory explorer = explorerBase(block.chainid);
        if (bytes(explorer).length != 0) {
            console.log(
                "  explorer      ",
                string.concat(explorer, "/address/", vm.toString(address(token)))
            );
        }
        console.log("=========================================================");
    }

    // --- configuration -------------------------------------------------------

    /// @notice Deployment settings, with defaults that target Sepolia.
    function settingsFromEnv() public view returns (Settings memory) {
        return Settings({
            expectedChainId: vm.envOr("EXPECTED_CHAIN_ID", SEPOLIA),
            allowMainnet: vm.envOr("ALLOW_MAINNET", false),
            initialSupply: vm.envOr("INITIAL_SUPPLY", DEFAULT_SUPPLY) * 1e18
        });
    }

    /// @notice Reverts unless it is safe to deploy with `settings` against the
    ///         given chain and deployer.
    /// @dev `pure` on purpose: the guards are the security-relevant part of
    ///      this script, so they are testable in isolation.
    function assertSafeToDeploy(
        Settings memory settings,
        uint256 chainId,
        address deployer,
        uint256 deployerBalance
    ) public pure {
        if (chainId == ETHEREUM_MAINNET && !settings.allowMainnet) {
            revert MainnetDeploymentBlocked();
        }
        if (chainId != settings.expectedChainId) {
            revert UnexpectedChain(settings.expectedChainId, chainId);
        }
        // A strict comparison is the intent: any balance at all is enough to
        // attempt the deployment, and forge reports the real shortfall.
        // forge-lint: disable-next-line(incorrect-strict-equality)
        if (deployerBalance == 0) {
            revert DeployerHasNoGas(deployer, chainId);
        }
    }

    /// @notice Public alias of `networkName`, so sibling scripts can print the
    ///         same banner without duplicating the chain table.
    function networkNameFor(uint256 chainId) public pure returns (string memory) {
        return networkName(chainId);
    }

    /// @dev Kept separate so the banner reads the same on every network, and so
    ///      a new chain is added in one place.
    function networkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == ETHEREUM_MAINNET) return "Ethereum Mainnet";
        if (chainId == SEPOLIA) return "Ethereum Sepolia";
        if (chainId == ROBINHOOD) return "Robinhood Chain";
        if (chainId == ROBINHOOD_TESTNET) return "Robinhood Chain Testnet";
        if (chainId == ANVIL) return "Anvil (local)";
        return "Unknown network";
    }

    /// @notice Explorer root for a chain, or an empty string when unknown.
    /// @dev Shared with DeployAirdrop so both scripts print the same links.
    function explorerBase(uint256 chainId) public pure returns (string memory) {
        if (chainId == SEPOLIA) return "https://sepolia.etherscan.io";
        if (chainId == ETHEREUM_MAINNET) return "https://etherscan.io";
        if (chainId == ROBINHOOD) return "https://robinhoodchain.blockscout.com";
        if (chainId == ROBINHOOD_TESTNET) return "https://explorer.testnet.chain.robinhood.com";
        return "";
    }
}
