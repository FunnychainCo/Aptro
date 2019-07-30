const AptroToken = artifacts.require("AptroToken");
const truffleAssert = require('truffle-assertions');
const BN = require('bn.js');
const Web3 = require('web3');
const assert = require("chai").assert;
const web3Interface = new Web3(web3.currentProvider);

function toBytesInt32(num) {
    arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
    view = new DataView(arr);
    view.setUint32(0, num, false); // byteOffset = 0; litteEndian = false
    return arr;
}

const int32ToBytes256 = (num) => {
    let b = new ArrayBuffer(32);
    new DataView(b).setUint32(28, num);
    return Array.from(new Uint8Array(b));
};

function fixSignature(signature) {
    // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
    // signature malleability if version is 0/1
    // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
    let v = parseInt(signature.slice(130, 132), 16);
    if (v < 27) {
        v += 27;
    }
    const vHex = v.toString(16);
    return signature.slice(0, 130) + vHex;
}

async function signAndPrepareToSend(amount, account) {
    let nonce = await new Promise((resolve, reject) => {
        require('crypto').randomBytes(32, async (err, buffer) => {
            resolve(new BN(buffer).toBuffer("be",32));
        })
    });
    let ammountAsBN = new BN(amount,10)
    let ammountAsBuffer = ammountAsBN.toBuffer("be",32);
    for (let i = 0; i < 32; i++) {
        nonce[i] = nonce[i] | ammountAsBuffer[i];
    }
    let hash = web3Interface.utils.sha3("0x"+new BN(nonce).toString("hex",32));
    const signature = fixSignature(await web3.eth.sign(hash, account));
    return {
        account: account,
        amount: amount,
        nonce: nonce,
        signature: signature,
    }
}

contract("AptroToken", accounts => {
    let instance;
    let DECIMAL_MULT = 1000000000000000000;
    let accountA = accounts[0];
    let accountB = accounts[2];
    let accountC = accounts[3];
    let initialDelegate = 10000*DECIMAL_MULT;
    let inittialBalance = 10000*DECIMAL_MULT;


    it("should put 0 AptroToken in the first account", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        //test
        const balance = await instance.balanceOf.call(accountA);
        assert.equal(balance.valueOf(), inittialBalance);
    });

    it("should mint", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        //test
        const result = await instance.mint(accountA, 200, {from: accountA, value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balance = await instance.balanceOf.call(accountA);
            assert.equal(balance.valueOf(), initialDelegate+20);
        });
    });

    it("should delegate", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        await instance.mint(accountA, 200, {from: accountA, value: 0});
        //test
        const result = await instance.delegate(accountB, 150, {from: accountA, value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balanceA = await instance.balanceOf.call(accountA);
            assert.equal(balanceA.valueOf(), initialDelegate + 200 - 150);
            const balanceB = await instance.delegatedBalanceOf.call(accountB);
            assert.equal(balanceB.valueOf(), 150);
        });
    });

    it("should undelegateAndTransferTo", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        await instance.mint(accountA, 200, {from: accountA, value: 0});
        await instance.delegate(accountB, 150, {from: accountA, value: 0});
        //test
        const result = await instance.undelegateAndTransferTo(accountC, 50, {from: accountB, value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balanceA = await instance.balanceOf.call(accountB);
            assert.equal(balanceA.valueOf(), 0);
            const balanceB = await instance.delegatedBalanceOf.call(accountB);
            assert.equal(balanceB.valueOf(), 100);
            const balanceC = await instance.balanceOf.call(accountC);
            assert.equal(balanceC.valueOf(), 50);
            const balanceD = await instance.delegatedBalanceOf.call(accountC);
            assert.equal(balanceD.valueOf(), 0);
        });
    });


    it("should undelegateAndTransferFrom ok", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        //let instance = await AptroToken.deployed();
        await instance.mint(accountA, 2000000, {from: accountA, value: 0});
        await instance.delegate(accountB, 1500000, {from: accountA, value: 0});
        //test
        let amount = 500000;
        let dataToSend = await signAndPrepareToSend(amount, accountB);
        const result = await instance.undelegateAndTransferFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, dataToSend.amount, {
            from: accountC,
            value: 0
        });
        await new Promise((resolve, reject) => {
            truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
                const balanceA = await instance.balanceOf.call(accountB);
                assert.equal(balanceA.valueOf(), 0);
                const balanceB = await instance.delegatedBalanceOf.call(accountB);
                assert.equal(balanceB.valueOf(), 1000000);
                const balanceC = await instance.balanceOf.call(accountC);
                assert.equal(balanceC.valueOf(), 500000);
                const balanceD = await instance.delegatedBalanceOf.call(accountC);
                assert.equal(balanceD.valueOf(), 0);
                resolve();
            });
        });
    });

    it("should undelegateAndTransferFrom invalid amount", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        await instance.mint(accountA, 200, {from: accountA, value: 0});
        await instance.delegate(accountB, 150, {from: accountA, value: 0});
        //test
        let amount = 50;
        let dataToSend = await signAndPrepareToSend(amount, accountB);
        await truffleAssert.reverts(
            instance.undelegateAndTransferFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, 100, {
                from: accountC,
                value: 0
            }),
        "AptroToken: invalid signature"
        );
    });

    it("should undelegateAndTransferFrom invalid nonce", async () => {
        //pre
        let instance = await AptroToken.new({from: accountA});
        await instance.mint(accountA, 200, {from: accountA, value: 0});
        await instance.delegate(accountB, 150, {from: accountA, value: 0});
        //test
        let amount = 50;
        let dataToSend = await signAndPrepareToSend(amount, accountB);
        let nounce = dataToSend.nonce;
        //valide
        await instance.undelegateAndTransferFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, dataToSend.amount, {
            from: accountC,
            value: 0
        });

        await truffleAssert.reverts(
            instance.undelegateAndTransferFrom(dataToSend.account, dataToSend.signature, nounce, dataToSend.amount, {
                from: accountC,
                value: 0
            }),
            "AptroToken: invalid nonce"
        );
    });
});
