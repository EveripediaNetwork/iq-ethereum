// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.13;
pragma experimental ABIEncoderV2;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/// @title Inflation
/// @author kesar.eth
/// @notice A contract for inflation
contract Inflation {
    /// -----------------------------------------------------------------------
    /// Errors
    /// -----------------------------------------------------------------------

    error MaxOneCallEachTenMinutes();
    error TransferFailed();
    error NotOwner();

    /// -----------------------------------------------------------------------
    /// Events
    /// -----------------------------------------------------------------------

    event Inflate(address indexed _destination, uint256 _amount);

    /// -----------------------------------------------------------------------
    /// Storage variables
    /// -----------------------------------------------------------------------

    uint256 private _lastClaimed;
    Reward[] private _rewards;
    address private _owner;

    /// -----------------------------------------------------------------------
    /// Immutable parameters
    /// -----------------------------------------------------------------------

    IERC20 immutable _iQ;
    uint256 constant MIN_AMOUNT_INFLATE = 600;

    /// -----------------------------------------------------------------------
    /// Structs
    /// -----------------------------------------------------------------------

    struct Reward {
        address destination;
        uint256 emissionsPerSecond;
    }

    /// -----------------------------------------------------------------------
    /// Modifiers
    /// -----------------------------------------------------------------------

    modifier onlyOwner() {
        if (_owner != msg.sender) {
            revert NotOwner();
        }
        _;
    }

    /// -----------------------------------------------------------------------
    /// Constructor
    /// -----------------------------------------------------------------------

    constructor(IERC20 iQ, Reward[] memory rewards, address owner) {
        _iQ = iQ;
        _lastClaimed = block.timestamp;
        _owner = owner;
        uint256 rewardsLength = rewards.length;
        for (uint256 i = 0; i < rewardsLength; i++) {
            _rewards.push(rewards[i]);
        }
    }

    /// -----------------------------------------------------------------------
    /// External functions
    /// -----------------------------------------------------------------------

    function inflate() external {
        uint256 rewardsLength = _rewards.length;
        uint256 currentTimestamp = block.timestamp;
        uint256 diffSeconds = currentTimestamp - _lastClaimed;
        if (diffSeconds <= MIN_AMOUNT_INFLATE) {
            revert MaxOneCallEachTenMinutes();
        }
        _lastClaimed = currentTimestamp;
        for (uint256 i = 0; i < rewardsLength; i++) {
            Reward memory reward = _rewards[i];
            uint256 emission = reward.emissionsPerSecond * diffSeconds;
            if (_iQ.transfer(reward.destination, emission) == false) {
                revert TransferFailed();
            }
            emit Inflate(reward.destination, emission);
        }
    }

    function changeInflation(Reward[] memory rewards) external onlyOwner {
        delete _rewards;
        for (uint256 i = 0; i < rewards.length; i++) {
            _rewards.push(rewards[i]);
        }
    }

    function rescue(IERC20 erc20, uint256 _amount) external onlyOwner {
        if (erc20.transfer(msg.sender, _amount) == false) {
            revert TransferFailed();
        }
    }

    function transferOwnership(address newOwner) public onlyOwner {
        _owner = newOwner;
    }

    /// -----------------------------------------------------------------------
    /// Getters
    /// -----------------------------------------------------------------------

    function rewards() external view returns (Reward[] memory) {
        return _rewards;
    }

    function lastClaimed() external view returns (uint256) {
        return _lastClaimed;
    }

    function owner() external view returns (address) {
        return _owner;
    }
}
