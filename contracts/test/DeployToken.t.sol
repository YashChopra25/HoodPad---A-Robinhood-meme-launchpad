// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployToken} from "../script/DeployToken.s.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

/// @notice The deployment guards, exercised rather than trusted.
///
/// @dev These checks are what stand between a mistyped `--rpc-url` and a real
///      transaction on mainnet, so each gets a test.
///
///      They are driven through `assertSafeToDeploy`'s arguments rather than
///      through environment variables: forge runs test cases in parallel and
///      the process environment is shared, so `vm.setEnv` in one case leaks
///      into another. Only `test_RunDeploysUsingTheEnvironment` touches the
///      environment, and nothing else reads it.
contract DeployTokenTest is Test {
    uint256 internal constant SEPOLIA = 11_155_111;
    uint256 internal constant MAINNET = 1;
    uint256 internal constant ANVIL = 31_337;
    uint256 internal constant ROBINHOOD_TESTNET = 46_630;

    DeployToken internal script;
    address internal deployer = makeAddr("deployer");

    function setUp() public {
        script = new DeployToken();
    }

    function _settings(uint256 expectedChainId, bool allowMainnet)
        internal
        pure
        returns (DeployToken.Settings memory)
    {
        return DeployToken.Settings({
            expectedChainId: expectedChainId,
            allowMainnet: allowMainnet,
            initialSupply: 1_000_000e18
        });
    }

    // --- guards --------------------------------------------------------------

    function test_AllowsTheExpectedChain() public view {
        script.assertSafeToDeploy(_settings(SEPOLIA, false), SEPOLIA, deployer, 1 ether);
    }

    function test_AllowsALocalAnvilChain() public view {
        script.assertSafeToDeploy(_settings(ANVIL, false), ANVIL, deployer, 1 ether);
    }

    /// @dev The same script deploys to Robinhood Chain, which is a plain EVM
    ///      network as far as these guards are concerned.
    function test_AllowsRobinhoodTestnet() public view {
        script.assertSafeToDeploy(
            _settings(ROBINHOOD_TESTNET, false), ROBINHOOD_TESTNET, deployer, 1 ether
        );
    }

    function test_KnowsTheExplorerForEverySupportedChain() public view {
        assertEq(script.explorerBase(SEPOLIA), "https://sepolia.etherscan.io");
        assertEq(script.explorerBase(MAINNET), "https://etherscan.io");
        assertEq(script.explorerBase(4663), "https://robinhoodchain.blockscout.com");
        assertEq(
            script.explorerBase(ROBINHOOD_TESTNET), "https://explorer.testnet.chain.robinhood.com"
        );
        assertEq(script.explorerBase(ANVIL), "", "no explorer for a local chain");
    }

    function test_RevertWhen_ChainDoesNotMatchExpectation() public {
        // Configured for Sepolia, but the RPC answers Anvil.
        vm.expectRevert(
            abi.encodeWithSelector(DeployToken.UnexpectedChain.selector, SEPOLIA, ANVIL)
        );
        script.assertSafeToDeploy(_settings(SEPOLIA, false), ANVIL, deployer, 1 ether);
    }

    function test_RevertWhen_TargetIsEthereumMainnet() public {
        vm.expectRevert(DeployToken.MainnetDeploymentBlocked.selector);
        script.assertSafeToDeploy(_settings(MAINNET, false), MAINNET, deployer, 1 ether);
    }

    /// @dev Mainnet is refused even when it is what the configuration asked
    ///      for; only an explicit opt-in gets through.
    function test_MainnetIsBlockedEvenWhenExpected() public {
        vm.expectRevert(DeployToken.MainnetDeploymentBlocked.selector);
        script.assertSafeToDeploy(_settings(MAINNET, false), MAINNET, deployer, 100 ether);
    }

    function test_MainnetRequiresAnExplicitOptIn() public view {
        script.assertSafeToDeploy(_settings(MAINNET, true), MAINNET, deployer, 1 ether);
    }

    function test_RevertWhen_DeployerCannotPayGas() public {
        vm.expectRevert(
            abi.encodeWithSelector(DeployToken.DeployerHasNoGas.selector, deployer, SEPOLIA)
        );
        script.assertSafeToDeploy(_settings(SEPOLIA, false), SEPOLIA, deployer, 0);
    }

    /// @dev No chain other than the configured one may be deployed to, whatever
    ///      it happens to be.
    function testFuzz_RejectsEveryChainButTheExpectedOne(uint256 chainId) public {
        vm.assume(chainId != SEPOLIA && chainId != MAINNET);

        vm.expectRevert(
            abi.encodeWithSelector(DeployToken.UnexpectedChain.selector, SEPOLIA, chainId)
        );
        script.assertSafeToDeploy(_settings(SEPOLIA, false), chainId, deployer, 1 ether);
    }

    // --- end to end ----------------------------------------------------------

    /// @dev The only case that touches process environment variables.
    function test_RunDeploysUsingTheEnvironment() public {
        uint256 key = 0xA11CE;
        address account = vm.addr(key);
        vm.deal(account, 1 ether);
        vm.chainId(SEPOLIA);

        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(key)));
        vm.setEnv("INITIAL_SUPPLY", "250000");
        vm.setEnv("EXPECTED_CHAIN_ID", vm.toString(SEPOLIA));
        vm.setEnv("ALLOW_MAINNET", "false");

        LaunchpadToken token = script.run();

        assertEq(token.name(), "Launchpad Token");
        assertEq(token.symbol(), "LPT");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 250_000e18, "supply is scaled by 1e18");
        assertEq(token.balanceOf(account), 250_000e18, "deployer receives everything");
    }
}
