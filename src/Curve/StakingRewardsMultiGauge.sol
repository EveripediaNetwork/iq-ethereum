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
// hiIQ-enabled
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
import "../Rewards/TransferHelper.sol";
import "../Lock/IhiIQ.sol";
import '../Interfaces/IUniswapV2Pair.sol';
import "../Interfaces/IGaugeController.sol";
import "../Interfaces/IGaugeRewardsDistributor.sol";

contract StakingRewardsMultiGauge is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    /* ========== STATE VARIABLES ========== */

    // Instances
    IhiIQ private hiIQ = IhiIQ(0x1bF5457eCAa14Ff63CC89EFd560E251e814E16Ba);

    // Uniswap V2
    IUniswapV2Pair public stakingToken;

    // // mStable
    // IFeederPool public stakingToken;

    IGaugeRewardsDistributor public rewards_distributor;

    // IQ
    address private constant iq_address = 0x579CEa1889991f68aCc35Ff5c3dd0621fF29b0C9;

    // Constant for various precisions
    uint256 private constant MULTIPLIER_PRECISION = 1e18;

    // Time tracking
    uint256 public periodFinish;
    uint256 public lastUpdateTime;

    // Lock time and multiplier settings
    uint256 public lock_max_multiplier = uint256(3e18); // E18. 1x = e18
    uint256 public lock_time_for_max_multiplier = 3 * 365 * 86400; // 3 years
    uint256 public lock_time_min = 86400; // 1 * 86400  (1 day)

    // hiIQ related
    uint256 public hiiq_per_iq_for_max_boost = uint256(4e18); // E18. 4e18 means 4 hiIQ must be held by the staker per 1 IQ
    uint256 public hiiq_max_multiplier = uint256(2e18); // E18. 1x = 1e18
    mapping(address => uint256) private _hiiqMultiplierStored;

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
    mapping(address => mapping(uint256 => uint256)) private userRewardsPerTokenPaid; // staker addr -> token id -> paid amount
    mapping(address => mapping(uint256 => uint256)) private rewards; // staker addr -> token id -> reward amount
    mapping(address => uint256) private lastRewardClaimTime; // staker addr -> timestamp
    uint256[] private last_gauge_relative_weights;
    uint256[] private last_gauge_time_totals;

    // Balance tracking
    uint256 private _total_liquidity_locked;
    uint256 private _total_combined_weight;
    mapping(address => uint256) private _locked_liquidity;
    mapping(address => uint256) private _combined_weights;

    // List of valid migrators (set by governance)
    mapping(address => bool) public valid_migrators;

    // Stakers set which migrator(s) they want to use
    mapping(address => mapping(address => bool)) public staker_allowed_migrators;

    // Uniswap V2 ONLY
    bool iq_is_token0;

    // Stake tracking
    mapping(address => LockedStake[]) private lockedStakes;

    // Greylisting of bad addresses
    mapping(address => bool) public greylist;

    // Administrative booleans
    bool public stakesUnlocked; // Release locked stakes in case of emergency
    bool public migrationsOn; // Used for migrations. Prevents new stakes, but allows LP and reward withdrawals
    bool public withdrawalsPaused; // For emergencies
    bool public rewardsCollectionPaused; // For emergencies
    bool public stakingPaused; // For emergencies

    /* ========== STRUCTS ========== */

    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }

    /* ========== MODIFIERS ========== */

    modifier onlyTknMgrs(address reward_token_address) {
        require(msg.sender == owner() || isTokenManagerFor(msg.sender, reward_token_address), "Not owner or tkn mgr");
        _;
    }


    modifier isMigrating() {
        require(migrationsOn == true, "Not in migration");
        _;
    }

    modifier notStakingPaused() {
        require(stakingPaused == false, "Staking paused");
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
        // // mStable
        // stakingToken = IFeederPool(_stakingToken);

        // Uniswap V2
        stakingToken = IUniswapV2Pair(_stakingToken);

        rewards_distributor = IGaugeRewardsDistributor(_rewards_distributor_address);

        rewardTokens = _rewardTokens;
        gaugeControllers = _gaugeControllers;
        rewardRatesManual = _rewardRatesManual;
        rewardSymbols = _rewardSymbols;

        for (uint256 i = 0; i < _rewardTokens.length; i++){
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

        // Uniswap V2 ONLY
        // Uniswap related. Need to know which token frax is (0 or 1)
        address token0 = stakingToken.token0();
        if (token0 == iq_address) iq_is_token0 = true;
        else iq_is_token0 = false;

        // Other booleans
        stakesUnlocked = false;

        // Initialization
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);

        // // Need to call eventually
        // sync_gauge_weights(true);
    }

    /* ========== VIEWS ========== */

    // Total locked liquidity tokens
    function totalLiquidityLocked() external view returns (uint256) {
        return _total_liquidity_locked;
    }

    // Locked liquidity for a given account
    function lockedLiquidityOf(address account) external view returns (uint256) {
        return _locked_liquidity[account];
    }

    // Total 'balance' used for calculating the percent of the pool the account owns
    // Takes into account the locked stake time multiplier
    function totalCombinedWeight() external view returns (uint256) {
        return _total_combined_weight;
    }

    // Combined weight for a specific account
    function combinedWeightOf(address account) external view returns (uint256) {
        return _combined_weights[account];
    }

    function iqPerLPToken() public view returns (uint256) {
        // Get the amount of FRAX 'inside' of the lp tokens
        uint256 iq_per_lp_token;

        // Uniswap V2
        // ============================================
        {
            uint256 total_iq_reserves;
            (uint256 reserve0, uint256 reserve1, ) = (stakingToken.getReserves());
            if (iq_is_token0) total_iq_reserves = reserve0;
            else total_iq_reserves = reserve1;

            iq_per_lp_token = total_iq_reserves.mul(1e18).div(stakingToken.totalSupply());
        }

        return iq_per_lp_token;
    }

    function userStakedIq(address account) public view returns (uint256) {
        return (iqPerLPToken()).mul(_locked_liquidity[account]).div(1e18);
    }

    function minHiIQForMaxBoost(address account) public view returns (uint256) {
        return (userStakedIq(account)).mul(hiiq_per_iq_for_max_boost).div(MULTIPLIER_PRECISION);
    }

    function hiIQMultiplier(address account) public view returns (uint256) {
        // The claimer gets a boost depending on amount of hiIQ they have relative to the amount of FRAX 'inside'
        // of their locked LP tokens
        uint256 hiIQ_needed_for_max_boost = minHiIQForMaxBoost(account);
        if (hiIQ_needed_for_max_boost > 0){
            uint256 user_hiiq_fraction = (hiIQ.balanceOf(account)).mul(MULTIPLIER_PRECISION).div(hiIQ_needed_for_max_boost);

            uint256 hiiq_multiplier = ((user_hiiq_fraction).mul(hiiq_max_multiplier)).div(MULTIPLIER_PRECISION);

            // Cap the boost to the hiiq_max_multiplier
            if (hiiq_multiplier > hiiq_max_multiplier) hiiq_multiplier = hiiq_max_multiplier;

            return hiiq_multiplier;
        }
        else return 0; // This will happen with the first stake, when user_staked_frax is 0
    }

    // Calculated the combined weight for an account
    function calcCurCombinedWeight(address account) public view
    returns (
        uint256 old_combined_weight,
        uint256 new_hiiq_multiplier,
        uint256 new_combined_weight
    )
    {
        // Get the old combined weight
        old_combined_weight = _combined_weights[account];

        // Get the hiIQ multipliers
        // For the calculations, use the midpoint (analogous to midpoint Riemann sum)
        new_hiiq_multiplier = hiIQMultiplier(account);
        uint256 midpoint_hiiq_multiplier = ((new_hiiq_multiplier).add(_hiiqMultiplierStored[account])).div(2);

        // Loop through the locked stakes, first by getting the liquidity * lock_multiplier portion
        new_combined_weight = 0;
        for (uint256 i = 0; i < lockedStakes[account].length; i++) {
            LockedStake memory thisStake = lockedStakes[account][i];
            uint256 lock_multiplier = thisStake.lock_multiplier;

            // If the lock is expired
            if (thisStake.ending_timestamp <= block.timestamp) {
                // If the lock expired in the time since the last claim, the weight needs to be proportionately averaged this time
                if (lastRewardClaimTime[account] < thisStake.ending_timestamp){
                    uint256 time_before_expiry = (thisStake.ending_timestamp).sub(lastRewardClaimTime[account]);
                    uint256 time_after_expiry = (block.timestamp).sub(thisStake.ending_timestamp);

                    // Get the weighted-average lock_multiplier
                    uint256 numerator = ((lock_multiplier).mul(time_before_expiry)).add(((MULTIPLIER_PRECISION).mul(time_after_expiry)));
                    lock_multiplier = numerator.div(time_before_expiry.add(time_after_expiry));
                }
                // Otherwise, it needs to just be 1x
                else {
                    lock_multiplier = MULTIPLIER_PRECISION;
                }
            }

            uint256 liquidity = thisStake.liquidity;
            uint256 combined_boosted_amount = liquidity.mul(lock_multiplier.add(midpoint_hiiq_multiplier)).div(MULTIPLIER_PRECISION);
            new_combined_weight = new_combined_weight.add(combined_boosted_amount);
        }
    }

    // All the locked stakes for a given account
    function lockedStakesOf(address account) external view returns (LockedStake[] memory) {
        return lockedStakes[account];
    }

    // All the locked stakes for a given account
    function getRewardSymbols() external view returns (string[] memory) {
        return rewardSymbols;
    }

    // All the reward tokens
    function getAllRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    // Multiplier amount, given the length of the lock
    function lockMultiplier(uint256 secs) public view returns (uint256) {
        uint256 lock_multiplier =
        uint256(MULTIPLIER_PRECISION).add(
            secs
            .mul(lock_max_multiplier.sub(MULTIPLIER_PRECISION))
            .div(lock_time_for_max_multiplier)
        );
        if (lock_multiplier > lock_max_multiplier) lock_multiplier = lock_max_multiplier;
        return lock_multiplier;
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
        if (_total_liquidity_locked == 0 || _total_combined_weight == 0) {
            return rewardsPerTokenStored;
        }
        else {
            newRewardsPerTokenStored = new uint256[](rewardTokens.length);
            for (uint256 i = 0; i < rewardsPerTokenStored.length; i++){
                newRewardsPerTokenStored[i] = rewardsPerTokenStored[i].add(
                    lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRates(i)).mul(1e18).div(_total_combined_weight)
                );
            }
            return newRewardsPerTokenStored;
        }
    }

    // Amount of reward tokens an account has earned / accrued
    // Note: In the edge-case of one of the account's stake expiring since the last claim, this will
    // return a slightly inflated number
    function earned(address account) public view returns (uint256[] memory new_earned) {
        uint256[] memory reward_arr = rewardsPerToken();
        new_earned = new uint256[](rewardTokens.length);

        if (_combined_weights[account] == 0){
            for (uint256 i = 0; i < rewardTokens.length; i++){
                new_earned[i] = 0;
            }
        }
        else {
            for (uint256 i = 0; i < rewardTokens.length; i++){
                new_earned[i] = (_combined_weights[account])
                .mul(reward_arr[i].sub(userRewardsPerTokenPaid[account][i]))
                .div(1e18)
                .add(rewards[account][i]);
            }
        }
    }

    // Total reward tokens emitted in the given period
    function getRewardForDuration() external view returns (uint256[] memory rewards_per_duration_arr) {
        rewards_per_duration_arr = new uint256[](rewardRatesManual.length);

        for (uint256 i = 0; i < rewardRatesManual.length; i++){
            rewards_per_duration_arr[i] = rewardRates(i).mul(rewardsDuration);
        }
    }

    // See if the caller_addr is a manager for the reward token
    function isTokenManagerFor(address caller_addr, address reward_token_addr) public view returns (bool){
        if (caller_addr == owner()) return true; // Contract owner
        else if (rewardManagers[reward_token_addr] == caller_addr) return true; // Reward manager
        return false;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    // Staker can allow a migrator
    function stakerAllowMigrator(address migrator_address) external {
        require(valid_migrators[migrator_address], "Invalid migrator address");
        staker_allowed_migrators[msg.sender][migrator_address] = true;
    }

    // Staker can disallow a previously-allowed migrator
    function stakerDisallowMigrator(address migrator_address) external {
        // Delete from the mapping
        delete staker_allowed_migrators[msg.sender][migrator_address];
    }

    function _updateRewardAndBalance(address account, bool sync_too) internal {
        // Need to retro-adjust some things if the period hasn't been renewed, then start a new one
        if (sync_too){
            sync();
        }

        if (account != address(0)) {
            // To keep the math correct, the user's combined weight must be recomputed to account for their
            // ever-changing hiIQ balance.
            (
            uint256 old_combined_weight,
            uint256 new_hiiq_multiplier,
            uint256 new_combined_weight
            ) = calcCurCombinedWeight(account);

            // Calculate the earnings first
            _syncEarned(account);

            // Update the user's stored hiIQ multipliers
            _hiiqMultiplierStored[account] = new_hiiq_multiplier;

            // Update the user's and the global combined weights
            if (new_combined_weight >= old_combined_weight) {
                uint256 weight_diff = new_combined_weight.sub(old_combined_weight);
                _total_combined_weight = _total_combined_weight.add(weight_diff);
                _combined_weights[account] = old_combined_weight.add(weight_diff);
            } else {
                uint256 weight_diff = old_combined_weight.sub(new_combined_weight);
                _total_combined_weight = _total_combined_weight.sub(weight_diff);
                _combined_weights[account] = old_combined_weight.sub(weight_diff);
            }

        }
    }

    function _syncEarned(address account) internal {
        if (account != address(0)) {
            // Calculate the earnings
            uint256[] memory earned_arr = earned(account);

            // Update the rewards array
            for (uint256 i = 0; i < earned_arr.length; i++){
                rewards[account][i] = earned_arr[i];
            }

            // Update the rewards paid array
            for (uint256 i = 0; i < earned_arr.length; i++){
                userRewardsPerTokenPaid[account][i] = rewardsPerTokenStored[i];
            }
        }
    }

    // Two different stake functions are needed because of delegateCall and msg.sender issues
    function stakeLocked(uint256 liquidity, uint256 secs) nonReentrant public {
        _stakeLocked(msg.sender, msg.sender, liquidity, secs, block.timestamp);
    }

    // If this were not internal, and source_address had an infinite approve, this could be exploitable
    // (pull funds from source_address and stake for an arbitrary staker_address)
    function _stakeLocked(
        address staker_address,
        address source_address,
        uint256 liquidity,
        uint256 secs,
        uint256 start_timestamp
    ) internal updateRewardAndBalance(staker_address, true) {
        require(!stakingPaused, "Staking paused");
        require(liquidity > 0, "Must stake more than zero");
        require(greylist[staker_address] == false, "Address has been greylisted");
        require(secs >= lock_time_min, "Minimum stake time not met");
        require(secs <= lock_time_for_max_multiplier,"Trying to lock for too long");

        uint256 lock_multiplier = lockMultiplier(secs);
        bytes32 kek_id = keccak256(abi.encodePacked(staker_address, start_timestamp, liquidity, _locked_liquidity[staker_address]));
        lockedStakes[staker_address].push(LockedStake(
                kek_id,
                start_timestamp,
                liquidity,
                start_timestamp.add(secs),
                lock_multiplier
            ));

        // Pull the tokens from the source_address
        TransferHelper.safeTransferFrom(address(stakingToken), source_address, address(this), liquidity);

        // Update liquidities
        _total_liquidity_locked = _total_liquidity_locked.add(liquidity);
        _locked_liquidity[staker_address] = _locked_liquidity[staker_address].add(liquidity);

        // Need to call to update the combined weights
        _updateRewardAndBalance(staker_address, false);

        // Needed for edge case if the staker only claims once, and after the lock expired
        if (lastRewardClaimTime[staker_address] == 0) lastRewardClaimTime[staker_address] = block.timestamp;

        emit StakeLocked(staker_address, liquidity, secs, kek_id, source_address);
    }

    // Two different withdrawLocked functions are needed because of delegateCall and msg.sender issues
    function withdrawLocked(bytes32 kek_id) nonReentrant public {
        require(withdrawalsPaused == false, "Withdrawals paused");
        _withdrawLocked(msg.sender, msg.sender, kek_id);
    }

    // No withdrawer == msg.sender check needed since this is only internally callable and the checks are done in the wrapper
    // functions like withdraw(), migrator_withdraw_unlocked() and migrator_withdraw_locked()
    function _withdrawLocked(address staker_address, address destination_address, bytes32 kek_id) internal  {
        // Collect rewards first and then update the balances
        _getReward(staker_address, destination_address);

        LockedStake memory thisStake;
        thisStake.liquidity = 0;
        uint theArrayIndex;
        for (uint256 i = 0; i < lockedStakes[staker_address].length; i++){
            if (kek_id == lockedStakes[staker_address][i].kek_id){
                thisStake = lockedStakes[staker_address][i];
                theArrayIndex = i;
                break;
            }
        }
        require(thisStake.kek_id == kek_id, "Stake not found");
        require(block.timestamp >= thisStake.ending_timestamp || stakesUnlocked == true || valid_migrators[msg.sender] == true, "Stake is still locked!");

        uint256 liquidity = thisStake.liquidity;

        if (liquidity > 0) {
            // Update liquidities
            _total_liquidity_locked = _total_liquidity_locked.sub(liquidity);
            _locked_liquidity[staker_address] = _locked_liquidity[staker_address].sub(liquidity);

            // Remove the stake from the array
            delete lockedStakes[staker_address][theArrayIndex];

            // Need to call to update the combined weights
            _updateRewardAndBalance(staker_address, false);

            // Give the tokens to the destination_address
            // Should throw if insufficient balance
            stakingToken.transfer(destination_address, liquidity);

            emit WithdrawLocked(staker_address, liquidity, kek_id, destination_address);
        }

    }

    // Two different getReward functions are needed because of delegateCall and msg.sender issues
    function getReward() external nonReentrant returns (uint256[] memory) {
        require(rewardsCollectionPaused == false,"Rewards collection paused");
        return _getReward(msg.sender, msg.sender);
    }

    // No withdrawer == msg.sender check needed since this is only internally callable
    function _getReward(address rewardee, address destination_address) internal updateRewardAndBalance(rewardee, true) returns (uint256[] memory rewards_before) {
        // Update the rewards array and distribute rewards
        rewards_before = new uint256[](rewardTokens.length);

        for (uint256 i = 0; i < rewardTokens.length; i++){
            rewards_before[i] = rewards[rewardee][i];
            rewards[rewardee][i] = 0;
            ERC20(rewardTokens[i]).transfer(destination_address, rewards_before[i]);
            emit RewardPaid(rewardee, rewards_before[i], rewardTokens[i], destination_address);
        }

        lastRewardClaimTime[rewardee] = block.timestamp;
    }

    // If the period expired, renew it
    function retroCatchUp() internal {
        // Pull in rewards from the rewards distributor
        rewards_distributor.distributeReward(address(this));

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 num_periods_elapsed = uint256(block.timestamp.sub(periodFinish)) / rewardsDuration; // Floor division to the nearest period

        // Make sure there are enough tokens to renew the reward period
        for (uint256 i = 0; i < rewardTokens.length; i++){
            require(rewardRates(i).mul(rewardsDuration).mul(num_periods_elapsed + 1) <= ERC20(rewardTokens[i]).balanceOf(address(this)), string(abi.encodePacked("Not enough reward tokens available: ", rewardTokens[i])) );
        }

        // uint256 old_lastUpdateTime = lastUpdateTime;
        // uint256 new_lastUpdateTime = block.timestamp;

        // lastUpdateTime = periodFinish;
        periodFinish = periodFinish.add((num_periods_elapsed.add(1)).mul(rewardsDuration));

        _updateStoredRewardsAndTime();

        emit RewardsPeriodRenewed(address(stakingToken));
    }

    function _updateStoredRewardsAndTime() internal {
        // Get the rewards
        uint256[] memory rewards_per_token = rewardsPerToken();

        // Update the rewardsPerTokenStored
        for (uint256 i = 0; i < rewardsPerTokenStored.length; i++){
            rewardsPerTokenStored[i] = rewards_per_token[i];
        }

        // Update the last stored time
        lastUpdateTime = lastTimeRewardApplicable();
    }

    function sync_gauge_weights(bool force_update) public {
        // Loop through the gauge controllers
        for (uint256 i = 0; i < gaugeControllers.length; i++){
            address gauge_controller_address = gaugeControllers[i];
            if (gauge_controller_address != address(0)) {
                if (force_update || (block.timestamp > last_gauge_time_totals[i])){
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

    // Migrator can stake for someone else (they won't be able to withdraw it back though, only staker_address can).
    function migrator_stakeLocked_for(address staker_address, uint256 amount, uint256 secs, uint256 start_timestamp) external isMigrating {
        require(staker_allowed_migrators[staker_address][msg.sender] && valid_migrators[msg.sender], "Mig. invalid or unapproved");
        _stakeLocked(staker_address, msg.sender, amount, secs, start_timestamp);
    }

    // Used for migrations
    function migrator_withdraw_locked(address staker_address, bytes32 kek_id) external isMigrating {
        require(staker_allowed_migrators[staker_address][msg.sender] && valid_migrators[msg.sender], "Mig. invalid or unapproved");
        _withdrawLocked(staker_address, msg.sender, kek_id);
    }

    // Adds supported migrator address
    function addMigrator(address migrator_address) external onlyOwner {
        valid_migrators[migrator_address] = true;
    }

    // Remove a migrator address
    function removeMigrator(address migrator_address) external onlyOwner {
        require(valid_migrators[migrator_address] == true, "Address nonexistant");

        // Delete from the mapping
        delete valid_migrators[migrator_address];
    }

    // Added to support recovering LP Rewards and other mistaken tokens from other systems to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyTknMgrs(tokenAddress) {
        // Check if the desired token is a reward token
        bool isRewardToken = false;
        for (uint256 i = 0; i < rewardTokens.length; i++){
            if (rewardTokens[i] == tokenAddress) {
                isRewardToken = true;
                break;
            }
        }

        // Only the reward managers can take back their reward tokens
        if (isRewardToken && rewardManagers[tokenAddress] == msg.sender){
            ERC20(tokenAddress).transfer(msg.sender, tokenAmount);
            emit Recovered(msg.sender, tokenAddress, tokenAmount);
            return;
        }

        // Other tokens, like the staking token, airdrops, or accidental deposits, can be withdrawn by the owner
        else if (!isRewardToken && (msg.sender == owner())){
            ERC20(tokenAddress).transfer(msg.sender, tokenAmount);
            emit Recovered(msg.sender, tokenAddress, tokenAmount);
            return;
        }

        // If none of the above conditions are true
        else {
            revert("No valid tokens to recover");
        }
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

    function setMultipliers(uint256 _lock_max_multiplier, uint256 _hiiq_max_multiplier, uint256 _hiiq_per_iq_for_max_boost) external onlyOwner {
        require(_lock_max_multiplier >= MULTIPLIER_PRECISION, "Mult must be >= MULTIPLIER_PRECISION");
        require(_hiiq_max_multiplier >= 0, "hiIQ mul must be >= 0");
        require(_hiiq_per_iq_for_max_boost > 0, "hiIQ pct max must be >= 0");

        lock_max_multiplier = _lock_max_multiplier;
        hiiq_max_multiplier = _hiiq_max_multiplier;
        hiiq_per_iq_for_max_boost = _hiiq_per_iq_for_max_boost;

        emit MaxHIIQMultiplier(hiiq_max_multiplier);
        emit LockedStakeMaxMultiplierUpdated(lock_max_multiplier);
        emit HIIQPerFraxForMaxBoostUpdated(hiiq_per_iq_for_max_boost);
    }

    function setLockedStakeTimeForMinAndMaxMultiplier(uint256 _lock_time_for_max_multiplier, uint256 _lock_time_min) external onlyOwner {
        require(_lock_time_for_max_multiplier >= 1, "Mul max time must be >= 1");
        require(_lock_time_min >= 1, "Mul min time must be >= 1");

        lock_time_for_max_multiplier = _lock_time_for_max_multiplier;
        lock_time_min = _lock_time_min;

        emit LockedStakeTimeForMaxMultiplier(lock_time_for_max_multiplier);
        emit LockedStakeMinTime(_lock_time_min);
    }

    function greylistAddress(address _address) external onlyOwner {
        greylist[_address] = !(greylist[_address]);
    }

    function unlockStakes() external onlyOwner {
        stakesUnlocked = !stakesUnlocked;
    }

    function toggleStaking() external onlyOwner {
        stakingPaused = !stakingPaused;
    }

    function toggleMigrations() external onlyOwner {
        migrationsOn = !migrationsOn;
    }

    function toggleWithdrawals() external onlyOwner {
        withdrawalsPaused = !withdrawalsPaused;
    }

    function toggleRewardsCollection() external onlyOwner {
        rewardsCollectionPaused = !rewardsCollectionPaused;
    }

    // The owner or the reward token managers can set reward rates
    function setRewardRate(address reward_token_address, uint256 new_rate, bool sync_too) external onlyTknMgrs(reward_token_address) {
        rewardRatesManual[rewardTokenAddrToIdx[reward_token_address]] = new_rate;

        if (sync_too){
            sync();
        }
    }

    // The owner or the reward token managers can set reward rates
    function setGaugeController(address reward_token_address, address _rewards_distributor_address, address _gauge_controller_address, bool sync_too) external onlyTknMgrs(reward_token_address) {
        gaugeControllers[rewardTokenAddrToIdx[reward_token_address]] = _gauge_controller_address;
        rewards_distributor = IGaugeRewardsDistributor(_rewards_distributor_address);

        if (sync_too){
            sync();
        }
    }

    // The owner or the reward token managers can change managers
    function changeTokenManager(address reward_token_address, address new_manager_address) external onlyTknMgrs(reward_token_address) {
        rewardManagers[reward_token_address] = new_manager_address;
    }

    /* ========== EVENTS ========== */

    event StakeLocked(address indexed user, uint256 amount, uint256 secs, bytes32 kek_id, address source_address);
    event WithdrawLocked(address indexed user, uint256 amount, bytes32 kek_id, address destination_address);
    event RewardPaid(address indexed user, uint256 reward, address token_address, address destination_address);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address destination_address, address token, uint256 amount);
    event RewardsPeriodRenewed(address token);
    event LockedStakeMaxMultiplierUpdated(uint256 multiplier);
    event LockedStakeTimeForMaxMultiplier(uint256 secs);
    event LockedStakeMinTime(uint256 secs);
    event MaxHIIQMultiplier(uint256 multiplier);
    event HIIQPerFraxForMaxBoostUpdated(uint256 scale_factor);
}
