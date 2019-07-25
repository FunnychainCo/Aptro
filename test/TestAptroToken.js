const AptroToken = artifacts.require("AptroToken");
const truffleAssert = require('truffle-assertions');
const assert = require("chai").assert;

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
            resolve(buffer);
        })
    });
    let ammountAsBuffer = int32ToBytes256(amount);
    for (let i = 0; i < 32; i++) {
        nonce[i] = nonce[i] | ammountAsBuffer[i];
    }
    let hash = web3.utils.sha3(nonce);
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


    it("should put 0 AptroToken in the first account", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        //test
        const balance = await instance.balanceOf.call(accounts[0]);
        assert.equal(balance.valueOf(), 0);
    });

    it("should mint", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        //test
        const result = await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balance = await instance.balanceOf.call(accounts[0]);
            assert.equal(balance.valueOf(), 200);
        });
    });

    it("should delegate", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        //test
        const result = await instance.delegate(accounts[1], 150, {from: accounts[0], value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balanceA = await instance.balanceOf.call(accounts[0]);
            assert.equal(balanceA.valueOf(), 50);
            const balanceB = await instance.delegatedBalanceOf.call(accounts[1]);
            assert.equal(balanceB.valueOf(), 150);
        });
    });

    it("should undelegateAndTransfertTo", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        await instance.delegate(accounts[1], 150, {from: accounts[0], value: 0});
        //test
        const result = await instance.undelegateAndTransfertTo(accounts[2], 50, {from: accounts[1], value: 0});
        truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
            const balanceA = await instance.balanceOf.call(accounts[1]);
            assert.equal(balanceA.valueOf(), 0);
            const balanceB = await instance.delegatedBalanceOf.call(accounts[1]);
            assert.equal(balanceB.valueOf(), 100);
            const balanceC = await instance.balanceOf.call(accounts[2]);
            assert.equal(balanceC.valueOf(), 50);
            const balanceD = await instance.delegatedBalanceOf.call(accounts[2]);
            assert.equal(balanceD.valueOf(), 0);
        });
    });


    it("should undelegateAndTransfertFrom ok", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        await instance.delegate(accounts[1], 150, {from: accounts[0], value: 0});
        //test
        let amount = 50;
        let dataToSend = await signAndPrepareToSend(amount, accounts[1]);
        const result = await instance.undelegateAndTransfertFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, dataToSend.amount, {
            from: accounts[2],
            value: 0
        });
        await new Promise((resolve, reject) => {
            truffleAssert.eventEmitted(result, 'Transfer', async (ev) => {
                const balanceA = await instance.balanceOf.call(accounts[1]);
                assert.equal(balanceA.valueOf(), 0);
                const balanceB = await instance.delegatedBalanceOf.call(accounts[1]);
                assert.equal(balanceB.valueOf(), 100);
                const balanceC = await instance.balanceOf.call(accounts[2]);
                assert.equal(balanceC.valueOf(), 50);
                const balanceD = await instance.delegatedBalanceOf.call(accounts[2]);
                assert.equal(balanceD.valueOf(), 0);
                resolve();
            });
        });
    });

    it("should undelegateAndTransfertFrom invalid amount", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        await instance.delegate(accounts[1], 150, {from: accounts[0], value: 0});
        //test
        let amount = 50;
        let dataToSend = await signAndPrepareToSend(amount, accounts[1]);
        await truffleAssert.reverts(
            instance.undelegateAndTransfertFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, 100, {
                from: accounts[2],
                value: 0
            }),
        "AptroToken: invalid signature"
        );
    });

    it("should undelegateAndTransfertFrom invalid nonce", async () => {
        //pre
        let instance = await AptroToken.new({from: accounts[0]});
        await instance.mint(accounts[0], 200, {from: accounts[0], value: 0});
        await instance.delegate(accounts[1], 150, {from: accounts[0], value: 0});
        //test
        let amount = 50;
        let dataToSend = await signAndPrepareToSend(amount, accounts[1]);
        let nounce = dataToSend.nonce;
        //valide
        await instance.undelegateAndTransfertFrom(dataToSend.account, dataToSend.signature, dataToSend.nonce, dataToSend.amount, {
            from: accounts[2],
            value: 0
        });

        await truffleAssert.reverts(
            instance.undelegateAndTransfertFrom(dataToSend.account, dataToSend.signature, nounce, dataToSend.amount, {
                from: accounts[2],
                value: 0
            }),
            "AptroToken: invalid nonce"
        );
    });
});
