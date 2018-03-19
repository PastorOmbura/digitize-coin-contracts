pragma solidity ^0.4.18;

import "../interfaces/PICOPSCertifier.sol";

contract PicopsMock is PICOPSCertifier {

	mapping(address => bool) certs;

	function certified(address _who) public constant returns (bool) { 
		return certs[_who]; 
	}

	function add(address _who) public {
		certs[_who] = true;
	}

	function remove(address _who) public {
		certs[_who] = false;
	}
}
