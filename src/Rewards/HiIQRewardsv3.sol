// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;
pragma experimental ABIEncoderV2;

// ====================================================================
// |     ______                   _______                             |
// |    / _____________ __  __   / ____(_____  ____ _____  ________   |
// |   / /_  / ___/ __ `| |/_/  / /_  / / __ \/ __ `/ __ \/ ___/ _ \  |
// |  / __/ / /  / /_/ _>  <   / __/ / / / / / /_/ / / / / /__/  __/  |
// | /_/   /_/   \__,_/_/|_|  /_/   /_/_/ /_/\__,_/_/ /_/\___/\___/   |
// |                                                                  |
// ====================================================================
// ======================veFXSYieldDistributorV4=======================
// ====================================================================
// Distributes IQ protocol yield based on the claimer's hiIQ balance
// V3: Yield will now not accrue for unlocked hiIQ

// Frax Finance: https://github.com/FraxFinance

// Primary Author(s)
// Travis Moore: https://github.com/FortisFortuna

// Reviewer(s) / Contributor(s)
// Jason Huan: https://github.com/jasonhuan
// Sam Kazemian: https://github.com/samkazemian

// Originally inspired by Synthetix.io, but heavily modified by the Frax team (hiIQ portion)
// https://raw.githubusercontent.com/Synthetixio/synthetix/develop/contracts/StakingYield.sol

import "./TransferHelper.sol";
import "../Lock/IhiIQ.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HiIQRewardsv3 is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    /* ========== STATE VARIABLES ========== */

    // Instances
    IhiIQ private veFXS;
    ERC20 public emittedToken;

    // Addresses
    address public emitted_token_address;

    // Admin addresses
    address public timelock_address;

    // Constant for price precision
    uint256 private constant PRICE_PRECISION = 1e6;

    // Yield and period related
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public yieldRate;
    uint256 public yieldDuration = 604800; // 7 * 86400  (7 days)

    // Yield tracking
    uint256 public yieldPerVeFXSStored = 0;
    mapping(address => uint256) public userYieldPerTokenPaid;
    mapping(address => uint256) public yields;

    // veFXS tracking
    uint256 public totalVeFXSParticipating = 0;
    uint256 public totalVeFXSSupplyStored = 0;
    mapping(address => bool) public userIsInitialized;
    mapping(address => uint256) public userVeFXSCheckpointed;

    // Greylists
    mapping(address => bool) public greylist;

    // Admin booleans for emergencies
    bool public yieldCollectionPaused = false; // For emergencies

    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyByOwnGov() {
        require( msg.sender == owner() || msg.sender == timelock_address, "Not owner or timelock");
        _;
    }

    modifier notYieldCollectionPaused() {
        require(yieldCollectionPaused == false, "Yield collection is paused");
        _;
    }

    modifier checkpointUser(address account) {
        _checkpointUser(account);
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _emittedToken,
        address _veFXS_address
    ) {
        emitted_token_address = _emittedToken;
        emittedToken = ERC20(_emittedToken);

        veFXS = IhiIQ(_veFXS_address);
        lastUpdateTime = block.timestamp;

        // 1 FXS a day at initialization
        yieldRate = (uint256(365e18)).div(365 * 86400);
    }

    /* ========== VIEWS ========== */

    function fractionParticipating() external view returns (uint256) {
        return totalVeFXSParticipating.mul(PRICE_PRECISION).div(totalVeFXSSupplyStored);
    }

    // Only positions with locked veFXS can accrue yield. Otherwise, expired-locked veFXS
    // is de-facto rewards for FXS.
    function eligibleCurrentHiIQ(address account) public view returns (uint256) {
        uint256 curr_vefxs_bal = veFXS.balanceOf(account);
        IhiIQ.LockedBalance memory curr_locked_bal_pack = veFXS.locked(account);

        // Only unexpired veFXS should be eligible
        if (int256(curr_locked_bal_pack.amount) == int256(curr_vefxs_bal)) {
            return 0;
        }
        else {
            return curr_vefxs_bal;
        }
    }

    function lastTimeYieldApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function yieldPerVeFXS() public view returns (uint256) {
        if (totalVeFXSSupplyStored == 0) {
            return yieldPerVeFXSStored;
        } else {
            return (
            yieldPerVeFXSStored.add(
                lastTimeYieldApplicable()
                .sub(lastUpdateTime)
                .mul(yieldRate)
                .mul(1e18)
                .div(totalVeFXSSupplyStored)
            )
            );
        }
    }

    function earned(address account) public view returns (uint256) {
        // Uninitialized users should not earn anything yet
        if (!userIsInitialized[account]) return 0;

        uint256 yield0 = yieldPerVeFXS();

        // Get the old and the new veFXS balances
        uint256 old_vefxs_balance = userVeFXSCheckpointed[account];
        uint256 new_vefxs_balance = eligibleCurrentHiIQ(account);

        // Analogous to midpoint Riemann sum
        uint256 midpoint_vefxs_balance = ((new_vefxs_balance).add(old_vefxs_balance)).div(2);

        return (
        midpoint_vefxs_balance
        .mul(yield0.sub(userYieldPerTokenPaid[account]))
        .div(1e18)
        .add(yields[account])
        );
    }

    function getYieldForDuration() external view returns (uint256) {
        return (yieldRate.mul(yieldDuration));
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _checkpointUser(address account) internal {
        // Need to retro-adjust some things if the period hasn't been renewed, then start a new one
        sync();

        // Calculate the earnings first
        _syncEarned(account);

        // Get the old and the new veFXS balances
        uint256 old_vefxs_balance = userVeFXSCheckpointed[account];
        uint256 new_vefxs_balance = eligibleCurrentHiIQ(account);

        // Update the user's stored veFXS balance
        userVeFXSCheckpointed[account] = new_vefxs_balance;

        // Update the total amount participating
        if (new_vefxs_balance >= old_vefxs_balance) {
            uint256 weight_diff = new_vefxs_balance.sub(old_vefxs_balance);
            totalVeFXSParticipating = totalVeFXSParticipating.add(weight_diff);
        } else {
            uint256 weight_diff = old_vefxs_balance.sub(new_vefxs_balance);
            totalVeFXSParticipating = totalVeFXSParticipating.sub(weight_diff);
        }

        // Mark the user as initialized
        if (!userIsInitialized[account]) userIsInitialized[account] = true;
    }

    function _syncEarned(address account) internal {
        if (account != address(0)) {
            uint256 earned0 = earned(account);
            yields[account] = earned0;
            userYieldPerTokenPaid[account] = yieldPerVeFXSStored;
        }
    }

    // Checkpoints the user
    function checkpoint() external {
        _checkpointUser(msg.sender);
    }

    function getYield() external nonReentrant notYieldCollectionPaused checkpointUser(msg.sender) returns (uint256 yield0) {
        require(greylist[msg.sender] == false, "Address has been greylisted");

        yield0 = yields[msg.sender];
        if (yield0 > 0) {
            yields[msg.sender] = 0;
            TransferHelper.safeTransfer(
                emitted_token_address,
                msg.sender,
                yield0
            );
            emit YieldCollected(msg.sender, yield0, emitted_token_address);
        }
    }

    // If the period expired, renew it
    function retroCatchUp() internal {
        // Failsafe check
        require(block.timestamp > periodFinish, "Period has not expired yet!");

        // Ensure the provided yield amount is not more than the balance in the contract.
        // This keeps the yield rate in the right range, preventing overflows due to
        // very high values of yieldRate in the earned and yieldPerToken functions;
        // Yield + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 num_periods_elapsed = uint256(block.timestamp.sub(periodFinish)) / yieldDuration; // Floor division to the nearest period
        uint256 balance0 = emittedToken.balanceOf(address(this));
        require(
            yieldRate.mul(yieldDuration).mul(num_periods_elapsed + 1) <=
            balance0,
            "Not enough emittedToken available for yield distribution!"
        );

        periodFinish = periodFinish.add(
            (num_periods_elapsed.add(1)).mul(yieldDuration)
        );

        uint256 yield0 = yieldPerVeFXS();
        yieldPerVeFXSStored = yield0;
        lastUpdateTime = lastTimeYieldApplicable();

        emit YieldPeriodRenewed(emitted_token_address, yieldRate);
    }

    function sync() public {
        // Update the total veFXS supply
        totalVeFXSSupplyStored = veFXS.totalSupply();

        if (block.timestamp > periodFinish) {
            retroCatchUp();
        } else {
            uint256 yield0 = yieldPerVeFXS();
            yieldPerVeFXSStored = yield0;
            lastUpdateTime = lastTimeYieldApplicable();
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    // Added to support recovering LP Yield and other mistaken tokens from other systems to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyByOwnGov {
        // Only the owner address can ever receive the recovery withdrawal
        TransferHelper.safeTransfer(tokenAddress, owner(), tokenAmount);
        emit RecoveredERC20(tokenAddress, tokenAmount);
    }

    function setYieldDuration(uint256 _yieldDuration) external onlyByOwnGov {
        require( periodFinish == 0 || block.timestamp > periodFinish, "Previous yield period must be complete before changing the duration for the new period");
        yieldDuration = _yieldDuration;
        emit YieldDurationUpdated(yieldDuration);
    }

    function initializeDefault() external onlyByOwnGov {
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(yieldDuration);
        totalVeFXSSupplyStored = veFXS.totalSupply();
        emit DefaultInitialization();
    }

    function greylistAddress(address _address) external onlyByOwnGov {
        greylist[_address] = !(greylist[_address]);
    }

    function setPauses(bool _yieldCollectionPaused) external onlyByOwnGov {
        yieldCollectionPaused = _yieldCollectionPaused;
    }

    function setYieldRate(uint256 _new_rate0, bool sync_too) external onlyByOwnGov {
        yieldRate = _new_rate0;

        if (sync_too) {
            sync();
        }
    }

    function setTimelock(address _new_timelock) external onlyByOwnGov {
        timelock_address = _new_timelock;
    }

    /* ========== EVENTS ========== */

    event YieldCollected(address indexed user, uint256 yield, address token_address);
    event YieldDurationUpdated(uint256 newDuration);
    event RecoveredERC20(address token, uint256 amount);
    event YieldPeriodRenewed(address token, uint256 yieldRate);
    event DefaultInitialization();

    /* ========== A CHICKEN ========== */
    //
    //         ,~.
    //      ,-'__ `-,
    //     {,-'  `. }              ,')
    //    ,( a )   `-.__         ,',')~,
    //   <=.) (         `-.__,==' ' ' '}
    //     (   )                      /)
    //      `-'\   ,                    )
    //          |  \        `~.        /
    //          \   `._        \      /
    //           \     `._____,'    ,'
    //            `-.             ,'
    //               `-._     _,-'
    //                   77jj'
    //                  //_||
    //               __//--'/`
    //             ,--'/`  '
    //
    // [hjw] https://textart.io/art/vw6Sa3iwqIRGkZsN1BC2vweF/chicken
}
