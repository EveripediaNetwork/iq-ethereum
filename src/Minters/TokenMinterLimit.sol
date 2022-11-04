// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;

import "../Interfaces/IMinter.sol";
import "../Interfaces/IIQERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenMinterLimit is IMinter {
    IIQERC20 private _iQ;
    IERC20 private _wrappedIQ;
    uint256 public _limitWrappedTokens;
    uint256 public _currentWrappedTokens;
    bool internal locked;

    modifier blockReentrancy {
        require(!locked, "Contract is locked");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        IIQERC20 iQ,
        IERC20 wrappedIQ,
        uint256 limit
    ) {
        _iQ = iQ;
        _wrappedIQ = wrappedIQ;
        _limitWrappedTokens = limit;
    }

    function mint(uint256 _amount) external override blockReentrancy {
        require(_currentWrappedTokens + _amount <= _limitWrappedTokens, "Limit max tokens");
        _currentWrappedTokens += _amount;
        require(_wrappedIQ.transferFrom(msg.sender, address(this), _amount), "Transfer has failed");
        _iQ.mint(msg.sender, _amount);
        emit Minted(msg.sender, _amount);
    }

    function burn(uint256 _amount) external override blockReentrancy {
        _iQ.burn(msg.sender, _amount);
        _currentWrappedTokens -= _amount;
        require(_wrappedIQ.transfer(msg.sender, _amount), "Transfer has failed");
        emit Burned(msg.sender, _amount);
    }

    function transferWrapped(address _addr, uint256 _amount) external {
        require(msg.sender == Ownable(address(_iQ)).owner(), "Only IQ owner can tranfer wrapped tokens");
        require(address(this) != _iQ.minter(), "Minter is still in use");
        require(_wrappedIQ.transfer(_addr, _amount), "Transfer has failed");
    }

    function setLimitWrappedTokens(uint256 _amount) external {
        require(msg.sender == Ownable(address(_iQ)).owner(), "Only IQ owner can limit wrapped tokens");
        _limitWrappedTokens = _amount;
    }

    function setCurrentWrappedTokens(uint256 _amount) external {
        require(msg.sender == Ownable(address(_iQ)).owner(), "Only IQ owner can set current wrapped tokens");
        _currentWrappedTokens = _amount;
    }

    function iQ() external view override returns (address) {
        return address(_iQ);
    }

    function wrappedIQ() external view override returns (address) {
        return address(_wrappedIQ);
    }
}

abstract contract Ownable {
    function owner() public view virtual returns (address);
}
