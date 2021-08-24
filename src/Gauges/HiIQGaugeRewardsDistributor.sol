// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.1;

// import "../Math/Math.sol";
import "./GaugeController.sol";
import "../lib/Owned.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/Math/SafeMath.sol";
import "../lib/Uniswap/TransferHelper.sol";
import "../lib/ERC20/SafeERC20.sol";

contract HiIQGaugeRewardsDistributor is Owned, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    // Instances and addresses
    address public rewardTokenAddress;
    GaugeController public gaugeController;

    // Admin addresses
    address public timelockAddress;
    address public curatorAddress;

    // Constants
    uint256 private constant MULTIPLIER_PRECISION = 1e18;
    uint256 private constant ONE_WEEK = 604800;

    // Gaugle controller related
    mapping(address => bool) public gaugeWhitelist;
    mapping(address => bool) public lastTimeGaugePaid;

    // Booleans
    bool public distributionsOn;

    /* ========== MODIFIERS ========== */

    modifier onlyByOwnGov() {
        require(msg.sender == owner || msg.sender == timelockAddress, "Not owner or timelock");
        _;
    }

    modifier onlyByOwnerOrCuratorOrGovernance() {
        require(
            msg.sender == owner || msg.sender == curatorAddress || msg.sender == timelockAddress,
            "Not owner, curator, or timelock"
        );
        _;
    }

    modifier isDistributing() {
        require(distributionsOn == true, "Distributions are off");
        _;
    }

    /* ========== VIEWS ========== */

    // Current weekly reward amount
    function currentReward(address gaugeAddress) public view returns (uint256 rewardAmount) {
        uint256 relWeight = gaugeController.gaugeRelativeWeight(gaugeAddress, block.timestamp);
        uint256 rewardRate = (gaugeController.globalEmissionRate()).mul(relWeight).div(1e18);

        rewardAmount = rewardRate.mul(ONE_WEEK);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    // Callabe by anyone
    function distributeReward(address gaugeAddress)
        public
        isDistributing
        nonReentrant
        returns (uint256 weeksElapsed, uint256 rewardTally)
    {
        require(gaugeWhitelist[gaugeAddress], "Gauge not whitelisted");

        // Calculate the elapsed time in weeks.
        uint256 lastTimePaid = lastTimeGaugePaid[gaugeAddress];

        // Edge case for first reward for this gauge
        if (lastTimePaid) {
            weeksElapsed = 1;
        } else {
            // Truncation desired
            weeksElapsed = (block.timestamp).sub(lastTimeGaugePaid[gaugeAddress]);

            // Return early here for 0 weeks instead of throwing, as it could have bad effects in other contracts
            if (weeksElapsed == 0) {
                return (0, 0);
            }
        }

        // NOTE: This will always use the current global_emission_rate()
        rewardTally = 0;
        for (uint256 i = 0; i < (weeksElapsed); i++) {
            uint256 relWeightAtWeek;
            if (i == 0) {
                // Mutative, for the current week. Makes sure the weight is checkpointed. Also returns the weight.
                relWeightAtWeek = gaugeController.gaugeRelativeWeightWrite(gaugeAddress, block.timestamp);
            } else {
                // View
                relWeightAtWeek = gaugeController.gaugeRelativeWeight(
                    gaugeAddress,
                    (block.timestamp).sub(ONE_WEEK * i)
                );
            }

            uint256 rewardRateAtWeek = (gaugeController.globalEmissionRate()).mul(relWeightAtWeek).div(1e18);
            rewardTally = rewardTally.add(rewardRateAtWeek.mul(ONE_WEEK));
        }

        // Update the last time paid
        lastTimeGaugePaid[gaugeAddress] = block.timestamp;

        TransferHelper.safeTransfer(rewardTokenAddress, gaugeAddress, rewardTally);

        emit RewardDistributed(gaugeAddress, rewardTally);
    }

    /* ========== RESTRICTIVE FUNCTIONS ========== */

    // For emergency situations
    function toggleDistributions() external onlyByOwnerOrCuratorOrGovernance {
        distributionsOn = !distributionsOn;

        emit DistributionsToggled(distributionsOn);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyByOwnGov {
        // Only the owner address can ever receive the recovery withdrawal
        TransferHelper.safeTransfer(tokenAddress, tokenAmount);
        emit RecoveredERC20(tokenAddress, tokenAmount);
    }

    function setGaugeState(address _gaugeAddress, bool isActive) external onlyByOwnGov {
        gaugeWhitelist[_gaugeAddress] = isActive;
        emit GaugeStateChanged(_gaugeAddress, isActive);
    }

    function setTimelock(address newTimeLock) external onlyByOwnGov {
        timelockAddress = newTimeLock;
    }

    function setCurator(address newCuratorAddress) external onlybyOwnGov {
        curatorAddress = newCuratorAddress;
    }

    function setGaugeController(address _gaugeControllerAddress) external onlyByOwnGov {
        gaugeController = GaugeController(_gaugeControllerAddress);
    }

    /* ========== EVENTS ========== */

    event RewardDistributed(address indexed _gaugeAddress, uint256 rewardAmount);
    event RecoveredERC20(address token, uint256 amount);
    event GaugeStateChanged(address _gaugeAddress, bool isActive);
    event DistributionsToggled(bool distibutionsState);
}
