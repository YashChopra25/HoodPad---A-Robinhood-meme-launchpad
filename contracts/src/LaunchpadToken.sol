// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LaunchpadToken
/// @notice The example ERC-20 the launchpad sells: a plain, fixed-supply token
///         with no owner, no mint function and no transfer hooks.
///
/// @dev Deliberately thin. Everything here comes from OpenZeppelin's audited
///      `ERC20`: balances, allowances, `transfer`, `approve`, `transferFrom`
///      and the 18-decimal default. The only addition is a constructor that
///      mints the whole supply to the deployer.
///
///      Fixed supply is a property of the code rather than a promise: `_mint`
///      is unreachable after construction and there is no owner who could add
///      a path to it, so `totalSupply()` can never change. That is what lets
///      the sale contracts in ARCHITECTURE.md treat their allocation as final.
contract LaunchpadToken is ERC20 {
    /// @notice Thrown when a deployment would create a token nobody can hold.
    error ZeroInitialSupply();

    /// @param initialSupply Total supply in base units (18 decimals), minted in
    ///        full to the deployer, who then funds the sale contract from it.
    constructor(uint256 initialSupply) ERC20("Launchpad Token", "LPT") {
        if (initialSupply == 0) revert ZeroInitialSupply();
        _mint(msg.sender, initialSupply);
    }
}
