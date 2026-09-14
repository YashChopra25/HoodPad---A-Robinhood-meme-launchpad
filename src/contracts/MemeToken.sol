// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal slice of the Uniswap V2 periphery the graduation step needs.
interface IUniswapV2Router {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

/// @title MemeToken
/// @notice One contract per launch: an ERC-20 plus, optionally, the bonding
///         curve it trades on. Two launch shapes come out of the same code.
///
///         * Curve launch (`curveBps > 0`) — most of the supply sits on a
///           constant-product curve with virtual ETH reserves. Anyone can buy
///           and sell against it immediately, with no DEX in the picture. Once
///           the curve has taken in `graduationTarget` ETH it graduates: the
///           leftover tokens and the whole raise go into a Uniswap V2 pool and
///           the LP tokens are burned, so the liquidity can never be pulled.
///
///         * Fixed-supply launch (`curveBps == 0`) — the classic shape. The
///           creator receives every token and seeds a pool themselves.
///
///         Optional launch guards (anti-bot, anti-whale, a custom tax) are all
///         written so they can throttle buying but can never block a sell.
contract MemeToken {
    // --- erc-20 -------------------------------------------------------------

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- metadata -----------------------------------------------------------

    /// @notice Image URI. Either an https/ipfs link or a small inline data URI.
    string public image;
    string public description;
    string public website;
    string public twitter;
    string public telegram;

    // --- roles --------------------------------------------------------------

    /// @notice Wallet that launched the token.
    address public immutable creator;
    /// @notice Launchpad treasury: trade fees and the platform tax land here.
    address public immutable treasury;
    /// @notice Address that deployed this token: the factory, or the creator's
    ///         own wallet when the launch was deployed directly.
    address public immutable deployer;
    /// @notice Holder of the remaining admin powers. Zero once renounced.
    address public owner;

    // --- launch guards ------------------------------------------------------

    /// @notice One buy per wallet per block. Never applies to sells.
    bool public immutable antiBot;
    /// @notice Largest balance any non-exempt wallet may hold. Zero disables.
    uint256 public immutable maxWallet;
    /// @notice Creator's own tax, in basis points, fixed at launch.
    uint256 public immutable taxBps;
    /// @notice Where the creator's tax is sent.
    address public immutable taxWallet;
    /// @notice Launchpad tax, in basis points, fixed at launch.
    uint256 public immutable platformTaxBps;

    /// @notice Hard ceiling on both taxes, enforced in the constructor so a
    ///         launch can never be configured above it.
    uint256 public constant MAX_TAX_BPS = 1000;
    uint256 public constant MAX_PLATFORM_TAX_BPS = 250;

    mapping(address => bool) public isExempt;
    mapping(address => uint256) private lastBuyBlock;

    // --- bonding curve ------------------------------------------------------

    /// @notice Tokens originally placed on the curve. Zero on a fixed launch.
    uint256 public immutable curveSupply;
    /// @notice Synthetic ETH reserve that sets the curve's opening price.
    uint256 public immutable virtualEth;
    /// @notice Real ETH the curve must take in before it graduates.
    uint256 public immutable graduationTarget;
    /// @notice Curve fee on every buy and sell, in basis points.
    uint256 public immutable tradeFeeBps;
    /// @notice Constant product: virtualEth * curveSupply.
    uint256 public immutable k;

    /// @notice Tokens still on the curve.
    uint256 public tokenReserve;
    /// @notice Real ETH held by the curve.
    uint256 public ethReserve;
    /// @notice All-time ETH volume through the curve.
    uint256 public volume;
    /// @notice True once the curve has closed and liquidity has been deployed.
    bool public graduated;
    uint256 public graduatedAt;

    /// @notice Uniswap V2 router used at graduation. Settable until it closes.
    address public router;
    /// @notice Pool the token graduated into, once one exists.
    address public pair;

    /// @notice LP tokens go here at graduation, so liquidity is unpullable.
    address public constant LP_BURN = 0x000000000000000000000000000000000000dEaD;

    uint256 private locked;

    // --- events -------------------------------------------------------------

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Trade(
        address indexed trader,
        bool indexed isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 ethReserveAfter,
        uint256 tokenReserveAfter,
        uint256 timestamp
    );
    event Graduated(address indexed pair, uint256 ethIn, uint256 tokensIn);
    event MetadataUpdated();
    event OwnershipRenounced();
    event RouterUpdated(address router);

    struct Config {
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 curveBps;
        string image;
        string description;
        string website;
        string twitter;
        string telegram;
        bool antiBot;
        uint256 maxWalletBps;
        uint256 taxBps;
        address taxWallet;
    }

    struct Curve {
        address creator;
        address treasury;
        address router;
        uint256 virtualEth;
        uint256 graduationTarget;
        uint256 tradeFeeBps;
        uint256 platformTaxBps;
    }

    constructor(Config memory c, Curve memory p) {
        require(bytes(c.name).length != 0 && bytes(c.name).length <= 64, "bad name");
        require(bytes(c.symbol).length != 0 && bytes(c.symbol).length <= 16, "bad symbol");
        require(c.totalSupply != 0, "supply required");
        require(c.curveBps == 0 || (c.curveBps >= 5000 && c.curveBps <= 10000), "bad curve share");
        require(c.taxBps <= MAX_TAX_BPS, "tax too high");
        require(p.platformTaxBps <= MAX_PLATFORM_TAX_BPS, "platform tax too high");
        require(p.tradeFeeBps <= 500, "trade fee too high");
        require(c.taxBps == 0 || c.taxWallet != address(0), "tax wallet required");
        require(p.creator != address(0) && p.treasury != address(0), "bad addresses");

        name = c.name;
        symbol = c.symbol;
        totalSupply = c.totalSupply;
        image = c.image;
        description = c.description;
        website = c.website;
        twitter = c.twitter;
        telegram = c.telegram;

        creator = p.creator;
        treasury = p.treasury;
        deployer = msg.sender;
        owner = p.creator;

        antiBot = c.antiBot;
        maxWallet = c.maxWalletBps == 0 ? 0 : (c.totalSupply * c.maxWalletBps) / 10000;
        taxBps = c.taxBps;
        taxWallet = c.taxWallet;
        platformTaxBps = p.platformTaxBps;

        // The creator is exempt so they can always seed a pool: a taxed
        // transfer into a fresh pair would leave the router short.
        isExempt[address(this)] = true;
        isExempt[p.creator] = true;
        isExempt[p.treasury] = true;
        isExempt[msg.sender] = true;
        if (c.taxWallet != address(0)) isExempt[c.taxWallet] = true;
        if (p.router != address(0)) isExempt[p.router] = true;

        uint256 onCurve = (c.totalSupply * c.curveBps) / 10000;
        curveSupply = onCurve;
        tokenReserve = onCurve;

        if (onCurve != 0) {
            require(p.virtualEth != 0 && p.graduationTarget != 0, "curve params required");
            virtualEth = p.virtualEth;
            graduationTarget = p.graduationTarget;
            tradeFeeBps = p.tradeFeeBps;
            k = p.virtualEth * onCurve;
            router = p.router;
            balanceOf[address(this)] = onCurve;
            emit Transfer(address(0), address(this), onCurve);
        } else {
            virtualEth = 0;
            graduationTarget = 0;
            tradeFeeBps = 0;
            k = 0;
        }

        uint256 toCreator = c.totalSupply - onCurve;
        if (toCreator != 0) {
            balanceOf[p.creator] = toCreator;
            emit Transfer(address(0), p.creator, toCreator);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner && owner != address(0), "not owner");
        _;
    }

    modifier nonReentrant() {
        require(locked == 0, "reentrant");
        locked = 1;
        _;
        locked = 0;
    }

    // --- curve quotes -------------------------------------------------------

    /// @notice True while the curve is open for trading.
    function curveActive() public view returns (bool) {
        return curveSupply != 0 && !graduated;
    }

    /// @notice Current curve price in wei per whole token.
    function currentPrice() public view returns (uint256) {
        if (curveSupply == 0 || tokenReserve == 0) return 0;
        return ((virtualEth + ethReserve) * 1e18) / tokenReserve;
    }

    /// @notice Wei needed to buy the whole supply at the current price.
    function marketCap() external view returns (uint256) {
        return (currentPrice() * totalSupply) / 1e18;
    }

    /// @notice Tokens `ethIn` buys right now, after the curve fee.
    function quoteBuy(uint256 ethIn) public view returns (uint256 tokensOut, uint256 fee) {
        if (!curveActive() || ethIn == 0) return (0, 0);
        fee = (ethIn * tradeFeeBps) / 10000;
        uint256 net = ethIn - fee;
        uint256 nextReserve = _ceilDiv(k, virtualEth + ethReserve + net);
        tokensOut = tokenReserve > nextReserve ? tokenReserve - nextReserve : 0;
    }

    /// @notice ETH `tokensIn` returns right now, after the curve fee.
    function quoteSell(uint256 tokensIn) public view returns (uint256 ethOut, uint256 fee) {
        if (!curveActive() || tokensIn == 0) return (0, 0);
        uint256 nextTotal = k / (tokenReserve + tokensIn);
        uint256 total = virtualEth + ethReserve;
        uint256 gross = total > nextTotal ? total - nextTotal : 0;
        if (gross > ethReserve) gross = ethReserve;
        fee = (gross * tradeFeeBps) / 10000;
        ethOut = gross - fee;
    }

    /// @notice How far along the curve is, in basis points of the target.
    function progressBps() external view returns (uint256) {
        if (curveSupply == 0) return 0;
        if (graduated || ethReserve >= graduationTarget) return 10000;
        return (ethReserve * 10000) / graduationTarget;
    }

    // --- curve trading ------------------------------------------------------

    /// @notice Buy on the curve with the ETH sent along. Reverts if the trade
    ///         would return fewer than `minTokensOut` tokens.
    function buy(uint256 minTokensOut, address to) public payable nonReentrant {
        require(curveActive(), "curve closed");
        require(msg.value != 0, "no value sent");
        address recipient = to == address(0) ? msg.sender : to;

        if (antiBot && !isExempt[recipient]) {
            require(lastBuyBlock[recipient] != block.number, "one buy per block");
            lastBuyBlock[recipient] = block.number;
        }

        (uint256 tokensOut, uint256 fee) = quoteBuy(msg.value);
        require(tokensOut != 0, "value too small");
        require(tokensOut >= minTokensOut, "slippage");

        if (maxWallet != 0 && !isExempt[recipient]) {
            require(balanceOf[recipient] + tokensOut <= maxWallet, "max wallet");
        }

        ethReserve += msg.value - fee;
        tokenReserve -= tokensOut;
        volume += msg.value;

        balanceOf[address(this)] -= tokensOut;
        balanceOf[recipient] += tokensOut;
        emit Transfer(address(this), recipient, tokensOut);
        emit Trade(recipient, true, msg.value, tokensOut, ethReserve, tokenReserve, block.timestamp);

        if (fee != 0) _send(treasury, fee);
        if (ethReserve >= graduationTarget && router != address(0)) _graduate();
    }

    /// @notice Sell tokens back to the curve. Never blocked by a launch guard.
    function sell(uint256 tokensIn, uint256 minEthOut) external nonReentrant {
        require(curveActive(), "curve closed");
        require(tokensIn != 0, "no tokens sent");
        require(balanceOf[msg.sender] >= tokensIn, "balance exceeded");

        (uint256 ethOut, uint256 fee) = quoteSell(tokensIn);
        require(ethOut != 0, "amount too small");
        require(ethOut >= minEthOut, "slippage");

        balanceOf[msg.sender] -= tokensIn;
        balanceOf[address(this)] += tokensIn;
        tokenReserve += tokensIn;
        ethReserve -= ethOut + fee;
        volume += ethOut + fee;

        emit Transfer(msg.sender, address(this), tokensIn);
        emit Trade(msg.sender, false, ethOut, tokensIn, ethReserve, tokenReserve, block.timestamp);

        if (fee != 0) _send(treasury, fee);
        _send(msg.sender, ethOut);
    }

    /// @notice Plain transfers into the contract are treated as a buy.
    receive() external payable {
        if (msg.sender != router) buy(0, msg.sender);
    }

    // --- graduation ---------------------------------------------------------

    /// @notice Deploy the pool once the target is met. Runs automatically on
    ///         the buy that crosses it; exposed for the case where the router
    ///         was configured only afterwards.
    function graduate() external nonReentrant {
        require(curveActive(), "curve closed");
        require(ethReserve >= graduationTarget, "target not reached");
        require(router != address(0), "router not set");
        _graduate();
        require(graduated, "liquidity deployment failed");
    }

    /// @dev Moves the whole raise and the leftover curve tokens into a Uniswap
    ///      V2 pool and burns the LP. Failures leave the curve open and
    ///      tradable rather than stranding anyone's funds.
    function _graduate() private {
        uint256 tokenAmount = tokenReserve;
        uint256 ethAmount = ethReserve;
        if (tokenAmount == 0 || ethAmount == 0) return;

        allowance[address(this)][router] = tokenAmount;
        try
            IUniswapV2Router(router).addLiquidityETH{value: ethAmount}(
                address(this),
                tokenAmount,
                0,
                0,
                LP_BURN,
                block.timestamp
            )
        returns (uint256, uint256, uint256) {
            graduated = true;
            graduatedAt = block.timestamp;
            tokenReserve = 0;
            ethReserve = 0;
            _resolvePair();
            emit Graduated(pair, ethAmount, tokenAmount);
        } catch {
            allowance[address(this)][router] = 0;
        }
    }

    /// @dev Records the pool and exempts it, so the guards never block a sell
    ///      into it once the owner has renounced.
    function _resolvePair() private {
        try IUniswapV2Router(router).factory() returns (address f) {
            try IUniswapV2Router(router).WETH() returns (address weth) {
                address found = IUniswapV2Factory(f).getPair(address(this), weth);
                if (found != address(0)) {
                    pair = found;
                    isExempt[found] = true;
                }
            } catch {}
        } catch {}
    }

    // --- owner controls -----------------------------------------------------

    function setRouter(address newRouter) external onlyOwner {
        require(!graduated, "already graduated");
        router = newRouter;
        if (newRouter != address(0)) isExempt[newRouter] = true;
        emit RouterUpdated(newRouter);
    }

    /// @notice Register the DEX pool for a fixed-supply launch, so the launch
    ///         guards treat it as a venue rather than a whale.
    function setPair(address newPair) external onlyOwner {
        pair = newPair;
        isExempt[newPair] = true;
    }

    function setExempt(address account, bool exempt) external onlyOwner {
        isExempt[account] = exempt;
    }

    function updateMetadata(
        string calldata newImage,
        string calldata newDescription,
        string calldata newWebsite,
        string calldata newTwitter,
        string calldata newTelegram
    ) external onlyOwner {
        image = newImage;
        description = newDescription;
        website = newWebsite;
        twitter = newTwitter;
        telegram = newTelegram;
        emit MetadataUpdated();
    }

    /// @notice Drop every admin power. Supply is already fixed and there is no
    ///         mint function, so this only removes the owner role itself.
    function renounceOwnership() external onlyOwner {
        owner = address(0);
        emit OwnershipRenounced();
    }

    // --- erc-20 -------------------------------------------------------------

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "allowance exceeded");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        require(to != address(0), "zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "balance exceeded");

        uint256 received = value;
        bool exempt = isExempt[from] || isExempt[to];

        if (!exempt) {
            // Anti-bot only ever throttles the receiving side of a pool buy,
            // so selling into the pool stays open in every block.
            if (antiBot && from == pair && pair != address(0)) {
                require(lastBuyBlock[to] != block.number, "one buy per block");
                lastBuyBlock[to] = block.number;
            }

            uint256 platformCut = (value * platformTaxBps) / 10000;
            uint256 creatorCut = (value * taxBps) / 10000;
            received = value - platformCut - creatorCut;

            if (platformCut != 0) {
                balanceOf[treasury] += platformCut;
                emit Transfer(from, treasury, platformCut);
            }
            if (creatorCut != 0) {
                balanceOf[taxWallet] += creatorCut;
                emit Transfer(from, taxWallet, creatorCut);
            }

            // The cap is checked on the receiving side only, so a holder can
            // always move tokens out even when they are over it.
            if (maxWallet != 0 && to != pair) {
                require(balanceOf[to] + received <= maxWallet, "max wallet");
            }
        }

        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += received;
        }
        emit Transfer(from, to, received);
    }

    // --- views --------------------------------------------------------------

    struct State {
        string name;
        string symbol;
        uint256 totalSupply;
        address creator;
        address owner;
        address pair;
        address router;
        uint256 curveSupply;
        uint256 tokenReserve;
        uint256 ethReserve;
        uint256 virtualEth;
        uint256 graduationTarget;
        uint256 tradeFeeBps;
        uint256 volume;
        uint256 price;
        uint256 marketCapWei;
        bool graduated;
        bool antiBot;
        uint256 maxWallet;
        uint256 taxBps;
        uint256 platformTaxBps;
    }

    /// @notice Everything the trading UI renders, in a single call.
    function getState() external view returns (State memory) {
        uint256 price = currentPrice();
        return
            State({
                name: name,
                symbol: symbol,
                totalSupply: totalSupply,
                creator: creator,
                owner: owner,
                pair: pair,
                router: router,
                curveSupply: curveSupply,
                tokenReserve: tokenReserve,
                ethReserve: ethReserve,
                virtualEth: virtualEth,
                graduationTarget: graduationTarget,
                tradeFeeBps: tradeFeeBps,
                volume: volume,
                price: price,
                marketCapWei: (price * totalSupply) / 1e18,
                graduated: graduated,
                antiBot: antiBot,
                maxWallet: maxWallet,
                taxBps: taxBps,
                platformTaxBps: platformTaxBps
            });
    }

    struct Meta {
        string image;
        string description;
        string website;
        string twitter;
        string telegram;
    }

    function getMeta() external view returns (Meta memory) {
        return Meta(image, description, website, twitter, telegram);
    }

    // --- internals ----------------------------------------------------------

    function _send(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "eth transfer failed");
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
