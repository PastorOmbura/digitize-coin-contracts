pragma solidity ^0.4.19;

import "./utils/SafeMath.sol";
import "./Ownable.sol";

// ----------------------------------------------------------------------------
// RefundVault for 'Digitize Coin' project imported from:
// https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/crowdsale/distribution/utils/RefundVault.sol
//
// Radek Ostrowski / http://startonchain.com / https://digitizecoin.com 
// ----------------------------------------------------------------------------

/**
 * @title RefundVault
 * @dev This contract is used for storing funds while a crowdsale
 * is in progress. Supports refunding the money if crowdsale fails,
 * and forwarding it to destination wallet if crowdsale is successful.
 */
contract RefundVault is Ownable {
  using SafeMath for uint256;

  enum State { Active, Refunding, Closed }

  mapping (address => uint256) public deposited;
  address public wallet;
  State public state;

  event Closed();
  event RefundsEnabled();
  event Refunded(address indexed _beneficiary, uint256 _weiAmount);

  /**
   * @param _wallet Final vault address
   */
  function RefundVault(address _wallet) public {
    require(_wallet != address(0));
    wallet = _wallet;
    state = State.Active;
  }

  /**
   * @param _contributor Contributor address
   */
  function deposit(address _contributor) onlyOwner public payable {
    require(state == State.Active);
    deposited[_contributor] = deposited[_contributor].add(msg.value); 
  }

  function close() onlyOwner public {
    require(state == State.Active);
    state = State.Closed;
    Closed();
    wallet.transfer(this.balance);
  }

  function enableRefunds() onlyOwner public {
    require(state == State.Active);
    state = State.Refunding;
    RefundsEnabled();
  }

  /**
   * @param _contributor Contributor address
   */
  function refund(address _contributor) public {
    require(state == State.Refunding);
    uint256 depositedValue = deposited[_contributor];
    require(depositedValue > 0);
    deposited[_contributor] = 0;
    _contributor.transfer(depositedValue);
    Refunded(_contributor, depositedValue);
  }
}