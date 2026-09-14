// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeToken} from "./MemeToken.sol";

/// @title MemeFactory
/// @notice Deploys launches, collects the platform fee and keeps the on-chain
///         registry the coin board reads. Deploying through the factory is what
///         makes a launch globally discoverable: the UI indexes `Launched`
///         events rather than depending on a private list.
contract MemeFactory {
    address public owner;
    address public treasury;

    /// @notice Uniswap V2 router handed to every new launch for graduation.
    ///         Zero is allowed: curves then simply keep trading past the target
    ///         until a router is configured, rather than stranding the raise.
    address public defaultRouter;

    // --- launch economics ---------------------------------------------------

    uint256 public baseFee = 0.01 ether;
    uint256 public antiBotFee = 0.005 ether;
    uint256 public antiWhaleFee = 0.005 ether;
    uint256 public taxFee = 0.01 ether;

    /// @notice Curve fee charged on every buy and sell, in basis points.
    uint256 public tradeFeeBps = 100;
    /// @notice Launchpad transfer tax written into each new token.
    uint256 public platformTaxBps = 250;
    /// @notice Synthetic reserve that sets a new curve's opening price.
    uint256 public virtualEth = 1.2 ether;
    /// @notice ETH a curve must take in before it graduates to a pool.
    uint256 public graduationTarget = 3.4 ether;

    // --- registry -----------------------------------------------------------

    address[] private _tokens;
    mapping(address => address[]) private _byCreator;
    mapping(address => bool) public isLaunch;

    event Launched(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        bool hasCurve,
        uint256 timestamp
    );
    event FeesUpdated();
    event CurveParamsUpdated();
    event TreasuryUpdated(address treasury);
    event DefaultRouterUpdated(address router);
    event OwnerUpdated(address owner);

    constructor(address _treasury, address _defaultRouter) {
        require(_treasury != address(0), "treasury required");
        owner = msg.sender;
        treasury = _treasury;
        defaultRouter = _defaultRouter;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // --- launching ----------------------------------------------------------

    /// @notice Fee for a launch with the given options, in wei.
    function quoteFee(bool antiBot, bool antiWhale, bool customTax) public view returns (uint256) {
        return
            baseFee +
            (antiBot ? antiBotFee : 0) +
            (antiWhale ? antiWhaleFee : 0) +
            (customTax ? taxFee : 0);
    }

    /// @notice Deploy a launch. Any ETH sent beyond the fee is spent on an
    ///         opening buy for the creator, so a launch and the creator's own
    ///         first position settle in one transaction.
    function launch(MemeToken.Config calldata config) external payable returns (address token) {
        uint256 fee = quoteFee(config.antiBot, config.maxWalletBps != 0, config.taxBps != 0);
        require(msg.value >= fee, "fee not covered");

        MemeToken deployed = new MemeToken(
            config,
            MemeToken.Curve({
                creator: msg.sender,
                treasury: treasury,
                router: defaultRouter,
                virtualEth: virtualEth,
                graduationTarget: graduationTarget,
                tradeFeeBps: tradeFeeBps,
                platformTaxBps: platformTaxBps
            })
        );
        token = address(deployed);

        _tokens.push(token);
        _byCreator[msg.sender].push(token);
        isLaunch[token] = true;
        emit Launched(token, msg.sender, config.name, config.symbol, config.curveBps != 0, block.timestamp);

        // Anything above the fee is the creator's opening buy. On a fixed
        // supply launch there is no curve to buy from, so it goes straight back.
        uint256 openingBuy = msg.value - fee;
        if (openingBuy != 0 && config.curveBps != 0) {
            deployed.buy{value: openingBuy}(0, msg.sender);
        } else if (openingBuy != 0) {
            _send(msg.sender, openingBuy);
        }

        if (fee != 0) _send(treasury, fee);
    }

    // --- registry views -----------------------------------------------------

    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    function allTokens() external view returns (address[] memory) {
        return _tokens;
    }

    /// @notice Newest-first page of launches, for the coin board.
    function tokensLatest(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _tokens.length;
        if (offset >= total) return new address[](0);
        uint256 size = total - offset;
        if (size > limit) size = limit;
        page = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = _tokens[total - 1 - offset - i];
        }
    }

    function tokensOf(address creator) external view returns (address[] memory) {
        return _byCreator[creator];
    }

    // --- admin --------------------------------------------------------------

    function setFees(uint256 _base, uint256 _antiBot, uint256 _antiWhale, uint256 _tax) external onlyOwner {
        baseFee = _base;
        antiBotFee = _antiBot;
        antiWhaleFee = _antiWhale;
        taxFee = _tax;
        emit FeesUpdated();
    }

    function setCurveParams(
        uint256 _virtualEth,
        uint256 _graduationTarget,
        uint256 _tradeFeeBps,
        uint256 _platformTaxBps
    ) external onlyOwner {
        require(_virtualEth != 0 && _graduationTarget != 0, "curve params required");
        require(_tradeFeeBps <= 500, "trade fee too high");
        require(_platformTaxBps <= 250, "platform tax too high");
        virtualEth = _virtualEth;
        graduationTarget = _graduationTarget;
        tradeFeeBps = _tradeFeeBps;
        platformTaxBps = _platformTaxBps;
        emit CurveParamsUpdated();
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "treasury required");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setDefaultRouter(address _router) external onlyOwner {
        defaultRouter = _router;
        emit DefaultRouterUpdated(_router);
    }

    function transferOwnership(address _owner) external onlyOwner {
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    /// @dev Fees forward to the treasury on every launch; this only sweeps
    ///      anything that arrived some other way.
    function sweep() external onlyOwner {
        _send(treasury, address(this).balance);
    }

    function _send(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "eth transfer failed");
    }
}
