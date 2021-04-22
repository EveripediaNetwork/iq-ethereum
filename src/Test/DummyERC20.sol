// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.1;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyERC20 is ERC20 {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("Test Token", "TEST") {}

    function mint(address _addr, uint256 _amount) external {
        _mint(_addr, _amount);
    }
}
