const expect = require('chai').expect;
const truffleAssert = require('truffle-assertions');

const contractDefinition = artifacts.require('SupplyChain');

contract('SupplyChain', accounts => {
    const owner = accounts[0];
    const miner = accounts[1];
    const upc = 0;
    const minerName = "John Doe Mine";
    const mineInfo = "Yarray Valley";
    const mineLat = "-38.239770";
    const mineLong = "144.341490";

    const productNotes = "Shiniest diamond from the world!";
    const itemPrice = web3.utils.toWei("1", "ether");
    const zeroEther = web3.utils.toWei("0", "ether");
    const twoEther = web3.utils.toWei("2", "ether");
    const fiveEther = web3.utils.toWei("5", "ether");
    const productPrice = web3.utils.toWei("2", "ether");
    const manufacturer = accounts[2];
    const masterjeweler = accounts[3];
    const retailer = accounts[4];
    const customer = accounts[5];
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    let contractInstance;

    console.log("ganache-cli accounts used here...");
    console.log("Contract Owner: accounts[0] ", accounts[0]);
    console.log("Miner: accounts[1] ", accounts[1]);
    console.log("Manufacturer: accounts[2] ", accounts[2]);
    console.log("Masterjeweler: accounts[3] ", accounts[3]);
    console.log("Retailer: accounts[4] ", accounts[4]);
    console.log("Customer: accounts[5] ", accounts[5]);

    describe('Test suite: contract ownership, transfer and renounce', () => {
        let currentOwner;
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            currentOwner = owner;
        });

        after(async() => {
            await contractInstance.kill({from: currentOwner});
        });

        it('should make the contract deployer to be the contract owner', async() => {
            expect(await contractInstance.owner()).to.equal(owner);
        });

        it('should allow to transfer ownership and emit event', async() => {
            let tx = await contractInstance.transferOwnership(miner, {from: currentOwner});
            expect(await contractInstance.owner()).to.equal(miner);
            truffleAssert.eventEmitted(tx, 'OwnershipTransferred', (ev) => {
                return expect(ev.previousOwner).to.deep.equal(owner) && expect(ev.newOwner).to.deep.equal(miner);
            });
            currentOwner = miner;
        });
    });

    describe('Test suite: contract destruction', () => {
        beforeEach(async() => {
            contractInstance = await contractDefinition.new({from:owner});
        });

        it('should make address 0x0 to be the default owner when all have renounced ownership', async() => {
            let tx = await contractInstance.renounceOwnership({from: owner});
            truffleAssert.eventEmitted(tx, 'OwnershipTransferred', (ev) => {
                return expect(ev.previousOwner).to.deep.equal(owner) && expect(ev.newOwner).to.deep.equal(zeroAddress);
            });
            expect(await contractInstance.owner()).to.equal(zeroAddress);
        });

        it('should not allow further contract calls when contract has been killed/destroyed', async() => {
            await contractInstance.kill({from: owner});
            expectToFail(contractInstance.owner(), 'Error', '');
        });
    });

    describe('Test suite: fetchItemBufferOne & fetchItemBufferTwo', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
        });

        after(async() => {
            await contractInstance.kill({from: owner});
        });

        it('should return default values if the product is not found', async() => {
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, zeroAddress, zeroAddress, "", "", "", "");
            assertItemHasProperties(resultBufferTwo, upc, upc, upc, "", 0, 0, 0, zeroAddress, zeroAddress, zeroAddress, zeroAddress);
        });

    });
    
    describe('Test suite: mineItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
        });

        after(async() => {
            await contractInstance.kill({from: owner});
        });
        let _upc = upc;

        it('should allow a minerRole to mine an unique item, emit event and register it on smart contract storage', async () => {
            const tx = await contractInstance.mineItem(_upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            truffleAssert.eventEmitted(tx, 'Mined', (ev) => {
                return expect(Number(ev.upc)).to.equal(_upc);
            });
            
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(_upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(_upc)
            assertItemSourceHasProperties(resultBufferOne, _upc, _upc, owner, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, _upc, _upc, 2*_upc, productNotes, 0, 0, 0, zeroAddress, zeroAddress, zeroAddress, zeroAddress);
        });

        it('should NOT allow an unauthorized role to mine and register an item', async () => {
            expectToRevert(contractInstance.mineItem(_upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: miner}), 'Only a miner can perform this action');
        });

        it('should NOT allow a miner to mine and register an already existent item id', async () => {
            expectToRevert(contractInstance.mineItem(_upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner}), 'Item already exists');
        });

        it('should allow a new added miner to mine a new item, emit event and register it on smart contract storage', async () => {
            await contractInstance.addMiner(miner, {from: owner});
            _upc++;
            const tx = await contractInstance.mineItem(_upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: miner});
            truffleAssert.eventEmitted(tx, 'Mined', (ev) => {
                return expect(Number(ev.upc)).to.equal(_upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(_upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(_upc)
            assertItemSourceHasProperties(resultBufferOne, _upc, _upc, miner, miner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, _upc, _upc, 2*_upc, productNotes, 0, 0, 0, zeroAddress, zeroAddress, zeroAddress, zeroAddress);
        });
    });
   
    describe('Test Suite: sellItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to sell an inexistent item or item with incorrect state', async () => {
            expectToRevert(contractInstance.sellItem(99, itemPrice, {from: owner}), 'Item state is not Mined');
        });

        it('should NOT allow to sell an item if the caller is NOT the miner of item', async() => {
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            expectToRevert(contractInstance.sellItem(upc, itemPrice, {from: customer}), 'Only a miner can perform this action');
        });


        it('should NOT allow to sell an item if the caller is NOT the miner and currntOwner of item', async() => {
            await contractInstance.addMiner(miner, {from: owner});
            expectToRevert(contractInstance.sellItem(upc, itemPrice, {from: miner}), 'Only the authorized user/address can perform this');
        });

        it('should allow ONLY the current owner with the role of miner to sell the item and emit event', async() => {
            const _upc = upc + 1;
            await contractInstance.mineItem(_upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: miner});
            let tx = await contractInstance.sellItem(_upc, itemPrice, {from: miner});
            truffleAssert.eventEmitted(tx, 'ForSale', (ev) => {
                return expect(Number(ev.upc)).to.equal(_upc);
            });

            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(_upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(_upc)
            assertItemSourceHasProperties(resultBufferOne, _upc, _upc, miner, miner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, _upc, _upc, 2 * _upc, productNotes, itemPrice, 0, 1, zeroAddress, zeroAddress, zeroAddress, zeroAddress);
        });
        
    });

    describe('Test Suite : buyItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });

        it('should NOT allow a different role user to buy an item', async() => {
            expectToRevert(contractInstance.buyItem(upc, {from: customer, value: itemPrice}), 'Only a manufacturer can perform this action');
        });

        it('should NOT allow to buy an inexistent item', async () => {
            expectToRevert(contractInstance.buyItem(99, {from: manufacturer, value: itemPrice}), 'Item state is not ForSale');
        });

        it('should NOT allow to buy an item if not paid enough', async () => {
            expectToRevert(contractInstance.buyItem(upc, {from: manufacturer}), 'Not enough payment sent');
        });

        it('should allow to buy an item, emit an event and return any extra payment done', async () => {
            const ownerBalanceBefore = await web3.eth.getBalance(owner);
            const buyerBalanceBefore = await web3.eth.getBalance(manufacturer);
            let tx = await contractInstance.buyItem(upc, {from: manufacturer, value: fiveEther});
            truffleAssert.eventEmitted(tx, 'Sold', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });

            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 2, manufacturer, zeroAddress, zeroAddress, zeroAddress);

            const ownerBalanceAfter = await web3.eth.getBalance(owner);
            const buyerBalanceAfter = await web3.eth.getBalance(manufacturer);
            expect(Number(ownerBalanceBefore) + Number(itemPrice)).to.equal(Number(ownerBalanceAfter));
            let maxDifference = web3.utils.toWei("1.2", "ether"); //1 eth itemPrice and 0.2 for gas
            expect(Number(buyerBalanceBefore) - Number(buyerBalanceAfter)).to.be.within(Number(itemPrice), Number(maxDifference));
        });

        it('should NOT allow to buy an item TWICE', async () => {
            expectToRevert(contractInstance.buyItem(upc, {from: manufacturer, value: fiveEther}), 'Item state is not ForSale');
        });
    });

    describe('Test suite: sendItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });

        it('should NOT allow to send an inexistent item', async () => {
            expectToRevert(contractInstance.sendItem(99, {from: owner}), 'Item state is not Sold');
        });

        it('should NOT allow to send an item that is not sold', async () => {
            expectToRevert(contractInstance.sendItem(upc, {from: owner}), 'Item state is not Sold');
        });
        it('should NOT allow unauthorized user to send item', async () => {
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            expectToRevert(contractInstance.sendItem(upc, {from: manufacturer}), 'Only the authorized user/address can perform this');
        });
        it('should allow the miner to sent the item to buyer, emit event and change item state', async () => {
            let tx = await contractInstance.sendItem(upc, {from: owner});
            truffleAssert.eventEmitted(tx, 'Sent', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 3, manufacturer, zeroAddress, zeroAddress, zeroAddress);
        });

        it('should NOT allow the miner send the same item twice', async () => {
            expectToRevert(contractInstance.sendItem(upc, {from: owner}), 'Item state is not Sold');
        });
    });

    describe('Test suite: receiveItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to receive an inexistent item', async () => {
            expectToRevert(contractInstance.receiveItem(99, {from: manufacturer}), 'Item state is not Sent');
        });

        it('should NOT allow to receive an item that is not sent', async () => {
            expectToRevert(contractInstance.receiveItem(upc, {from: manufacturer}), 'Item state is not Sent');
        });
        
        it('should NOT allow unauthorized user to receive item', async () => {
            await contractInstance.sendItem(upc, {from: owner});
            expectToRevert(contractInstance.receiveItem(upc, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow manufacturer to receive item, emit event and change state of item', async () => {
            let tx = await contractInstance.receiveItem(upc, {from: manufacturer});
            truffleAssert.eventEmitted(tx, 'Received', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 4, manufacturer, zeroAddress, zeroAddress, zeroAddress);
        });

        it('should NOT allow the manufacturer to receive the same item twice', async () => {
            expectToRevert(contractInstance.receiveItem(upc, {from: manufacturer}), 'Item state is not Sent');
        });
    });
   
    describe('Test suite: sendItemToCut', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to sendItemToCut an inexistent item', async () => {
            expectToRevert(contractInstance.sendItemToCut(99, masterjeweler, {from: manufacturer}), 'Item state is not Received');
        });

        it('should NOT allow to sendItemToCut an item that is not Received', async () => {
            expectToRevert(contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer}), 'Item state is not Received');
        });
        
        it('should NOT allow unauthorized user to sendItemToCut', async () => {
            await contractInstance.receiveItem(upc, {from: manufacturer});
            expectToRevert(contractInstance.sendItemToCut(upc, masterjeweler, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should NOT allow to sendItemToCut if the masterjeweler is NOT a masterjeweler role', async () => {
            expectToRevert(contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer}), 'The given address is not a Masterjeweler Role');
        });

        it('should allow the manufacturer to sendItemToCut, emit event and change state of item', async () => {
            //finish this 24/03/2019 23:36 add masterjeweler to MasterjewelerRole by the onwer
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            let tx = await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            truffleAssert.eventEmitted(tx, 'SentToCut', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 5, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the manufacturer to sendItemToCut the same item twice', async () => {
            expectToRevert(contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer}), 'Item state is not Received');
        });
    });

    describe('Test suite: receiveItemToCut', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to receiveItemToCut an inexistent item', async () => {
            expectToRevert(contractInstance.receiveItemToCut(99, {from: masterjeweler}), 'Item state is not SentToCut');
        });

        it('should NOT allow to receiveItemToCut an item that is not SentToCut', async () => {
            expectToRevert(contractInstance.receiveItemToCut(upc, {from: manufacturer}), 'Item state is not SentToCut');
        });
        
        it('should NOT allow to receiveItemToCut if the masterjeweler is NOT a masterjeweler role', async () => {
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer})
            await contractInstance.renounceMasterjeweler({from: masterjeweler});
            expectToRevert(contractInstance.receiveItemToCut(upc, {from: masterjeweler}), 'Only a masterjeweler can perform this action');
        });

        it('should NOT allow unauthorized user to receiveItemToCut', async () => {
            expectToRevert(contractInstance.receiveItemToCut(upc, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow masterjeweler to receive item, emit event and change state of item', async () => {
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            let tx = await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
            truffleAssert.eventEmitted(tx, 'ReceivedForCutting', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 6, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the masterjeweler to receiveItemToCut the same item twice', async () => {
            expectToRevert(contractInstance.receiveItemToCut(upc, {from: masterjeweler}), 'Item state is not SentToCut');
        });
    });

    describe('Test suite: cutItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to cutItem an inexistent item', async () => {
            expectToRevert(contractInstance.cutItem(99, {from: masterjeweler}), 'Item state is not ReceivedForCutting');
        });

        it('should NOT allow to cutItem an item that is not ReceivedForCutting', async () => {
            expectToRevert(contractInstance.cutItem(upc, {from: masterjeweler}), 'Item state is not ReceivedForCutting');
        });
        
        it('should NOT allow to cutItem if the masterjeweler is NOT a masterjeweler role', async () => {
            await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
            await contractInstance.renounceMasterjeweler({from: masterjeweler});
            expectToRevert(contractInstance.cutItem(upc, {from: masterjeweler}), 'Only a masterjeweler can perform this action');
        });

        it('should NOT allow unauthorized user to cutItem', async () => {
            expectToRevert(contractInstance.cutItem(upc, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow masterjeweler to cutItem item, emit event and change state of item', async () => {
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            let tx = await contractInstance.cutItem(upc, {from: masterjeweler});
            truffleAssert.eventEmitted(tx, 'Cut', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 7, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the masterjeweler to cutItem the same item twice', async () => {
            expectToRevert(contractInstance.cutItem(upc, {from: masterjeweler}), 'Item state is not ReceivedForCutting');
        });
    });


    describe('Test suite: returnCutItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to returnCutItem an inexistent item', async () => {
            expectToRevert(contractInstance.returnCutItem(99, {from: masterjeweler}), 'Item state is not Cut');
        });

        it('should NOT allow to returnCutItem an item that is not Cut', async () => {
            expectToRevert(contractInstance.returnCutItem(upc, {from: masterjeweler}), 'Item state is not Cut');
        });
        
        it('should NOT allow unauthorized user to sendItemToCut', async () => {
            await contractInstance.cutItem(upc, {from: masterjeweler});
            expectToRevert(contractInstance.returnCutItem(upc, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow masterjeweler to returnCutItem, emit event and change state of item', async () => {
            let tx = await contractInstance.returnCutItem(upc, {from: masterjeweler});
            truffleAssert.eventEmitted(tx, 'SentFromCutting', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 8, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the manufacturer to returnCutItem the same item twice', async () => {
            expectToRevert(contractInstance.returnCutItem(upc, {from: masterjeweler}), 'Item state is not Cut');
        });
    });
   

   describe('Test suite: receiveCutItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
            await contractInstance.cutItem(upc, {from: masterjeweler});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to receiveCutItem an inexistent item', async () => {
            expectToRevert(contractInstance.receiveCutItem(99, {from: masterjeweler}), 'Item state is not SentFromCutting');
        });

        it('should NOT allow to receiveCutItem an item that is not SentFromCutting', async () => {
            expectToRevert(contractInstance.receiveCutItem(upc, {from: masterjeweler}), 'Item state is not SentFromCutting');
        });
        
        it('should NOT allow unauthorized user to receiveCutItem', async () => {
            await contractInstance.returnCutItem(upc, {from: masterjeweler});
            expectToRevert(contractInstance.receiveCutItem(upc, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow manufacturer to receiveCutItem, emit event and change state of item', async () => {
            let tx = await contractInstance.receiveCutItem(upc, {from: manufacturer});
            truffleAssert.eventEmitted(tx, 'ReceivedFromCutting', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, 0, 9, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the manufacturer to receiveCutItem the same item twice', async () => {
            expectToRevert(contractInstance.receiveCutItem(upc, {from: manufacturer}), 'Item state is not SentFromCutting');
        });
    });
    
    describe('Test suite: markForPurchasing', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
            await contractInstance.cutItem(upc, {from: masterjeweler});
            await contractInstance.returnCutItem(upc, {from: masterjeweler});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to markForPurchasing an inexistent item', async () => {
            expectToRevert(contractInstance.markForPurchasing(99, twoEther, {from: manufacturer}), 'Item state is not ReceivedFromCutting');
        });

        it('should NOT allow to markForPurchasing an item that is not ReceivedFromCutting', async () => {
            expectToRevert(contractInstance.markForPurchasing(upc, twoEther, {from: manufacturer}), 'Item state is not ReceivedFromCutting');
        });
        
        it('should NOT allow unauthorized user to markForPurchasing', async () => {
            await contractInstance.receiveCutItem(upc, {from: manufacturer});
            expectToRevert(contractInstance.markForPurchasing(upc, twoEther, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should allow manufacturer to markForPurchasing, emit event and change state of item', async () => {
            let tx = await contractInstance.markForPurchasing(upc, twoEther, {from: manufacturer});
            truffleAssert.eventEmitted(tx, 'MarkedForPurchasing', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, twoEther, 10, manufacturer, masterjeweler, zeroAddress, zeroAddress);
        });

        it('should NOT allow the manufacturer to markForPurchasing the same item twice', async () => {
            expectToRevert(contractInstance.markForPurchasing(upc, twoEther, {from: manufacturer}), 'Item state is not ReceivedFromCutting');
        });
    });

    describe('Test suite: sendItemForPurchasing', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, {from: owner});
            await contractInstance.sellItem(upc, itemPrice, {from: owner});
            await contractInstance.addManufacturer(manufacturer, {from: owner});
            await contractInstance.buyItem(upc, {from: manufacturer, value: itemPrice});
            await contractInstance.sendItem(upc, {from: owner});
            await contractInstance.receiveItem(upc, {from: manufacturer});
            await contractInstance.addMasterjeweler(masterjeweler, {from: owner});
            await contractInstance.sendItemToCut(upc, masterjeweler, {from: manufacturer});
            await contractInstance.receiveItemToCut(upc, {from: masterjeweler});
            await contractInstance.cutItem(upc, {from: masterjeweler});
            await contractInstance.returnCutItem(upc, {from: masterjeweler});
            await contractInstance.receiveCutItem(upc, {from: manufacturer});
        });

        after(async() => {
            await contractInstance.kill({from:owner});
        });
        
        it('should NOT allow to sendItemForPurchasing an inexistent item', async () => {
            expectToRevert(contractInstance.sendItemForPurchasing(99, retailer, {from: manufacturer}), 'Item state is not MarkedForPurchasing');
        });

        it('should NOT allow to sendItemForPurchasing an item that is not MarkedForPurchasing', async () => {
            expectToRevert(contractInstance.sendItemForPurchasing(upc, retailer, {from: manufacturer}), 'Item state is not MarkedForPurchasing');
        });
        
        it('should NOT allow unauthorized user to sendItemForPurchasing', async () => {
            await contractInstance.markForPurchasing(upc, twoEther, {from: manufacturer});
            expectToRevert(contractInstance.sendItemForPurchasing(upc, retailer, {from: customer}), 'Only the authorized user/address can perform this');
        });

        it('should NOT allow to sendItemForPurchasing if the retailer is NOT a retailer role', async () => {
            expectToRevert(contractInstance.sendItemForPurchasing(upc, retailer, {from: manufacturer}), 'The given address is not a Retailer Role');
        });

        it('should allow manufacturer to sendItemForPurchasing, emit event and change state of item', async () => {
            await contractInstance.addRetailer(retailer, {from: owner});
            let tx = await contractInstance.sendItemForPurchasing(upc, retailer, {from: manufacturer});
            truffleAssert.eventEmitted(tx, 'SentForPurchasing', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, twoEther, 11, manufacturer, masterjeweler, retailer, zeroAddress);
        });

        it('should NOT allow the manufacturer to sendItemForPurchasing the same item twice', async () => {
            expectToRevert(contractInstance.sendItemForPurchasing(upc, retailer, {from: manufacturer}), 'Item state is not MarkedForPurchasing');
        });
    });

    describe('Test suite: receiveItemForPurchasing', () => {
        before(async () => {
            contractInstance = await contractDefinition.new({ from: owner });
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });
            await contractInstance.sellItem(upc, itemPrice, { from: owner });
            await contractInstance.addManufacturer(manufacturer, { from: owner });
            await contractInstance.buyItem(upc, { from: manufacturer, value: itemPrice });
            await contractInstance.sendItem(upc, { from: owner });
            await contractInstance.receiveItem(upc, { from: manufacturer });
            await contractInstance.addMasterjeweler(masterjeweler, { from: owner });
            await contractInstance.sendItemToCut(upc, masterjeweler, { from: manufacturer });
            await contractInstance.receiveItemToCut(upc, { from: masterjeweler });
            await contractInstance.cutItem(upc, { from: masterjeweler });
            await contractInstance.returnCutItem(upc, { from: masterjeweler });
            await contractInstance.receiveCutItem(upc, { from: manufacturer });
            await contractInstance.markForPurchasing(upc, productPrice, { from: manufacturer });
            await contractInstance.addRetailer(retailer, { from: owner });
        });

        after(async () => {
            await contractInstance.kill({ from: owner });
        });

        it('should NOT allow to receiveItemForPurchasing an inexistent item', async () => {
            expectToRevert(contractInstance.receiveItemForPurchasing(99, { from: retailer }), 'Item state is not SentForPurchasing');
        });

        it('should NOT allow to receiveItemForPurchasing an item that is not SentForPurchasing', async () => {
            expectToRevert(contractInstance.receiveItemForPurchasing(upc, { from: retailer }), 'Item state is not SentForPurchasing');
        });

        it('should NOT allow unauthorized user to receiveItemForPurchasing', async () => {
            contractInstance.sendItemForPurchasing(upc, retailer, { from: manufacturer });
            expectToRevert(contractInstance.receiveItemForPurchasing(upc, { from: customer }), 'Only the authorized user/address can perform this');
        });

        it('should allow retailer to receiveItemForPurchasing an item, emit event and change state of item', async () => {
            let tx = await contractInstance.receiveItemForPurchasing(upc, { from: retailer });
            truffleAssert.eventEmitted(tx, 'ReceivedForPurchasing', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, productPrice, 12, manufacturer, masterjeweler, retailer, zeroAddress);
        });

        it('should NOT allow the retailer to receiveItemForPurchasing the same item twice', async () => {
            expectToRevert(contractInstance.receiveItemForPurchasing(upc, { from: retailer }), 'Item state is not SentForPurchasing');
        });
    });

    describe('Test suite: putUpForPurchasing', () => {
        before(async () => {
            contractInstance = await contractDefinition.new({ from: owner });
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });
            await contractInstance.sellItem(upc, itemPrice, { from: owner });
            await contractInstance.addManufacturer(manufacturer, { from: owner });
            await contractInstance.buyItem(upc, { from: manufacturer, value: itemPrice });
            await contractInstance.sendItem(upc, { from: owner });
            await contractInstance.receiveItem(upc, { from: manufacturer });
            await contractInstance.addMasterjeweler(masterjeweler, { from: owner });
            await contractInstance.sendItemToCut(upc, masterjeweler, { from: manufacturer });
            await contractInstance.receiveItemToCut(upc, { from: masterjeweler });
            await contractInstance.cutItem(upc, { from: masterjeweler });
            await contractInstance.returnCutItem(upc, { from: masterjeweler });
            await contractInstance.receiveCutItem(upc, { from: manufacturer });
            await contractInstance.markForPurchasing(upc, productPrice, { from: manufacturer });
            await contractInstance.addRetailer(retailer, { from: owner });
            await contractInstance.sendItemForPurchasing(upc, retailer, { from: manufacturer });
        });

        after(async () => {
            await contractInstance.kill({ from: owner });
        });

        it('should NOT allow to putUpForPurchasing an inexistent item', async () => {
            expectToRevert(contractInstance.putUpForPurchasing(99, { from: retailer }), 'Item state is not ReceivedForPurchasing');
        });

        it('should NOT allow to putUpForPurchasing an item that is not ReceivedForPurchasing', async () => {
            expectToRevert(contractInstance.putUpForPurchasing(upc, { from: retailer }), 'Item state is not ReceivedForPurchasing');
        });

        it('should NOT allow unauthorized user to putUpForPurchasing', async () => {
            await contractInstance.receiveItemForPurchasing(upc, { from: retailer });
            expectToRevert(contractInstance.putUpForPurchasing(upc, { from: customer }), 'Only the authorized user/address can perform this');
        });

        it('should NOT allow to putUpForPurchasing if the retailer is NOT a retailer role', async () => {
            await contractInstance.renounceRetailer({from: retailer});
            expectToRevert(contractInstance.putUpForPurchasing(upc, {from: retailer}), 'Only a retailer can perform this action');
        });

        it('should allow retailer to putUpForPurchasing the item, emit event and change state of item', async () => {
            await contractInstance.addRetailer(retailer, { from: owner });
            let tx = await contractInstance.putUpForPurchasing(upc, { from: retailer });
            truffleAssert.eventEmitted(tx, 'ForPurchasing', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, manufacturer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, productPrice, 13, manufacturer, masterjeweler, retailer, zeroAddress);
        });

        it('should NOT allow the retailer to putUpForPurchasing the same item twice', async () => {
            expectToRevert(contractInstance.putUpForPurchasing(upc, { from: retailer }), 'Item state is not ReceivedForPurchasing');
        });
    });

    describe('Test suite: purchaseItem', () => {
        before(async () => {
            contractInstance = await contractDefinition.new({ from: owner });
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });
            await contractInstance.sellItem(upc, itemPrice, { from: owner });
            await contractInstance.addManufacturer(manufacturer, { from: owner });
            await contractInstance.buyItem(upc, { from: manufacturer, value: itemPrice });
            await contractInstance.sendItem(upc, { from: owner });
            await contractInstance.receiveItem(upc, { from: manufacturer });
            await contractInstance.addMasterjeweler(masterjeweler, { from: owner });
            await contractInstance.sendItemToCut(upc, masterjeweler, { from: manufacturer });
            await contractInstance.receiveItemToCut(upc, { from: masterjeweler });
            await contractInstance.cutItem(upc, { from: masterjeweler });
            await contractInstance.returnCutItem(upc, { from: masterjeweler });
            await contractInstance.receiveCutItem(upc, { from: manufacturer });
            await contractInstance.markForPurchasing(upc, productPrice, { from: manufacturer });
            await contractInstance.addRetailer(retailer, { from: owner });
            await contractInstance.sendItemForPurchasing(upc, retailer, { from: manufacturer });
            await contractInstance.receiveItemForPurchasing(upc, { from: retailer });
            await contractInstance.addCustomer(customer, { from: owner });
        });

        after(async () => {
            await contractInstance.kill({ from: owner });
        });

        it('should NOT allow to purchaseItem an inexistent item', async () => {
            expectToRevert(contractInstance.purchaseItem(99, { from: customer, value: fiveEther }), 'Item state is not ForPurchasing');
        });

        it('should NOT allow to purchaseItem an item that is not ForPurchasing', async () => {
            expectToRevert(contractInstance.purchaseItem(upc, { from: customer, value: fiveEther }), 'Item state is not ForPurchasing');
        });

        it('should NOT allow to purchaseItem if the customer is NOT a customer role', async () => {
            await contractInstance.putUpForPurchasing(upc, { from: retailer });
            expectToRevert(contractInstance.purchaseItem(upc, {from: retailer, value: fiveEther}), 'Only a customer can perform this action');
        });

        it('should NOT allow to purchaseItem an item if not paid enough', async () => {
            expectToRevert(contractInstance.purchaseItem(upc, {from: customer, value: zeroEther}), 'Not enough payment sent');
        });

        it('should allow a customer to purchaseItem an item, emit an event and return any extra payment done', async () => {
            const retailerBalanceBefore = await web3.eth.getBalance(retailer);
            const customerBalanceBefore = await web3.eth.getBalance(customer);
            let tx = await contractInstance.purchaseItem(upc, {from: customer, value: fiveEther});
            truffleAssert.eventEmitted(tx, 'Purchased', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });

            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, customer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, productPrice, 14, manufacturer, masterjeweler, retailer, customer);

            const retailerBalanceAfter = await web3.eth.getBalance(retailer);
            const customerBalanceAfter = await web3.eth.getBalance(customer);
            expect(Number(retailerBalanceBefore) + Number(productPrice)).to.equal(Number(retailerBalanceAfter));
            let maxDifference = web3.utils.toWei("2.2", "ether"); //2 eth product Price and 0.2 for gas
            expect(Number(customerBalanceBefore) - Number(customerBalanceAfter)).to.be.within(Number(productPrice), Number(maxDifference));
        });

        it('should NOT allow the customer to purchaseItem the same item twice', async () => {
            expectToRevert(contractInstance.purchaseItem(upc, {from: customer, value: fiveEther}), 'Item state is not ForPurchasing');
        });
    });

    describe('Test suite: fetchItem', () => {
        before(async () => {
            contractInstance = await contractDefinition.new({ from: owner });
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });
            await contractInstance.sellItem(upc, itemPrice, { from: owner });
            await contractInstance.addManufacturer(manufacturer, { from: owner });
            await contractInstance.buyItem(upc, { from: manufacturer, value: itemPrice });
            await contractInstance.sendItem(upc, { from: owner });
            await contractInstance.receiveItem(upc, { from: manufacturer });
            await contractInstance.addMasterjeweler(masterjeweler, { from: owner });
            await contractInstance.sendItemToCut(upc, masterjeweler, { from: manufacturer });
            await contractInstance.receiveItemToCut(upc, { from: masterjeweler });
            await contractInstance.cutItem(upc, { from: masterjeweler });
            await contractInstance.returnCutItem(upc, { from: masterjeweler });
            await contractInstance.receiveCutItem(upc, { from: manufacturer });
            await contractInstance.markForPurchasing(upc, productPrice, { from: manufacturer });
            await contractInstance.addRetailer(retailer, { from: owner });
            await contractInstance.sendItemForPurchasing(upc, retailer, { from: manufacturer });
            await contractInstance.receiveItemForPurchasing(upc, { from: retailer });
            await contractInstance.putUpForPurchasing(upc, { from: retailer });
            await contractInstance.addCustomer(customer, { from: owner });
        });

        after(async () => {
            await contractInstance.kill({ from: owner });
        });

        it('should NOT allow to fetchItem an inexistent item', async () => {
            expectToRevert(contractInstance.fetchItem(99, { from: customer }), 'Item state is not Purchased');
        });

        it('should NOT allow to fetchItem an item that is not Purchased', async () => {
            expectToRevert(contractInstance.fetchItem(upc, { from: customer }), 'Item state is not Purchased');
        });

        it('should NOT allow unauthorized user to fetchItem', async () => {
            await contractInstance.purchaseItem(upc, {from: customer, value: fiveEther});
            expectToRevert(contractInstance.fetchItem(upc, { from: manufacturer }), 'Only the authorized user/address can perform this');
        });

        it('should allow customer and owner to fetchItem the item, emit event and change state of item', async () => {
            let tx = await contractInstance.fetchItem(upc, { from: customer });
            truffleAssert.eventEmitted(tx, 'Fetched', (ev) => {
                return expect(Number(ev.upc)).to.equal(upc);
            });
            const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            assertItemSourceHasProperties(resultBufferOne, upc, upc, customer, owner, minerName, mineInfo, mineLat, mineLong);
            assertItemHasProperties(resultBufferTwo, upc, upc, 2 * upc, productNotes, itemPrice, productPrice, 15, manufacturer, masterjeweler, retailer, customer);
        });

        it('should NOT allow the customer to fetchItem the same item twice', async () => {
            expectToRevert(contractInstance.fetchItem(upc, { from: customer }), 'Item state is not Purchased');
        });
    });

    describe('Test suite: uploadHash and readHash', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:owner});
            await contractInstance.addMiner(miner, {from: owner});
            await contractInstance.mineItem(upc, minerName, mineInfo, mineLat, mineLong, productNotes, { from: miner });
            await contractInstance.mineItem(upc+1, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });
            await contractInstance.mineItem(upc+2, minerName, mineInfo, mineLat, mineLong, productNotes, { from: owner });

        });

        after(async() => {
            await contractInstance.kill({from: owner});
        });

        it('should NOT allow to uploadHash of an inexistent item', async () => {
            expectToRevert(contractInstance.uploadHash(99, "abcdefXYZ", { from: miner }), 'Only the authorized user/address can perform this');
        });

        it('should NOT allow unauthorized user to uploadHash', async () => {
            expectToRevert(contractInstance.uploadHash(upc, "abcdefXYZ", { from: owner }), 'Only the authorized user/address can perform this');
        });

        it('should allow only the original miner to uploadHash', async () => {
            await contractInstance.uploadHash(upc, "minerHashPicture", { from: miner });
            await contractInstance.uploadHash(upc+1, "ownerHashPicture", { from: owner });
        });

        it('should allow anyone to readHash and return the correct hash for the given upc item', async () => {
            let hash1 = await contractInstance.readHash(upc, {from: customer});
            let hash2 = await contractInstance.readHash(upc+1, {from: miner});
            let hash3 = await contractInstance.readHash(upc+2, {from: miner});
            let inexistentHash = await contractInstance.readHash(99, {from: owner});
            expect(hash1).to.equal("minerHashPicture");
            expect(hash2).to.equal("ownerHashPicture");
            expect(hash3).to.equal("No Image Hash exists");
            expect(inexistentHash).to.deep.equal("");
        });
    });
});

const expectToRevert = async(promise, errorMessage) => {
    return await truffleAssert.reverts(promise, errorMessage);
}

var expectToFail = async(promise, errorType, errorMessage) => {
    try {
        await promise;
    }
    catch(error){
        expect(error).to.be.an(errorType);
        expect(error.message).to.have.string(errorMessage);
        return;
    }
    assert.fail(`Expected to throw an ${errorType} with message ${errorMessage}`);
}

const assertItemSourceHasProperties = (resultBufferOne, sku, upc, owner, miner, minerName, mineInfo, mineLat, mineLong) => {
    expect(Number(resultBufferOne[0])).to.equal(sku);
    expect(Number(resultBufferOne[1])).to.equal(upc);
    expect(resultBufferOne[2]).to.equal(owner);
    expect(resultBufferOne[3]).to.equal(miner);
    expect(resultBufferOne[4]).to.equal(minerName);
    expect(resultBufferOne[5]).to.equal(mineInfo);
    expect(resultBufferOne[6]).to.equal(mineLat);
    expect(resultBufferOne[7]).to.equal(mineLong);
};

const assertItemHasProperties = (resultBufferTwo, sku, upc, productId, notes, itemPrice, productPrice, state, manufacturer, masterjeweler, retailer, customer) => {
    expect(Number(resultBufferTwo[0])).to.equal(sku);
    expect(Number(resultBufferTwo[1])).to.equal(upc);
    expect(Number(resultBufferTwo[2])).to.equal(productId);
    expect(resultBufferTwo[3]).to.equal(notes);
    expect(Number(resultBufferTwo[4])).to.equal(Number(itemPrice));
    expect(Number(resultBufferTwo[5])).to.equal(Number(productPrice));
    expect(Number(resultBufferTwo[6])).to.equal(state);
    expect(resultBufferTwo[7]).to.equal(manufacturer);
    expect(resultBufferTwo[8]).to.equal(masterjeweler);
    expect(resultBufferTwo[9]).to.equal(retailer);
    expect(resultBufferTwo[10]).to.equal(customer);
};
    /*
    // 1st Test
    it("Testing smart contract function harvestItem() that allows a farmer to harvest coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        var eventEmitted = false
        
        // Watch the emitted event Harvested()
        var event = supplyChain.Harvested()
        await event.watch((err, res) => {
            eventEmitted = true
        })

        // Mark an item as Harvested by calling function harvestItem()
        await supplyChain.harvestItem(upc, originFarmerID, originFarmName, originFarmInformation, originFarmLatitude, originFarmLongitude, productNotes)

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        const resultBufferOne = await supplyChain.fetchItemBufferOne.call(upc)
        const resultBufferTwo = await supplyChain.fetchItemBufferTwo.call(upc)

        // Verify the result set
        assert.equal(resultBufferOne[0], sku, 'Error: Invalid item SKU')
        assert.equal(resultBufferOne[1], upc, 'Error: Invalid item UPC')
        assert.equal(resultBufferOne[2], originFarmerID, 'Error: Missing or Invalid ownerID')
        assert.equal(resultBufferOne[3], originFarmerID, 'Error: Missing or Invalid originFarmerID')
        assert.equal(resultBufferOne[4], originFarmName, 'Error: Missing or Invalid originFarmName')
        assert.equal(resultBufferOne[5], originFarmInformation, 'Error: Missing or Invalid originFarmInformation')
        assert.equal(resultBufferOne[6], originFarmLatitude, 'Error: Missing or Invalid originFarmLatitude')
        assert.equal(resultBufferOne[7], originFarmLongitude, 'Error: Missing or Invalid originFarmLongitude')
        assert.equal(resultBufferTwo[5], 0, 'Error: Invalid item State')
        assert.equal(eventEmitted, true, 'Invalid event emitted')        
    })    


    // 2nd Test
    it("Testing smart contract function processItem() that allows a farmer to process coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Processed()
        

        // Mark an item as Processed by calling function processtItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
        
    })    

    // 3rd Test
    it("Testing smart contract function packItem() that allows a farmer to pack coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Packed()
        

        // Mark an item as Packed by calling function packItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
        
    })    

    // 4th Test
    it("Testing smart contract function sellItem() that allows a farmer to sell coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event ForSale()
        

        // Mark an item as ForSale by calling function sellItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
          
    })    

    // 5th Test
    it("Testing smart contract function buyItem() that allows a distributor to buy coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Sold()
        var event = supplyChain.Sold()
        

        // Mark an item as Sold by calling function buyItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
        
    })    

    // 6th Test
    it("Testing smart contract function shipItem() that allows a distributor to ship coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Shipped()
        

        // Mark an item as Sold by calling function buyItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
              
    })    

    // 7th Test
    it("Testing smart contract function receiveItem() that allows a retailer to mark coffee received", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Received()
        

        // Mark an item as Sold by calling function buyItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
             
    })    

    // 8th Test
    it("Testing smart contract function purchaseItem() that allows a consumer to purchase coffee", async() => {
        const supplyChain = await SupplyChain.deployed()
        
        // Declare and Initialize a variable for event
        
        
        // Watch the emitted event Purchased()
        

        // Mark an item as Sold by calling function buyItem()
        

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        

        // Verify the result set
        
    })    

    // 9th Test
    it("Testing smart contract function fetchItemBufferOne() that allows anyone to fetch item details from blockchain", async() => {
        const supplyChain = await SupplyChain.deployed()

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        
        
        // Verify the result set:
        
    })

    // 10th Test
    it("Testing smart contract function fetchItemBufferTwo() that allows anyone to fetch item details from blockchain", async() => {
        const supplyChain = await SupplyChain.deployed()

        // Retrieve the just now saved item from blockchain by calling function fetchItem()
        
        
        // Verify the result set:
        
    })
*/

