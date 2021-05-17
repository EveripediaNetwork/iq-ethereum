// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PIQSwap is Ownable {
    IERC20 private _iQ;
    IERC20 private _wrappedIQ;
    bool internal locked;

    modifier blockReentrancy {
        require(!locked, "Contract is locked");
        locked = true;
        _;
        locked = false;
    }

    constructor(IERC20 iQ, IERC20 wrappedIQ) {
        _iQ = iQ;
        _wrappedIQ = wrappedIQ;
    }

    // get IQ / pIQ
    function getIQ(uint256 _amount) external blockReentrancy {
        require(_wrappedIQ.transferFrom(msg.sender, address(this), _amount), "Transfer has failed");
        require(_iQ.transfer(msg.sender, _amount), "Transfer has failed");
    }

    function getpIQ(uint256 _amount) external blockReentrancy {
        require(_iQ.transferFrom(msg.sender, address(this), _amount), "Transfer has failed");
        require(_wrappedIQ.transfer(msg.sender, _amount), "Transfer has failed");
    }

    // Only admin
    function recover(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_token.transfer(_to, _amount), "Transfer has failed");
    }

    // Views
    function iQ() external view returns (address) {
        return address(_iQ);
    }

    function wrappedIQ() external view returns (address) {
        return address(_wrappedIQ);
    }
}
