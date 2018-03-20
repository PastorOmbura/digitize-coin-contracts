# Digitize Coin Contracts

https://digitizecoin.com

## Bug Bounty

There is 500k of Digitize Tokens put aside for this bounty. Majority of it will be paid out for bugs that would result in the loss of ethers and/or tokens. The bug bounty runs until 2 of April 2018. Email radek *at* startonchain.com if you find anything. If you'd like to perform a regular audit email your portfolio and a quote.

Some other rules:
* Bugs that have already been submitted by another user or are already known to us are not eligible for bounty rewards.
* Public disclosure of a vulnerability makes it ineligible for a bounty.
* You can deploy the contracts on your private chain for bug hunting. Please respect the Ethereum Mainnet and Testnet and refrain from attacking them.
* The value of rewards paid out will depend on the severity of the bugs found. Determinations of this amount is at the sole and final discretion of DigitizeCoin team but they will be fair.

Notes: All contracts will be deployed with the latest version of the Solidity compiler, currently `0.4.21`.

## Tests

```
  Contract: DigitizeCoinPresale
    ✓ Fresh contract has correct initial values (258ms)
    ✓ Invalid arguments for contructor are caught (310ms)
    ✓ Whitelist works as expected (198ms)
    ✓ Updating Picops works as expected (147ms)
    ✓ Picops KYC works (123ms)
    ✓ Buy tokens happy path without kyc (1688ms)
    ✓ A single wallet without kyc cannot contribute in total more than allowed (1072ms)
    ✓ Buy tokens happy path with kyc (1532ms)
    ✓ Buy tokens, ether overpayment triggers refund (1373ms)
    ✓ Try to finalize the sale before it finished (353ms)
    ✓ Softcap not reached, users can refund (1194ms)
    ✓ Cannot contribute before or after the sale (810ms)
    ✓ Can withdraw erc20 tokens and forced ether after the sale ended (1168ms)

  Contract: DigitizeCoin
    ✓ Fresh token has correct initial values (85ms)
    ✓ Can transfer tokens to any address when allowed (147ms)
    ✓ Can only transfer when granted right before transfers enabled (383ms)
    ✓ Once transfers enabled cannot change transfer rights (107ms)
    ✓ Only valid token transfers succeed (83ms)
    ✓ Allowed third party can transfer tokens on ones behalf (288ms)
    ✓ Increasing and decreasing approval works correctly (280ms)
    ✓ Anyone can burn tokens (148ms)
    ✓ token refuses to accept ether transfers (120ms)
    ✓ Only owner can withdraw arbitrary tokens sent to this token (316ms)
    ✓ ApproveAndCall works correctly (326ms)
    ✓ Emergency ether withdrawal works (467ms)
    ✓ Can transfer ownership works as expected (198ms)

  Contract: RefundVault
    ✓ Fresh vault has correct initial values (59ms)
    ✓ Refunding works as expected, only owner can deposit (875ms)
    ✓ Closing works as expected (371ms)
    ✓ Cannot deposit to, enable or close the valut when it is not Active (128ms)

  Contract: TokenVesting
    ✓ Fresh contract has correct initial values (62ms)
    ✓ Invalid initial values are handled properly (65ms)
    ✓ Cannot be released before cliff (41ms)
    ✓ Should release proper amount after cliff (441ms)
    ✓ Should linearly release tokens during vesting period (2097ms)
    ✓ Should have released all after end (316ms)

  36 passing (30s)
```

## Coverage

```
--------------------------|----------|----------|----------|----------|----------------|
File                      |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
--------------------------|----------|----------|----------|----------|----------------|
 contracts/               |      100 |      100 |      100 |      100 |                |
  DigitizeCoin.sol        |      100 |      100 |      100 |      100 |                |
  DigitizeCoinPresale.sol |      100 |      100 |      100 |      100 |                |
  Ownable.sol             |      100 |      100 |      100 |      100 |                |
  RefundVault.sol         |      100 |      100 |      100 |      100 |                |
  TokenVesting.sol        |      100 |      100 |      100 |      100 |                |
--------------------------|----------|----------|----------|----------|----------------|
All files                 |      100 |      100 |      100 |      100 |                |
--------------------------|----------|----------|----------|----------|----------------|
```
