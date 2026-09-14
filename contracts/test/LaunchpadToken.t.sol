// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

/// @notice Behaviour the sale contracts and the front end both rely on.
///
/// @dev The point is not to re-test OpenZeppelin, which is audited and has its
///      own suite. It is to pin the parts this project actually asserts: the
///      metadata the UI renders, that the deployer really does receive the
///      whole supply, and that the standard transfer paths behave as the
///      future escrow and claim flows assume.
contract LaunchpadTokenTest is Test {
    LaunchpadToken internal token;

    address internal deployer = address(this);
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant INITIAL_SUPPLY = 1_000_000e18;

    function setUp() public {
        token = new LaunchpadToken(INITIAL_SUPPLY);
    }

    // --- metadata ------------------------------------------------------------

    function test_NameIsLaunchpadToken() public view {
        assertEq(token.name(), "Launchpad Token");
    }

    function test_SymbolIsLPT() public view {
        assertEq(token.symbol(), "LPT");
    }

    function test_HasEighteenDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    // --- supply --------------------------------------------------------------

    function test_TotalSupplyMatchesTheConstructorArgument() public view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    function test_DeployerReceivesTheEntireSupply() public view {
        assertEq(token.balanceOf(deployer), INITIAL_SUPPLY);
    }

    function test_NobodyElseHoldsAnything() public view {
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_SupplyIsConfigurable() public {
        LaunchpadToken small = new LaunchpadToken(1);
        assertEq(small.totalSupply(), 1);
        assertEq(small.balanceOf(address(this)), 1);
    }

    function test_RevertWhen_SupplyIsZero() public {
        vm.expectRevert(LaunchpadToken.ZeroInitialSupply.selector);
        new LaunchpadToken(0);
    }

    /// @dev The sale contracts treat their allocation as final, which only
    ///      holds because no reachable path can change the supply.
    function testFuzz_SupplyIsFixedAfterDeployment(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        LaunchpadToken fresh = new LaunchpadToken(amount);

        vm.prank(alice);
        vm.expectRevert();
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        IERC20(address(fresh)).transfer(bob, 1);

        assertEq(fresh.totalSupply(), amount);
    }

    // --- transfers -----------------------------------------------------------

    function test_TransferMovesBalance() public {
        assertTrue(token.transfer(alice, 100e18), "transfer must return true");

        assertEq(token.balanceOf(alice), 100e18);
        assertEq(token.balanceOf(deployer), INITIAL_SUPPLY - 100e18);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    function test_TransferEmitsTransferEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Transfer(deployer, alice, 100e18);
        assertTrue(token.transfer(alice, 100e18));
    }

    function test_RevertWhen_TransferExceedsBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1)
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transfer(bob, 1);
    }

    function testFuzz_TransferPreservesTotalSupply(uint256 amount) public {
        amount = bound(amount, 0, INITIAL_SUPPLY);
        assertTrue(token.transfer(alice, amount));

        assertEq(token.balanceOf(alice) + token.balanceOf(deployer), INITIAL_SUPPLY);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    // --- approvals -----------------------------------------------------------

    function test_ApproveSetsAllowance() public {
        assertTrue(token.approve(alice, 500e18), "approve must return true");
        assertEq(token.allowance(deployer, alice), 500e18);
    }

    function test_ApproveEmitsApprovalEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit IERC20.Approval(deployer, alice, 500e18);
        token.approve(alice, 500e18);
    }

    /// @dev This is the exact path a sale contract takes when it pulls the
    ///      allocation the project owner approved to it.
    function test_TransferFromSpendsAllowance() public {
        assertTrue(token.approve(alice, 500e18));

        vm.prank(alice);
        assertTrue(token.transferFrom(deployer, bob, 200e18), "transferFrom must return true");

        assertEq(token.balanceOf(bob), 200e18);
        assertEq(token.balanceOf(deployer), INITIAL_SUPPLY - 200e18);
        assertEq(token.allowance(deployer, alice), 300e18);
    }

    function test_RevertWhen_TransferFromExceedsAllowance() public {
        token.approve(alice, 100e18);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, alice, 100e18, 101e18
            )
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transferFrom(deployer, bob, 101e18);
    }

    function test_RevertWhen_TransferFromWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, alice, 0, 1)
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transferFrom(deployer, bob, 1);
    }

    /// @dev OpenZeppelin v5 treats a max allowance as infinite and skips the
    ///      decrement. Vesting and claim contracts rely on that staying true.
    function test_InfiniteAllowanceIsNotDecremented() public {
        token.approve(alice, type(uint256).max);

        vm.prank(alice);
        assertTrue(token.transferFrom(deployer, bob, 1_000e18));

        assertEq(token.allowance(deployer, alice), type(uint256).max);
    }

    function test_RevertWhen_TransferringToZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transfer(address(0), 1);
    }
}
