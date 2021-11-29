// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;
pragma experimental ABIEncoderV2;

// ====================================================================
// |     ______                   _______                             |
// |    / _____________ __  __   / ____(_____  ____ _____  ________   |
// |   / /_  / ___/ __ `| |/_/  / /_  / / __ \/ __ `/ __ \/ ___/ _ \  |
// |  / __/ / /  / /_/ _>  <   / __/ / / / / / /_/ / / / / /__/  __/  |
// | /_/   /_/   \__,_/_/|_|  /_/   /_/_/ /_/\__,_/_/ /_/\___/\___/   |
// |                                                                  |
// ====================================================================
// ===================== StakingRewardsMultiGauge =====================
// ====================================================================
// SimpleGauge
// Multiple tokens with different reward rates can be emitted
// Multiple teams can set the reward rates for their token(s)
// Those teams can also use a gauge, or an external function with
// Apes together strong

// Frax Finance: https://github.com/FraxFinance

// Primary Author(s)
// Travis Moore: https://github.com/FortisFortuna

// Reviewer(s) / Contributor(s)
// Jason Huan: https://github.com/jasonhuan
// Sam Kazemian: https://github.com/samkazemian
// Saddle Team: https://github.com/saddle-finance
// Fei Team: https://github.com/fei-protocol
// Alchemix Team: https://github.com/alchemix-finance
// Liquity Team: https://github.com/liquity

// Originally inspired by Synthetix.io, but heavily modified by the Frax team
// https://raw.githubusercontent.com/Synthetixio/synthetix/develop/contracts/StakingRewards.sol

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../Interfaces/IGaugeController.sol";
import "../Interfaces/IGaugeRewardsDistributor.sol";

contract SimpleGauge is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    /* ========== STATE VARIABLES ========== */

    IGaugeRewardsDistributor public rewards_distributor;

    // Address receiving all of the Rewards
    address private _rewardsReceiver = 0x579CEa1889991f68aCc35Ff5c3dd0621fF29b0C9;

    // Time tracking
    uint256 public periodFinish;
    uint256 public lastUpdateTime;

    // Reward addresses, gauge addresses, reward rates, and reward managers
    mapping(address => address) public rewardManagers; // token addr -> manager addr
    address[] public rewardTokens;
    address[] public gaugeControllers;
    uint256[] public rewardRatesManual;
    string[] public rewardSymbols;
    mapping(address => uint256) public rewardTokenAddrToIdx; // token addr -> token index

    // Reward period
    uint256 public rewardsDuration = 604800; // 7 * 86400  (7 days)

    // Reward tracking
    uint256[] private rewardsPerTokenStored;
    mapping(uint256 => uint256) private userRewardsPerTokenPaid; // staker addr -> token id -> paid amount
    mapping(uint256 => uint256) private rewards; // staker addr -> token id -> reward amount
    uint256[] private last_gauge_relative_weights;
    uint256[] private last_gauge_time_totals;

    // Administrative booleans
    bool public rewardsCollectionPaused; // For emergencies

    /* ========== MODIFIERS ========== */

    modifier onlyTknMgrs(address reward_token_address) {
        require(msg.sender == owner() || isTokenManagerFor(msg.sender, reward_token_address), "Not owner or tkn mgr");
        _;
    }

    modifier updateRewardAndBalance(address account, bool sync_too) {
        _updateRewardAndBalance(account, sync_too);
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _stakingToken,
        address _rewards_distributor_address,
        string[] memory _rewardSymbols,
        address[] memory _rewardTokens,
        address[] memory _rewardManagers,
        uint256[] memory _rewardRatesManual,
        address[] memory _gaugeControllers
    ) {
        rewards_distributor = IGaugeRewardsDistributor(_rewards_distributor_address);

        rewardTokens = _rewardTokens;
        gaugeControllers = _gaugeControllers;
        rewardRatesManual = _rewardRatesManual;
        rewardSymbols = _rewardSymbols;

        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            // For fast token address -> token ID lookups later
            rewardTokenAddrToIdx[_rewardTokens[i]] = i;

            // Initialize the stored rewards
            rewardsPerTokenStored.push(0);

            // Initialize the reward managers
            rewardManagers[_rewardTokens[i]] = _rewardManagers[i];

            // Push in empty relative weights to initialize the array
            last_gauge_relative_weights.push(0);

            // Push in empty time totals to initialize the array
            last_gauge_time_totals.push(0);
        }

        // Initialization
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);

        // // Need to call eventually
        // sync_gauge_weights(true);
    }

    /* ========== VIEWS ========== */

    // Total locked liquidity tokens
    function totalLiquidityLocked() external view returns (uint256) {
        return 0;
        // todo: DELETE ME
    }

    // Locked liquidity for a given account
    function lockedLiquidityOf(address account) external view returns (uint256) {
        return 0;
        // todo: DELETE ME
    }

    // Total 'balance' used for calculating the percent of the pool the account owns
    // Takes into account the locked stake time multiplier
    function totalCombinedWeight() external view returns (uint256) {
        return 0;
        // todo: DELETE ME
    }

    // All the locked stakes for a given account
    function getRewardSymbols() external view returns (string[] memory) {
        return rewardSymbols;
    }

    // All the reward tokens
    function getAllRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    // Last time the reward was applicable
    function lastTimeRewardApplicable() internal view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardRates(uint256 token_idx) public view returns (uint256 rwd_rate) {
        address gauge_controller_address = gaugeControllers[token_idx];
        if (gauge_controller_address != address(0)) {
            rwd_rate = (IGaugeController(gauge_controller_address).global_emission_rate()).mul(last_gauge_relative_weights[token_idx]).div(1e18);
        }
        else {
            rwd_rate = rewardRatesManual[token_idx];
        }
    }

    // Amount of reward tokens per LP token
    function rewardsPerToken() public view returns (uint256[] memory newRewardsPerTokenStored) {
        newRewardsPerTokenStored = new uint256[](rewardTokens.length);
        for (uint256 i = 0; i < rewardsPerTokenStored.length; i++) {
            newRewardsPerTokenStored[i] = rewardsPerTokenStored[i].add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRates(i)).mul(1e18)
            );
        }
        return newRewardsPerTokenStored;
    }

    // Amount of reward tokens an account has earned / accrued
    // Note: In the edge-case of one of the account's stake expiring since the last claim, this will
    // return a slightly inflated number
    function earned(address account) public view returns (uint256[] memory new_earned) {
        uint256[] memory reward_arr = rewardsPerToken();
        new_earned = new uint256[](rewardTokens.length);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            new_earned[i] = (reward_arr[i].sub(userRewardsPerTokenPaid[i]))
            .div(1e18)
            .add(rewards[i]);
        }
    }

    // Total reward tokens emitted in the given period
    function getRewardForDuration() external view returns (uint256[] memory rewards_per_duration_arr) {
        rewards_per_duration_arr = new uint256[](rewardRatesManual.length);

        for (uint256 i = 0; i < rewardRatesManual.length; i++) {
            rewards_per_duration_arr[i] = rewardRates(i).mul(rewardsDuration);
        }
    }

    // See if the caller_addr is a manager for the reward token
    function isTokenManagerFor(address caller_addr, address reward_token_addr) public view returns (bool){
        if (caller_addr == owner()) return true;
        // Contract owner
        else if (rewardManagers[reward_token_addr] == caller_addr) return true;
        // Reward manager
        return false;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _updateRewardAndBalance(address account, bool sync_too) internal {
        // Need to retro-adjust some things if the period hasn't been renewed, then start a new one
        if (sync_too) {
            sync();
        }

        if (account != address(0)) {
            // Calculate the earnings first
            _syncEarned(account);
        }
    }

    function _syncEarned(address account) internal {
        if (account != address(0)) {
            // Calculate the earnings
            uint256[] memory earned_arr = earned(account);

            // Update the rewards array
            for (uint256 i = 0; i < earned_arr.length; i++) {
                rewards[i] = earned_arr[i];
            }

            // Update the rewards paid array
            for (uint256 i = 0; i < earned_arr.length; i++) {
                userRewardsPerTokenPaid[i] = rewardsPerTokenStored[i];
            }
        }
    }

    // Two different stake functions are needed because of delegateCall and msg.sender issues
    function stakeLocked(uint256 liquidity, uint256 secs) nonReentrant public {
        // todo: DELETE ME
    }

    // Two different getReward functions are needed because of delegateCall and msg.sender issues
    function getReward() external nonReentrant returns (uint256[] memory) {
        require(rewardsCollectionPaused == false, "Rewards collection paused");
        return _getReward(msg.sender, _rewardsReceiver);
    }

    // No withdrawer == msg.sender check needed since this is only internally callable
    function _getReward(address rewardee, address destination_address) internal updateRewardAndBalance(rewardee, true) returns (uint256[] memory rewards_before) {
        // Update the rewards array and distribute rewards
        rewards_before = new uint256[](rewardTokens.length);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            rewards_before[i] = rewards[i];
            rewards[i] = 0;
            ERC20(rewardTokens[i]).transfer(destination_address, rewards_before[i]);
            emit RewardPaid(rewardee, rewards_before[i], rewardTokens[i], destination_address);
        }
    }

    // If the period expired, renew it
    function retroCatchUp() internal {
        // Pull in rewards from the rewards distributor
        rewards_distributor.distributeReward(address(this));

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 num_periods_elapsed = uint256(block.timestamp.sub(periodFinish)) / rewardsDuration;
        // Floor division to the nearest period

        // Make sure there are enough tokens to renew the reward period
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            require(rewardRates(i).mul(rewardsDuration).mul(num_periods_elapsed + 1) <= ERC20(rewardTokens[i]).balanceOf(address(this)), string(abi.encodePacked("Not enough reward tokens available: ", rewardTokens[i])));
        }

        // uint256 old_lastUpdateTime = lastUpdateTime;
        // uint256 new_lastUpdateTime = block.timestamp;

        // lastUpdateTime = periodFinish;
        periodFinish = periodFinish.add((num_periods_elapsed.add(1)).mul(rewardsDuration));

        _updateStoredRewardsAndTime();

        emit RewardsPeriodRenewed();
    }

    function _updateStoredRewardsAndTime() internal {
        // Get the rewards
        uint256[] memory rewards_per_token = rewardsPerToken();

        // Update the rewardsPerTokenStored
        for (uint256 i = 0; i < rewardsPerTokenStored.length; i++) {
            rewardsPerTokenStored[i] = rewards_per_token[i];
        }

        // Update the last stored time
        lastUpdateTime = lastTimeRewardApplicable();
    }

    function sync_gauge_weights(bool force_update) public {
        // Loop through the gauge controllers
        for (uint256 i = 0; i < gaugeControllers.length; i++) {
            address gauge_controller_address = gaugeControllers[i];
            if (gauge_controller_address != address(0)) {
                if (force_update || (block.timestamp > last_gauge_time_totals[i])) {
                    // Update the gauge_relative_weight
                    last_gauge_relative_weights[i] = IGaugeController(gauge_controller_address).gauge_relative_weight_write(address(this), block.timestamp);
                    last_gauge_time_totals[i] = IGaugeController(gauge_controller_address).time_total();
                }
            }
        }
    }

    function sync() public {
        // Sync the gauge weight, if applicable
        sync_gauge_weights(false);

        if (block.timestamp >= periodFinish) {
            retroCatchUp();
        }
        else {
            _updateStoredRewardsAndTime();
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    // Added to support recovering LP Rewards and other mistaken tokens from other systems to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyTknMgrs(tokenAddress) {
        // Check if the desired token is a reward token
        bool isRewardToken = false;
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (rewardTokens[i] == tokenAddress) {
                isRewardToken = true;
                break;
            }
        }

        // Only the reward managers can take back their reward tokens
        if (isRewardToken && rewardManagers[tokenAddress] == msg.sender) {
            ERC20(tokenAddress).transfer(msg.sender, tokenAmount);
            emit Recovered(msg.sender, tokenAddress, tokenAmount);
            return;
        }

        // Other tokens, like the staking token, airdrops, or accidental deposits, can be withdrawn by the owner
        else if (!isRewardToken && (msg.sender == owner())) {
            ERC20(tokenAddress).transfer(msg.sender, tokenAmount);
            emit Recovered(msg.sender, tokenAddress, tokenAmount);
            return;
        }

        // If none of the above conditions are true
        else {
            revert("No valid tokens to recover");
        }
    }


    function updateRewardsReceiver(address newReceiver) external onlyOwner {
        _rewardsReceiver = newReceiver;
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(_rewardsDuration >= 86400, "Rewards duration too short");
        require(
            periodFinish == 0 || block.timestamp > periodFinish,
            "Reward period incomplete"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    function toggleRewardsCollection() external onlyOwner {
        rewardsCollectionPaused = !rewardsCollectionPaused;
    }

    // The owner or the reward token managers can set reward rates
    function setRewardRate(address reward_token_address, uint256 new_rate, bool sync_too) external onlyTknMgrs(reward_token_address) {
        rewardRatesManual[rewardTokenAddrToIdx[reward_token_address]] = new_rate;

        if (sync_too) {
            sync();
        }
    }

    // The owner or the reward token managers can set reward rates
    function setGaugeController(address reward_token_address, address _rewards_distributor_address, address _gauge_controller_address, bool sync_too) external onlyTknMgrs(reward_token_address) {
        gaugeControllers[rewardTokenAddrToIdx[reward_token_address]] = _gauge_controller_address;
        rewards_distributor = IGaugeRewardsDistributor(_rewards_distributor_address);

        if (sync_too) {
            sync();
        }
    }

    // The owner or the reward token managers can change managers
    function changeTokenManager(address reward_token_address, address new_manager_address) external onlyTknMgrs(reward_token_address) {
        rewardManagers[reward_token_address] = new_manager_address;
    }

    /* ========== EVENTS ========== */

    event RewardPaid(address indexed user, uint256 reward, address token_address, address destination_address);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address destination_address, address token, uint256 amount);
    event RewardsPeriodRenewed();
}
