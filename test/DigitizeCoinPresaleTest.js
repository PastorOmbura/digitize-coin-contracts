const DigitizeCoin = artifacts.require("./DigitizeCoin.sol");
const DigitizeCoinPresale = artifacts.require("./DigitizeCoinPresale.sol");
const RefundVault = artifacts.require("./RefundVault.sol");
const Picops = artifacts.require("./utils/PicopsMock.sol");
const EtherForcer = artifacts.require("./utils/EtherForcer.sol");

let owner;
let user1;
let user2;
let wallet;

let presale;
let token;
let picops;

let contributionGas = 300000;
let totalSupply = web3.toWei("200000000", 'ether');
let moreThenTotalSupply = web3.toWei("200000001", 'ether');
let halfEther = web3.toWei("0.5", 'ether');
let oneEther = web3.toWei("1", 'ether');
let twoEthers = web3.toWei("2", 'ether');
let fiveEthers = web3.toWei("5", 'ether');
let tenEthers = web3.toWei("10", 'ether');

let rate = 6667;
let softCap = web3.toWei("1", 'ether');
var state = {
  Active: 0,
  Refunding: 1,
  Closed: 2,
};
let startTime;
let endTime;

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

/**
 * Tests
 */
 
contract('DigitizeCoinPresale', (accounts) => {

    beforeEach(async () => {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        wallet = accounts[3];

        startTime = getCurrentTimestamp() + 1;
        let nowPlusOneDay = new Date(startTime * 1000);
        nowPlusOneDay.setDate(nowPlusOneDay.getDate() + 1);
        endTime = toTime(nowPlusOneDay);

        token = await DigitizeCoin.new();
        picops = await Picops.new();
        presale = await DigitizeCoinPresale.new(startTime, 1, softCap, wallet, token.address, picops.address);
    });

    it("Fresh contract has correct initial values", async () => {
        assert(rate == (await presale.rate.call()).toNumber(), "rate");
        assert(softCap == (await presale.softCap.call()), "softCap");
        assert(!(await presale.softCapReached.call()), "softCapReached");
        assert(!(await presale.hardCapReached.call()), "hardCapReached");
        assert(!(await presale.hasEnded.call()), "hasEnded");
        assert(startTime == (await presale.startTime.call()).toNumber(), "startTime");
        assert(endTime == (await presale.endTime.call()).toNumber(), "endTime");
        assert(token.address == await presale.token.call(), "token");
        assert(picops.address == await presale.picopsCertifier.call(), "picops");
       
        let refundVaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(refundVaultAddress);
        assert(wallet == await refundVault.wallet.call(), "wallet");
        assert(state.Active == await refundVault.state.call(), "state");
    });

    it("Invalid arguments for contructor are caught", async () => {
        try {
            await DigitizeCoinPresale.new(startTime - 100, 1, softCap, wallet, token.address, picops.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "invalid startTime");
        }
        try {
            await DigitizeCoinPresale.new(startTime, 0, softCap, wallet, token.address, picops.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "invalid endTime");
        }
        try {
            await DigitizeCoinPresale.new(startTime, 1, softCap, '0x0', token.address, picops.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "invalid wallet address");
        }
        try {
            await DigitizeCoinPresale.new(startTime, 1, softCap, wallet, '0x0', picops.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "invalid token address");
        }
        try {
            await DigitizeCoinPresale.new(startTime, 1, softCap, wallet, token.address, '0x0');
            assert(false);
        } catch (e) {
            expectRevert(e, "invalid picops address");
        }
    });

    it("Whitelist works as expected", async () => {
        assert(!(await presale.whitelist.call(user1)), "not on whitelist");
        assert(!(await presale.whitelist.call(user2)), "not on whitelist");
        await presale.addToWhitelist([user1, user2]);
        assert(await presale.whitelist.call(user1), "on whitelist");
        assert(await presale.whitelist.call(user2), "on whitelist");
        await presale.removeFromWhitelist([user1]);
        assert(!(await presale.whitelist.call(user1)), "not on whitelist");
        assert(await presale.whitelist.call(user2), "on whitelist");
    });

    it("Updating Picops works as expected", async () => {
        let picops2 = await Picops.new();

        await presale.setPicopsCertifier(picops2.address);
        assert(picops2.address == await presale.picopsCertifier.call(), "picops");

        try {
            await presale.setPicopsCertifier(picops2.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "Cannot update to the same address");
        }
    });

    it("Picops KYC works", async () => {
        assert(!(await presale.passedKYC.call(user1)), "no kyc");
        await picops.add(user1);
        assert(await presale.passedKYC.call(user1), "kyc");
        await picops.remove(user1);
        assert(!(await presale.passedKYC.call(user1)), "no kyc");
    });

    it("Buy tokens happy path without kyc", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * twoEthers; //6000
        let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await presale.addToWhitelist([user1, user2]);

        //move to start time
        increaseTime(1);
        var tx1 = {from: user1, to: presale.address, value: oneEther, gas: contributionGas};
        await web3.eth.sendTransaction(tx1);

        assert(rate * oneEther == (await token.balanceOf.call(user1)).toNumber(), "user balance matches");
        assert(saleAmount - (rate * oneEther) == (await token.balanceOf.call(presale.address)).toNumber(), "presale balance matches");
        assert(oneEther == (await web3.eth.getBalance(vaultAddress)).toNumber(), "vault balance matches");
        assert(state.Active == await refundVault.state.call(), "state active");
        assert(await presale.softCapReached.call(), "softCapReached");

        // can't contribute five or more ethers without KYC
        try {
            var tx2 = {from: user1, to: presale.address, value: fiveEthers, gas: contributionGas};
            await web3.eth.sendTransaction(tx2);
            assert(false);
        } catch (e) {
            expectRevert(e, "user cannot contribute >= 5 ether without KYC");
        }

        // buy to exactly get all the tokens
        var tx3 = {from: user2, to: presale.address, value: oneEther, gas: contributionGas};
        await web3.eth.sendTransaction(tx3);

        assert(rate * oneEther == (await token.balanceOf.call(user2)).toNumber(), "user balance matches");
        assert(0 == (await token.balanceOf.call(presale.address)).toNumber(), "presale balance matches");
        assert(twoEthers == (await web3.eth.getBalance(vaultAddress)).toNumber(), "vault balance matches");
        assert(await presale.hardCapReached.call(), "hardCapReached");

        await presale.finalize();
        assert(state.Closed == await refundVault.state.call(), "state closed");

        // users can't refund
        try {
            await presale.claimRefund({from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "Cannot claim refund as softcap is reached");
        }

        let walletBalanceAfter = (await web3.eth.getBalance(wallet)).toNumber();
        assert(walletBalanceAfter - walletBalanceBefore == twoEthers, "wallet balance matches");
    });

    it("A single wallet without kyc cannot contribute in total more than allowed", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * tenEthers; //30,000
        let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await presale.addToWhitelist([user1, user2]);

        //move to start time
        increaseTime(1);

        var tx = {from: user1, to: presale.address, value: twoEthers, gas: contributionGas};
        //contribute 2 ether
        await web3.eth.sendTransaction(tx);
        //contribute another 2 ether => 4
        await web3.eth.sendTransaction(tx);

        try {
            //contribute 2 ether => 6, but limit is 5
            await web3.eth.sendTransaction(tx);
            assert(false);
        } catch (e) {
            expectRevert(e, "this transaction would go over allowed anynomous limit");
        }
    });

    it("Buy tokens happy path with kyc", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * tenEthers; //30000
        let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await picops.add(user1);
        await picops.add(user2);
        await presale.addToWhitelist([user1, user2]);

        //move to start time
        increaseTime(1);

        var tx1 = {from: user1, to: presale.address, value: fiveEthers, gas: contributionGas};
        await web3.eth.sendTransaction(tx1);

        assert(rate * fiveEthers == (await token.balanceOf.call(user1)).toNumber(), "user balance matches");
        assert(saleAmount - (rate * fiveEthers) == (await token.balanceOf.call(presale.address)).toNumber(), "presale balance matches");
        assert(fiveEthers == (await web3.eth.getBalance(vaultAddress)).toNumber(), "vault balance matches");
        assert(state.Active == await refundVault.state.call(), "state active");
        assert(await presale.softCapReached.call(), "softCapReached");

        //buy to exactly get all the tokens
        var tx2 = {from: user2, to: presale.address, value: fiveEthers, gas: contributionGas};
        await web3.eth.sendTransaction(tx2);

        assert(rate * fiveEthers == (await token.balanceOf.call(user2)).toNumber(), "user balance matches");
        assert(0 == (await token.balanceOf.call(presale.address)).toNumber(), "presale balance matches");
        assert(tenEthers == (await web3.eth.getBalance(vaultAddress)).toNumber(), "vault balance matches");
        assert(await presale.hardCapReached.call(), "hardCapReached");

        await presale.finalize();
        assert(state.Closed == await refundVault.state.call(), "state closed");

        //users can't refund
        try {
            await presale.claimRefund({from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "Cannot claim refund as softcap is reached");
        }

        let walletBalanceAfter = (await web3.eth.getBalance(wallet)).toNumber();
        assert(walletBalanceAfter - walletBalanceBefore == tenEthers, "wallet balance matches");
    });

    it("Buy tokens, ether overpayment triggers refund", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * oneEther; //3000
        let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();
        let userBalanceBefore = (await web3.eth.getBalance(user1)).toNumber();

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await presale.addToWhitelist([user1]);

        //move to start time
        increaseTime(1);

        var tx = {from: user1, to: presale.address, value: twoEthers, gas: contributionGas};
        await web3.eth.sendTransaction(tx);
        let userBalanceAfter = (await web3.eth.getBalance(user1)).toNumber();

        assertNearlyEqual(userBalanceBefore - userBalanceAfter, oneEther, "user received refund");
        assert(rate * oneEther == (await token.balanceOf.call(user1)).toNumber(), "user token balance matches");
        assert(0 == (await token.balanceOf.call(presale.address)).toNumber(), "presale token balance matches");
        assert(oneEther == (await web3.eth.getBalance(vaultAddress)).toNumber(), "vault balance matches");
        assert(state.Active == await refundVault.state.call(), "state active");

        await presale.finalize();
        assert(state.Closed == await refundVault.state.call(), "state closed");

        let walletBalanceAfter = (await web3.eth.getBalance(wallet)).toNumber();
        assert(walletBalanceAfter - walletBalanceBefore == oneEther, "wallet balance matches");
    });

    it("Try to finalize the sale before it finished", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * oneEther; //3000
        let walletBalanceBefore = (await web3.eth.getBalance(wallet)).toNumber();
        let userBalanceBefore = (await web3.eth.getBalance(user1)).toNumber();

        await token.transfer(presale.address, saleAmount);
 
        try {
            await presale.finalize();
            assert(false);
        } catch (e) {
            expectRevert(e, "Cannot finalize before the sale has ended");
        }        
        assert(state.Active == await refundVault.state.call(), "state active");
    });

    it("Softcap not reached, users can refund", async () => {
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * twoEthers; //6000
        let userBalanceBefore = (await web3.eth.getBalance(user1)).toNumber();        

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await picops.add(user1);
        await presale.addToWhitelist([user1]);

        //move to start time
        increaseTime(1);

        var tx = {from: user1, to: presale.address, value: halfEther, gas: contributionGas};
        await web3.eth.sendTransaction(tx);

        assert(!(await presale.softCapReached.call()), "softcap reached");
        assert(state.Active == await refundVault.state.call(), "state active");

        //move time forward to sale end
        increaseTime(60*60*24+1);

        await presale.finalize();
        assert(state.Refunding == await refundVault.state.call(), "state refunding");

        //users can refund
        await presale.claimRefund({from: user1});
        let userBalanceAfter = (await web3.eth.getBalance(user1)).toNumber();

        assertNearlyEqual(userBalanceAfter, userBalanceBefore, "ether refunded");
    });

    it("Cannot contribute before or after the sale", async () => {
        presale = await DigitizeCoinPresale.new(startTime+10, 1, softCap, wallet, token.address, picops.address);
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * twoEthers; //6000

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);
        await picops.add(user1);
        await presale.addToWhitelist([user1]);

        var tx = {from: user1, to: presale.address, value: halfEther, gas: contributionGas};
        try {
            await web3.eth.sendTransaction(tx);
            assert(false);    
        } catch (e) {
            expectRevert(e, "cannot contribute before sale started");
        }
        
        //move time forward to sale end
        increaseTime(60*60*24+11);

        try {
            await web3.eth.sendTransaction(tx);
            assert(false);    
        } catch (e) {
            expectRevert(e, "cannot contribute before sale ended");
        }
     });

    it("Can withdraw erc20 tokens and forced ether after the sale ended", async () => {
        let otherToken = await DigitizeCoin.new();
        let vaultAddress = await presale.vault.call();
        let refundVault = RefundVault.at(vaultAddress);

        let saleAmount = rate * twoEthers; //6000

        await token.transfer(presale.address, saleAmount);
        await token.grantTransferRight(presale.address);

        //assign other erc20 to the presale
        await otherToken.transfer(presale.address, saleAmount);
        await otherToken.enableTransfers();
        
        //force some ether into the presale
        let etherForcer = await EtherForcer.new({value: 10000});
        assert(10000 == (await web3.eth.getBalance(etherForcer.address)).toNumber());
        await etherForcer.forceEther(presale.address);
        assert(10000 == (await web3.eth.getBalance(presale.address)).toNumber(), "injected some ether");
  
        try {
            await presale.withdrawEther();
            assert(false);
        } catch (e) {
            expectRevert(e, "cannot withdraw ether before sale ends");
        }

        try {
            await presale.withdrawERC20Tokens(otherToken.address);
            assert(false);
        } catch (e) {
            expectRevert(e, "cannot withdraw any erc20 before sale ends");
        }
        
        //move time forward to sale end
        increaseTime(60*60*24+1);

        await presale.withdrawEther();
        assert(0 == (await web3.eth.getBalance(presale.address)).toNumber(), "withdrew injected ether");
        try {
            await presale.withdrawEther({from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "presale balance is 0 so can't withdraw");
        }

        await presale.withdrawERC20Tokens(otherToken.address);
        assert(0 == (await otherToken.balanceOf.call(presale.address)).toNumber());
        try {
            await presale.withdrawERC20Tokens(otherToken.address, {from: owner});    
            assert(false);
        } catch (e) {
            expectRevert(e, "withdrawing fails when zero balance");
        }
     });
});
