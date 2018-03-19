const TokenVesting = artifacts.require("./TokenVesting.sol");
const DigitizeCoin = artifacts.require("./DigitizeCoin.sol");

let owner;
let beneficiary;
//let user2;

let vesting;
let token;
let amount = 1000;

let startTime;
let cliffInDays = 10;
let cliffInSeconds = cliffInDays * 24 * 60 * 60;
let durationInDays = 100;
let durationInSeconds = durationInDays * 24 * 60 * 60;

contract('TokenVesting', (accounts) => {

    beforeEach(async () => {
        owner = accounts[0];
        beneficiary = accounts[1];
        //user2 = accounts[2];

        startTime = getCurrentTimestamp();
        vesting = await TokenVesting.new(beneficiary, startTime, cliffInDays, durationInDays);

        token = await DigitizeCoin.new();
		await token.enableTransfers();
        await token.transfer(vesting.address, amount);
    });

	/**
	 * Helper functions
	 */
	function expectRevert(e, msg) {
	    assert(e.message.search('revert') >= 0, msg);
	}

	function toTime(t) {
	    return Math.round(t.getTime() / 1000);
	}
	
	function getCurrentBlock() {
	    return web3.eth.getBlock(web3.eth.blockNumber);
	}
	
	function getCurrentTimestamp() {
	    return getCurrentBlock().timestamp;
	}
	
	/**
	 *  Increase time of TestRPC node and force next block to be mint.
	 *  Mining is required because only next block will have increased time.
	 */
	function increaseTime(addSeconds) {
	    web3.currentProvider.send({
	        jsonrpc: "2.0", 
	        method: "evm_increaseTime", 
	        params: [addSeconds], 
	        id: 0
	    });
	    web3.currentProvider.send({
	        jsonrpc: "2.0", 
	        method: "evm_mine", 
	        params: [], 
	        id: 0
	    });
	}

	function increaseTimeTo(target) {
  		let now = getCurrentTimestamp();
  		let diff = target - now;
  		return increaseTime(diff);
	}

    it("Fresh contract has correct initial values", async () => {
    	assert(await vesting.beneficiary.call() == beneficiary, "beneficiary");
    	assert(await vesting.start.call() == startTime, "startTime");
    	assert(await vesting.cliff.call() == startTime + cliffInSeconds, "cliff");
    	assert(await vesting.duration.call() == durationInSeconds, "duration");
    	assert(await vesting.released.call(beneficiary) == 0, "released");
    });

    it("Invalid initial values are handled properly", async () => {
    	try {
    		await TokenVesting.new('0x0', startTime, cliffInDays, durationInDays);
    		assert(false);
    	} catch(e) {
    		expectRevert(e, "Cannot use address(0)");
    	}
    	try {
    		await TokenVesting.new(beneficiary, startTime, 1, 0);
    		assert(false);
    	} catch(e) {
    		expectRevert(e, "Cliff must be <= duration");
    	}
    });

  	it('Cannot be released before cliff', async function () {
  	  try {
  	  	await vesting.release(token.address);
  	  	assert(false);
  	  } catch (e) {
  	  	expectRevert(e, "Cannot release before cliff");
  	  }
  	});
	
  	it('Should release proper amount after cliff', async function () {
  		await increaseTime(cliffInSeconds);
  		const receipt = await vesting.release(token.address);
  		const releaseTime = (await web3.eth.getBlock(receipt.receipt.blockNumber)).timestamp;
		const vestingBalance = await token.balanceOf(vesting.address);
  	  	const balance = await token.balanceOf(beneficiary);
  	  	const expectedVesting = Math.floor(amount * (releaseTime - startTime) / durationInSeconds);
  	  	assert(balance.toNumber() == expectedVesting, "balance matches");
  	});

	it('Should linearly release tokens during vesting period', async function () {
	   const vestingPeriod = durationInSeconds - cliffInSeconds;
	   const checkpoints = 4;

	   for (let i = 1; i <= checkpoints; i++) {
	     const checkpoint = i * (vestingPeriod / checkpoints);
	     const now = startTime + cliffInSeconds + checkpoint;
	     await increaseTimeTo(now);
	     await vesting.release(token.address);
	     const balance = await token.balanceOf(beneficiary);
	     const expectedVesting = Math.floor(amount * (now - startTime) / durationInSeconds);
	     assert(balance.toNumber() == expectedVesting, "vesting matches");
	   }
	});

	it('Should have released all after end', async function () {
	    await increaseTime(durationInSeconds);
	    await vesting.release(token.address);
	    const balance = await token.balanceOf(beneficiary);
	    assert (balance.toNumber() == amount, "all released");
	});

});