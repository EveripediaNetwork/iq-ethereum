// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IhiIQ {
    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
    }
    function user_point_epoch(address addr) external view returns (uint256);
    function epoch() external view returns (uint256);
    function user_point_history(address addr, uint256 loc) external view returns (Point memory); // TODO: or calldata?
    function point_history(uint256 loc) external view returns (Point memory); // TODO: or calldata?
    function checkpoint() external;
}

contract FeeDistributor is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== EVENTS ========== */

    event ToggleAllowCheckpointToken(bool toggleFlag);
    event CheckpointToken(uint256 time, uint256 tokens);
    event RecoveredERC20(address token, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount, uint256 claimEpoch, uint256 maxEpoch);

    /* ========== STATE VARIABLES ========== */

    // Instances
    IhiIQ private hiIQ;
    IERC20 public token;

    // Constants
    uint256 private constant WEEK = 7 * 86400;
    uint256 private constant TOKEN_CHECKPOINT_DEADLINE = 86400;

    // Period related
    uint256 public startTime;
    uint256 public timeCursor;
    mapping(address => uint256) public timeCursorOf;
    mapping(address => uint256) public userEpochOf;

    uint256 public lastTokenTime;
    uint256[] public tokensPerWeek;

    uint256 public totalReceived;
    uint256 public tokenLastBalance;

    uint256[] public hiIQSupply;

    bool public canCheckPointToken;

    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(address _hiIQAddress, address _token, uint256 _startTime) {
        uint256 t = _startTime / WEEK * WEEK;
        startTime = t;
        lastTokenTime = t;
        timeCursor = t;
        token = IERC20(_token);
        hiIQ = IhiIQ(_hiIQAddress);
    }

    /* ========== VIEWS ========== */

    function max(uint a, uint b) private pure returns (uint) {
        return a > b ? a : b;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function checkpointToken() external {
        require(msg.sender == owner() || (canCheckPointToken && (block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)), "Can't checkpoint token!");
        _checkPointToken();
    }

    function _checkPointToken() internal {
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 toDistribute = tokenBalance - tokenLastBalance;
        tokenLastBalance = tokenBalance;
        uint256 t = lastTokenTime;
        uint256 sinceLast = block.timestamp - t;
        lastTokenTime = block.timestamp;
        uint256 thisWeek = t / WEEK * WEEK;
        uint256 nextWeek = 0;

        for (uint i=0; i<20; i++) { // TODO: range(20) includes 20 ?
            nextWeek = thisWeek + WEEK;
            if (block.timestamp < nextWeek) {
                if (sinceLast == 0 && block.timestamp == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += toDistribute * (block.timestamp - t) / sinceLast;
                }
                break;
            } else {
                if (sinceLast == 0 && nextWeek == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += toDistribute * (nextWeek - t) / sinceLast;
                }
            }
            t = nextWeek;
            thisWeek = nextWeek;
        }
        emit CheckpointToken(block.timestamp, toDistribute);
    }

    function _findTimestampEpoch(uint256 _timestamp) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = hiIQ.epoch();
        for (uint i=0; i<128; i++) { // TODO: same than before
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            Point memory pt = hiIQ.point_history(_mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _findTimestampUserEpoch(address _user, uint256 _timestamp, uint256 _maxUserEpoch) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = _maxUserEpoch;
        for (uint i=0; i<128; i++) { // TODO: same than before
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            Point memory pt = hiIQ.user_point_history(_user, _mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _hiIQForAt(address _user, uint256 _timestamp) external view returns (uint256) {
        uint256 maxUserEpoch = hiIQ.user_point_epoch(_user);
        uint256 epoch = _findTimestampUserEpoch(_user, _timestamp, maxUserEpoch);
        Point memory pt = hiIQ.user_point_history(_user, epoch);
        return uint256(max(pt.bias - pt.slope * uint128(_timestamp - pt.ts), 0));
    }

    function checkpointTotalSupply() external {
        _checkPointTotalSupply();
    }

    function _checkPointTotalSupply() internal {
        uint256 t = timeCursor;
        uint256 roundedTimestamp = block.timestamp / WEEK * WEEK;
        hiIQ.checkpoint();

        for (uint i=0; i<20; i++) {
            if (t > roundedTimestamp) {
                break;
            } else {
                uint256 epoch = _findTimestampEpoch(t);
                Point memory pt = hiIQ.point_history(epoch);
                int128 dt = 0;
                if (t > pt.ts) {
                    dt = int128(t - pt.ts);
                }
                hiIQSupply[t] = uint256(max(pt.bias - pt.slope * dt, 0));
            }
            t += WEEK;
        }
        timeCursor = t;
    }

    // TODO claim

    /* ========== RESTRICTED FUNCTIONS ========== */

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        token.transfer(owner(), tokenAmount);
        emit RecoveredERC20(tokenAddress, tokenAmount);
    }
}
