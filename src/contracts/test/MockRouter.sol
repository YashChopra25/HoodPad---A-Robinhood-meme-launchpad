// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Stand-in for the Uniswap V2 periphery, used only by the contract tests.
///      Pulls the tokens and ETH the way the real router does so graduation is
///      exercised end to end without a fork.
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract MockPairFactory {
    mapping(address => mapping(address => address)) public getPair;

    function record(address a, address b, address pair) external {
        getPair[a][b] = pair;
        getPair[b][a] = pair;
    }
}

contract MockRouter {
    MockPairFactory public immutable pairFactory;
    address public constant WETH_ADDR = 0x000000000000000000000000000000000000bEEF;
    address public constant PAIR = 0x00000000000000000000000000000000000CAFe0;

    uint256 public lastTokenAmount;
    uint256 public lastEthAmount;
    address public lastTo;

    constructor() {
        pairFactory = new MockPairFactory();
    }

    function factory() external view returns (address) {
        return address(pairFactory);
    }

    function WETH() external pure returns (address) {
        return WETH_ADDR;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external payable returns (uint256, uint256, uint256) {
        IERC20(token).transferFrom(msg.sender, PAIR, amountTokenDesired);
        pairFactory.record(token, WETH_ADDR, PAIR);
        lastTokenAmount = amountTokenDesired;
        lastEthAmount = msg.value;
        lastTo = to;
        return (amountTokenDesired, msg.value, 1e18);
    }
}
