pragma solidity ^0.4.19;

/**
 * @title CutdownToken
 * @dev Some ERC20 interface methods used in this contract
 */
contract CutdownToken {
  	function balanceOf(address _who) public view returns (uint256);
  	function transfer(address _to, uint256 _value) public returns (bool);
  	function allowance(address _owner, address _spender) public view returns (uint256);
}
