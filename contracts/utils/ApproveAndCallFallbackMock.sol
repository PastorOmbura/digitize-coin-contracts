pragma solidity ^0.4.19;

import "../interfaces/CutdownToken.sol";
import "../interfaces/ApproveAndCallFallback.sol";

contract ApproveAndCallFallbackMock is ApproveAndCallFallback{

	event ReceivedApproval(address _from, uint256 _amount, address _tokenContract, bytes _data);

	address public from;
	uint256 public amount;
	address public tokenContract;
	bytes public data;
	
	function receiveApproval(address _from, uint256 _amount, address _tokenContract, bytes _data) public returns (bool) {
		require(_amount <= CutdownToken(_tokenContract).allowance(_from, address(this)));
		from = _from;
		amount = _amount;
		tokenContract = _tokenContract;
		data = _data;

		ReceivedApproval(from, amount, tokenContract, data);
		return true;
	}
}