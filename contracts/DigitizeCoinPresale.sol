pragma solidity ^0.4.19;

import "./DigitizeCoin.sol";
import "./Ownable.sol";
import "./utils/SafeMath.sol";
import "./RefundVault.sol";
import "./interfaces/PICOPSCertifier.sol";

// ----------------------------------------------------------------------------
// 'Digitize Coin Presale' contract: https://digitizecoin.com 
//
// Digitize Coin - DTZ: 0x...
// SoftCap: 600 ether
// HardCap: tokens -> ether -> discount
// KYC: PICOPS
//
// (c) Radek Ostrowski / http://startonchain.com - The MIT Licence.
// ----------------------------------------------------------------------------

/**
 * @title DigitizeCoinPresale
 * @dev Desired amount of DigitizeCoin tokens for this sale must be allocated 
 * to this contract address prior to the sale start
 */
contract DigitizeCoinPresale is Ownable {
  using SafeMath for uint256;

  // token being sold
  DigitizeCoin public token;
  // KYC
  PICOPSCertifier public picopsCertifier;
  // refund vault used to hold funds while crowdsale is running
  RefundVault public vault;

  // start and end timestamps where contributions are allowed (both inclusive)
  uint256 public startTime;
  uint256 public endTime;
  uint256 public softCap;
  bool public hardCapReached;

  mapping(address => bool) public whitelist;

  // how many token units a buyer gets per wei
  uint256 public constant rate = 3000;

  // amount of raised money in wei
  uint256 public weiRaised;

  // amount of total contribution for each address
  mapping(address => uint256) public contributed;

  // minimum amount of ether allowed, inclusive
  uint256 public constant minContribution = 0.1 ether;

  // maximum contribution without KYC, exclusive
  uint256 public constant maxAnonymousContribution = 5 ether;

  /**
   * Custom events
   */
  event TokenPurchase(address indexed _purchaser, uint256 _value, uint256 _tokens);
  event PicopsCertifierUpdated(address indexed _oldCertifier, address indexed _newCertifier);
  event AddedToWhitelist(address indexed _who);
  event RemovedFromWhitelist(address indexed _who);
  event WithdrawnERC20Tokens(address indexed _tokenContract, address indexed _owner, uint256 _balance);
  event WithdrawnEther(address indexed _owner, uint256 _balance);

  // constructor
  function DigitizeCoinPresale(uint256 _startTime, uint256 _durationInDays, 
    uint256 _softCap, address _wallet, address _token, address _picops) public {
    bool validTimes = _startTime >= now && _durationInDays > 0;
    bool validAddresses = _wallet != address(0) && _token != address(0) && _picops != address(0);
    require(validTimes && validAddresses);

    owner = msg.sender;
    startTime = _startTime;
    endTime = _startTime + (_durationInDays * 1 days);
    softCap = _softCap;
    vault = new RefundVault(_wallet);
    token = DigitizeCoin(_token);
    picopsCertifier = PICOPSCertifier(_picops);
  }

  // fallback function used to buy tokens
  function () external payable {
    require(validPurchase());

    address purchaser = msg.sender;
    uint256 weiAmount = msg.value;
    uint256 chargedWeiAmount = weiAmount;
    uint256 tokensAmount = weiAmount.mul(rate);
    uint256 tokensDue = tokensAmount;
    uint256 tokensLeft = token.balances(address(this));

    // if sending more then available, allocate all tokens and refund the rest of ether
    if(tokensAmount > tokensLeft) {
      chargedWeiAmount = tokensLeft.div(rate);
      tokensDue = tokensLeft;
      hardCapReached = true;
    } else if(tokensAmount == tokensLeft) {
      hardCapReached = true;
    }

    weiRaised = weiRaised.add(chargedWeiAmount);
    contributed[purchaser] = contributed[purchaser].add(chargedWeiAmount);
    token.transfer(purchaser, tokensDue);

    // refund if appropriate
    if(chargedWeiAmount < weiAmount) {
      purchaser.transfer(weiAmount - chargedWeiAmount);
    }
    TokenPurchase(purchaser, chargedWeiAmount, tokensDue);

    // forward funds to vault
    vault.deposit.value(chargedWeiAmount)(purchaser);
  }

  /**
   * @dev Checks whether funding soft cap was reached. 
   * @return Whether funding soft cap was reached
   */
  function softCapReached() public view returns (bool) {
    return weiRaised >= softCap;
  }

  // @return true if crowdsale event has ended
  function hasEnded() public view returns (bool) {
    return now > endTime || hardCapReached;
  }

  function hasStarted() public view returns (bool) {
    return now >= startTime;
  }

  /**
   * @dev Contributors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(hasEnded() && !softCapReached());

    vault.refund(msg.sender);
  }

  /**
   * @dev vault finalization task, called when owner calls finalize()
   */
  function finalize() public onlyOwner {
    require(hasEnded());

    if (softCapReached()) {
      vault.close();
    } else {
      vault.enableRefunds();
    }
  }

  // @return true if the transaction can buy tokens
  function validPurchase() internal view returns (bool) {
    bool withinPeriod = hasStarted() && !hasEnded();
    bool validContribution = msg.value >= minContribution;
    bool passKyc = picopsCertifier.certified(msg.sender);
    //check if contributor can possibly go over anonymous contibution limit
    bool anonymousAllowed = contributed[msg.sender].add(msg.value) < maxAnonymousContribution;
    bool allowedKyc = passKyc || anonymousAllowed;
    return withinPeriod && validContribution && allowedKyc;
  }

  // ability to set new certifier even after the sale started
  function setPicopsCertifier(address _picopsCertifier) onlyOwner public  {
    require(_picopsCertifier != address(picopsCertifier));
    PicopsCertifierUpdated(address(picopsCertifier), _picopsCertifier);
    picopsCertifier = PICOPSCertifier(_picopsCertifier);
  }

  function passedKYC(address _wallet) view public returns (bool) {
    return picopsCertifier.certified(_wallet);
  }

  // ability to add to whitelist even after the sale started
  function addToWhitelist(address[] _wallets) public onlyOwner {
    for (uint i = 0; i < _wallets.length; i++) {
      whitelist[_wallets[i]] = true;
      AddedToWhitelist(_wallets[i]);
    }
  }

  // ability to remove from whitelist even after the sale started
  function removeFromWhitelist(address[] _wallets) public onlyOwner {
    for (uint i = 0; i < _wallets.length; i++) {
      whitelist[_wallets[i]] = false;
      RemovedFromWhitelist(_wallets[i]);
    }
  }

  /**
   * @dev Allows to transfer out the ether balance that was forced into this contract, e.g with `selfdestruct`
   */
  function withdrawEther() onlyOwner public {
    require(hasEnded());
    uint256 totalBalance = this.balance;
    require(totalBalance > 0);
    owner.transfer(totalBalance);
    WithdrawnEther(owner, totalBalance);
  }
  
  /**
   * @dev Allows to transfer out the balance of arbitrary ERC20 tokens from the contract.
   * @param _token The contract address of the ERC20 token.
   */
  function withdrawERC20Tokens(CutdownToken _token) onlyOwner public {
    require(hasEnded());
    uint256 totalBalance = _token.balanceOf(address(this));
    require(totalBalance > 0);
    _token.transfer(owner, totalBalance);
    WithdrawnERC20Tokens(address(_token), owner, totalBalance);
  }
}