// This script is designed to test the solidity smart contract - SuppyChain.sol -- and the various functions within
// Declare a variable and assign the compiled smart contract artifact
const expect = require('chai').expect;
const truffleAssert = require('truffle-assertions');

const contractDefinition = artifacts.require('SupplyChain')

contract('SupplyChain', accounts => {
    // Declare few constants and assign a few sample accounts generated by ganache-cli
    const sku = 1
    const upc = 1
    const ownerID = accounts[0];
    const originMinerID = accounts[1];
    const originMineName = "John Doe Mine";
    const originMineInformation = "Yarray Valley";
    const originMineLatitude = "-38.239770";
    const originMineLongitude = "144.341490";
    const productID = sku + upc;
    const productNotes = "Shiniest diamond from the world!";
    const productPrice = web3.utils.toWei("1", "ether");
    const itemState = 0;
    const manufacturerID = accounts[2];
    const masterjewelerID = accounts[3];
    const retailerID = accounts[4];
    const customerID = accounts[5];
    const emptyAddress = '0x0000000000000000000000000000000000000000';
    let contractInstance;
    ///Available Accounts
    ///==================
    ///(0) 0x27d8d15cbc94527cadf5ec14b69519ae23288b95
    ///(1) 0x018c2dabef4904ecbd7118350a0c54dbeae3549a
    ///(2) 0xce5144391b4ab80668965f2cc4f2cc102380ef0a
    ///(3) 0x460c31107dd048e34971e57da2f99f659add4f02
    ///(4) 0xd37b7b8c62be2fdde8daa9816483aebdbd356088
    ///(5) 0x27f184bdc0e7a931b507ddd689d76dba10514bcb
    ///(6) 0xfe0df793060c49edca5ac9c104dd8e3375349978
    ///(7) 0xbd58a85c96cc6727859d853086fe8560bc137632
    ///(8) 0xe07b5ee5f738b2f87f88b99aac9c64ff1e0c7917
    ///(9) 0xbd3ff2e3aded055244d66544c9c059fa0851da44

    console.log("ganache-cli accounts used here...")
    console.log("Contract Owner: accounts[0] ", accounts[0])
    console.log("Farmer: accounts[1] ", accounts[1])
    console.log("Distributor: accounts[2] ", accounts[2])
    console.log("Retailer: accounts[3] ", accounts[3])
    console.log("Consumer: accounts[4] ", accounts[4])

    describe('Test suite: contract ownership, transfer and renounce', () => {
        let currentOwner;
        before(async() => {
            contractInstance = await contractDefinition.new({from:ownerID});
            currentOwner = ownerID;
        });

        after(async() => {
            await contractInstance.kill({from: currentOwner});
        });

        it('should make the contract deployer to be the contract owner', async() => {
            expect(await contractInstance.owner()).to.equal(ownerID);
        });

        it('should allow to transfer ownership and emit event', async() => {
            let tx = await contractInstance.transferOwnership(originMinerID, {from: currentOwner});
            expect(await contractInstance.owner()).to.equal(originMinerID);
            truffleAssert.eventEmitted(tx, 'OwnershipTransferred', (ev) => {
                return expect(ev.previousOwner).to.deep.equal(ownerID) && expect(ev.newOwner).to.deep.equal(originMinerID);
            });
            currentOwner = originMinerID;
        });
    });

    describe('Test suite: contract destruction', () => {
        beforeEach(async() => {
            contractInstance = await contractDefinition.new({from:ownerID});
        });

        it('should make address 0x0 to be the default owner when all have renounced ownership', async() => {
            let tx = await contractInstance.renounceOwnership({from: ownerID});
            truffleAssert.eventEmitted(tx, 'OwnershipTransferred', (ev) => {
                return expect(ev.previousOwner).to.deep.equal(ownerID) && expect(ev.newOwner).to.deep.equal(emptyAddress);
            });
            expect(await contractInstance.owner()).to.equal(emptyAddress);
        });

        it('should not allow further contract calls when contract has been killed/destroyed', async() => {
            await contractInstance.kill({from: ownerID});
            expectToFail(contractInstance.owner(), 'Error', '');
        });
    });
   
    describe('Test suite: mineItem', () => {
        before(async() => {
            contractInstance = await contractDefinition.new({from:ownerID});
        });

        after(async() => {
            await contractInstance.kill({from: ownerID});
        });

        it('should allow a miner to mine an unique item, emit event and register it on smart contract storage', async () => {
            const tx = await contractInstance.mineItem(upc, originMinerID, originMineName, originMineInformation, originMineLatitude, originMineLongitude, productNotes, {from: originMinerID});
            //const resultBufferOne = await contractInstance.fetchItemBufferOne.call(upc)
            //const resultBufferTwo = await contractInstance.fetchItemBufferTwo.call(upc)
            //assertItemSourceHasProperties();
            //assertItemHasProperties();
            
        });

        it('should NOT allow a miner to mine and register an already existent item', async () => {});
        it('should NOT allow an unauthorized role to mine and register an item', async () => {});
    });

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
// const expectToFail = async(promise, errorType, errMessage) => {
//     return await truffleAssert.fails(promise, errorType, errorMessage);
// }