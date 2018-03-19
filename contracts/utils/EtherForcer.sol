pragma solidity ^0.4.18;

/**
 * @dev Sample contract to force ether into other contract on selfdestruct
 */
contract EtherForcer {

	event Forced(address to, uint256 amount);

	function EtherForcer() payable public {}

	function forceEther(address _where) public {
		Forced(_where, this.balance);
		selfdestruct(_where);
	}
}