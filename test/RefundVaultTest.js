const RefundVault = artifacts.require("./RefundVault.sol");

let owner;
let user1;
let user2;
let wallet;
let vault;

var state = {
  Active: 0,
  Refunding: 1,
  Closed: 2,
};
let oneEther = web3.toWei("1", 'ether');
let twoEthers = web3.toWei("2", 'ether');
let threeEthers = web3.toWei("3", 'ether');

contract('RefundVault', (accounts) => {

    beforeEach(async () => {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        wallet = accounts[3];

        vault = await RefundVault.new(wallet);
    });

	/**
	 * Helper functions
	 */
	function expectRevert(e, msg) {
	    assert(e.message.search('revert') >= 0, msg);
	}
	
	//gas difference
	function assertNearlyEqual(a, b, msg) {
	    let diff = Math.abs(a - b);
	    let eps = web3.toWei("0.003", 'ether');
	    assert(diff < eps, msg);
	}

    it("Fresh vault has correct initial values", async () => {
        assert(wallet == await vault.wallet.call(), "wallet");
        assert(state.Active == await vault.state.call(), "state");

        try {
        	await RefundVault.new('0x0');
        	assert(false);
        } catch (e) {
        	expectRevert(e, "cannot create vault with address(0)");
        }
    });

    it("Refunding works as expected, only owner can deposit", async () => {
    	let user1BalanceBefore = (await web3.eth.getBalance(user1)).toNumber();
    	await vault.deposit(user1, {from: owner, value: oneEther});
    	assert(oneEther == await vault.deposited.call(user1));

    	let user2BalanceBefore = (await web3.eth.getBalance(user2)).toNumber();
    	await vault.deposit(user2, {from: owner, value: twoEthers});
		assert(twoEthers == await vault.deposited.call(user2));

		try {
			await vault.refund(user1);
			assert(false);
		} catch (e) {
			expectRevert(e, 'refunds not enabled yet');
		}

    	await vault.enableRefunds();
     	assert(state.Refunding == await vault.state.call(), "state");

    	await vault.refund(user1);
    	let user1BalanceAfter = (await web3.eth.getBalance(user1)).toNumber();
    	assertNearlyEqual(user1BalanceAfter - user1BalanceBefore, oneEther, "user1 received refund");

    	await vault.refund(user2, {from: user2});
    	let user2BalanceAfter = (await web3.eth.getBalance(user2)).toNumber();
		assertNearlyEqual(user2BalanceAfter - user2BalanceBefore, twoEthers, "user2 received refund");

		try {
			await vault.deposit(user1, {from: user1, value: twoEthers});
			assert(false);
		} catch (e) {
			expectRevert(e, "only owner can deposit");
		}

		try {
			await vault.refund(owner);
			assert(false);
		} catch (e) {
			expectRevert(e, "cannot refund when empty balance");
		}
    });

    it("Closing works as expected", async () => {
    	let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();

    	await vault.deposit(user1, {from: owner, value: oneEther});
    	assert(oneEther == await vault.deposited.call(user1));

    	await vault.deposit(user2, {from: owner, value: twoEthers});
		assert(twoEthers == await vault.deposited.call(user2));

    	await vault.close();
     	assert(state.Closed == await vault.state.call(), "state");

     	let walletBalanceAfter = (await web3.eth.getBalance(wallet)).toNumber();
     	assert(walletBalanceAfter - walletBalanceBefore == threeEthers, "wallet balance");
    });

    it("Cannot deposit to, enable or close the valut when it is not Active", async () => {
    	await vault.enableRefunds();
     	assert(state.Refunding == await vault.state.call(), "state");
		try {
			await vault.enableRefunds();
			assert(false);
		} catch (e) {
			expectRevert(e, "cannot enableRefunds, already enabled");
		}
		try {
			await vault.close();
			assert(false);
		} catch (e) {
			expectRevert(e, "cannot close, already enabled");
		}
		try {
			await vault.deposit(user1, {value: twoEthers});
			assert(false);
		} catch (e) {
			expectRevert(e, "cannot deposit, already enabled");
		}
    });

});
