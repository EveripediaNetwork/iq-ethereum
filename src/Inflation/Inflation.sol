// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Inflation is Ownable {
    IERC20 private _iQ;
    uint256 public _lastClaimed;
    Reward[] public _rewards;

    struct Reward {
        address destination;
        uint256 emissionsPerSecond;
    }

    event Inflate(address _destination, uint256 _amount);

    constructor(IERC20 iQ, Reward[] memory rewards) public Ownable() {
        _iQ = iQ;
        _lastClaimed = block.timestamp;
        uint rewardsLength = rewards.length;
        for (uint i = 0; i < rewardsLength; i++) {
            _rewards.push(rewards[i]);
        }
    }

    function inflate() external {
        uint rewardsLength = _rewards.length;
        uint currentTimestamp = block.timestamp;
        uint diffSeconds = currentTimestamp - _lastClaimed;
        require(diffSeconds > 600, "maximum one call each 10 minutes");
        for (uint i = 0; i < rewardsLength; i++) {
            Reward memory reward = _rewards[i];
            uint emission = reward.emissionsPerSecond * diffSeconds;
            require(_iQ.transfer(reward.destination, emission), "Transfer has failed");
            emit Inflate(reward.destination, emission);
        }
        _lastClaimed = currentTimestamp;
    }

    function changeInflation(Reward[] memory rewards) external onlyOwner {
        delete _rewards;
        for (uint i = 0; i < rewards.length; i++) {
            _rewards.push(rewards[i]);
        }
    }

    function rescue(uint256 _amount) external onlyOwner {
        require(_iQ.transfer(msg.sender, _amount), "Transfer has failed");
    }
}
