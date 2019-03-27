pragma solidity >0.4.25;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import '../diamondaccesscontrol/MinerRole.sol';
import '../diamondaccesscontrol/ManufacturerRole.sol';
import '../diamondaccesscontrol/MasterjewelerRole.sol';
import '../diamondaccesscontrol/RetailerRole.sol';
import '../diamondaccesscontrol/CustomerRole.sol';
/**
  * @title Supply chain main contract
  * @author Stefanel Stan https://github.com/StefanelStan  
  */
contract SupplyChain is Ownable, MinerRole, ManufacturerRole, MasterjewelerRole, RetailerRole, CustomerRole {
    
    /**
     * @dev As this is a supply chain for diamond jewelry, there is a subtle difference on the
     * state and processes of the item. When the raw diamond is mined, this is an item whose
     * itemPrice is to be determined by Miner. A manufacturer can BUY the item   
     * After the item gets cut by a master jeweler, the item is seen as a product, which has a
     * productPrice determined by manufacturer.
     * A customer can then purchase the product after paying the productPrice.
     */
    struct Item {
        uint sku;  // Stock Keeping Unit (SKU)
        uint upc; // Universal Product Code (UPC), generated by the Miner, goes on the package, can be verified by the Customer
        uint productID;  // Product ID potentially a combination of upc + sku
        uint itemPrice; //item price
        uint productPrice; // product Price
        string minerName; // Miner Name
        string mineInformation;  // Mine Information
        string mineLatitude; // Mine Latitude
        string mineLongitude;  // Mine Longitude
        string itemNotes; // Item Notes
        string ipfsHash; // ipfs hash of the picture of the item
        State itemState;  // Item State as represented in the enum above
        address owner;  // Metamask-Ethereum address of the current owner as the product moves through stages
        address miner; // Metamask-Ethereum address of the Farmer
        address manufacturer;  // Metamask-Ethereum address of the Manufacturer
        address masterjeweler; // Metamask-Ethereum address of the Masterjeweler
        address retailer; // Metamask-Ethereum address of the Retailer
        address customer; // Metamask-Ethereum address of the Customer
    }
    /** @dev Please see the notes from struct Item that clarifies the difference between
     *  ForSale/Sold and ForPurchasing/Purchased
     */
    enum State { 
        Mined,                  // 0
        ForSale,                // 1
        Sold,                   // 2
        Sent,                   // 3
        Received,               // 4
        SentToCut,              // 5
        ReceivedForCutting,     // 6
        Cut,                    // 7
        SentFromCutting,        // 8
        ReceivedFromCutting,    // 9
        MarkedForPurchasing,    // 10    
        SentForPurchasing,      // 11
        ReceivedForPurchasing,  // 12
        ForPurchasing,          // 13
        Purchased,              // 14
        Fetched                 // 15
    }

    // for Stock Keeping Unit (SKU)
    uint _sku;

    // maps the UPC to an Item.
    mapping (uint => Item) private items;

    // maps the UPC/item to an array of TxHash & tracks its journey through the supply chain -- to be sent from DApp.
    mapping (uint => string[]) private itemsHistory;
  
    // Define 16 events with the same 16 state values and accept 'upc' as input argument
    event Mined(uint upc);
    event ForSale(uint upc);
    event Sold(uint upc);
    event Sent(uint upc);
    event Received(uint upc);
    event SentToCut(uint upc);
    event ReceivedForCutting(uint upc);
    event Cut(uint upc);
    event SentFromCutting(uint upc);
    event ReceivedFromCutting(uint upc);
    event MarkedForPurchasing(uint upc);
    event SentForPurchasing(uint upc);
    event ReceivedForPurchasing(uint upc);
    event ForPurchasing(uint upc);
    event Purchased(uint upc);
    event Fetched(uint upc);

    // Define a modifer that verifies the Caller
    modifier verifyCaller(address _address) {
        require(msg.sender == _address, "Only the authorized user/address can perform this"); 
        _;
    }

    // Define a modifier that checks if the paid amount is sufficient to cover the price
    modifier paidEnough(uint _price) { 
        require(msg.value >= _price, "Not enough payment sent"); 
        _;
    }
  
    // Define a modifier that checks the price and refunds the remaining balance
    modifier checkValueForSelling(uint _upc) {
        _;
        uint _price = items[_upc].itemPrice;
        uint amountToReturn = msg.value - _price;
        address payable manufacturerAddres = address(uint160(items[_upc].manufacturer));
        manufacturerAddres.transfer(amountToReturn);
    }

    // Define a modifier that checks the price and refunds the remaining balance
    modifier checkValueForPurchasing(uint _upc) {
        _;
        uint _price = items[_upc].productPrice;
        uint amountToReturn = msg.value - _price;
        address payable customerAddress = address(uint160(items[_upc].customer));
        customerAddress.transfer(amountToReturn);
    }

    // Define a modifier that checks if an item.state of a upc is Mined
    modifier mined(uint _upc) {
        //If the doesn't exist, its State.mined == 0. So there is need for a stronger verification eg: has an owner
        require(items[_upc].itemState == State.Mined && items[_upc].owner != address(0), 
                "Item state is not Mined");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is ForSale
    modifier forSale(uint _upc) {
        require(items[_upc].itemState == State.ForSale, "Item state is not ForSale");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is Sold
    modifier sold(uint _upc) {
        require(items[_upc].itemState == State.Sold, "Item state is not Sold");
        _;
    }
  
    // Define a modifier that checks if an item.state of a upc is Sent
    modifier sent(uint _upc) {
        require(items[_upc].itemState == State.Sent, "Item state is not Sent");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is Received
    modifier received(uint _upc) {
        require(items[_upc].itemState == State.Received, "Item state is not Received");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is SentToCut
    modifier sentToCut(uint _upc) {
        require(items[_upc].itemState == State.SentToCut, "Item state is not SentToCut");
        _;
    }
  
    // Define a modifier that checks if an item.state of a upc is ReceivedForCutting
    modifier receivedForCutting(uint _upc) {
        require(items[_upc].itemState == State.ReceivedForCutting, "Item state is not ReceivedForCutting");
        _;  
    }

    // Define a modifier that checks if an item.state of a upc is Cut
    modifier cut(uint _upc) {
        require(items[_upc].itemState == State.Cut, "Item state is not Cut");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is SentFromCutting
    modifier sentFromCutting(uint _upc) {
        require(items[_upc].itemState == State.SentFromCutting, "Item state is not SentFromCutting");
        _;
    }
    
    // Define a modifier that checks if an item.state of a upc is ReceivedFromCutting
    modifier receivedFromCutting(uint _upc) {
        require(items[_upc].itemState == State.ReceivedFromCutting, "Item state is not ReceivedFromCutting");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is MarkedForPurchasing
    modifier markedForPurchasing(uint _upc) {
        require(items[_upc].itemState == State.MarkedForPurchasing, 
                "Item state is not MarkedForPurchasing");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is SentForPurchasing
    modifier sentForPurchasing(uint _upc) {
        require(items[_upc].itemState == State.SentForPurchasing, "Item state is not SentForPurchasing");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is ReceivedForPurchasing
    modifier receivedForPurchasing(uint _upc) {
        require(items[_upc].itemState == State.ReceivedForPurchasing, 
                "Item state is not ReceivedForPurchasing");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is ForPurchasing
    modifier forPurchasing(uint _upc) {
        require(items[_upc].itemState == State.ForPurchasing, "Item state is not ForPurchasing");
        _;
    }

    // Define a modifier that checks if an item.state of a upc is Purchased
    modifier purchased(uint _upc) {
        require(items[_upc].itemState == State.Purchased, "Item state is not Purchased");
        _;
    }   
    // Define a modifier that checks if an item.state of a upc is Fetched
    modifier fetched(uint _upc) {
        require(items[_upc].itemState == State.Fetched, "Item state is not Fetched");
        _;
    }

    constructor() public payable {
        _sku = 0;
    }

    // Define a function 'kill' if required
    function kill() external onlyOwner {
        require(isOwner(), "Only owner can kill this contract");
        selfdestruct(address(uint160(owner())));
    }

    /**
     * @dev Mines an item. 
     * @param _upc the identifier of the item; Generated by the miner. Reverts if not unique
     * @param _minerName miner's name
     * @param _mineInformation mine's information
     * @param _mineLatitude mine's LAtitude
     * @param _mineLongitude mine's Lontitude
     * @param _itemNotes notes about the item
     */
    function mineItem(
        uint _upc, 
        string memory _minerName, 
        string memory _mineInformation, 
        string memory _mineLatitude, 
        string memory _mineLongitude, 
        string memory _itemNotes
    ) 
        public onlyMiner
    {
        require(items[_upc].owner == address(0), 'Item already exists');
        
        items[_upc] = Item(_sku, _upc, _upc + _sku, 0, 0, _minerName, _mineInformation, 
                           _mineLatitude, _mineLongitude, _itemNotes, "No Image Hash exists", State.Mined, 
                           msg.sender, msg.sender, address(0), address(0), address(0), address(0));
        _sku++;
        emit Mined(_upc);
    }

    /**
     * @dev Marks an item as For Sale
     * @param _upc the upc of the item
     * @param _price the price demanded for the item
     */
    function sellItem(uint _upc, uint _price) 
        public 
        onlyMiner 
        mined(_upc) 
        verifyCaller(items[_upc].owner) 
    {
        Item storage item = items[_upc];
        item.itemPrice = _price;
        item.itemState = State.ForSale;
        emit ForSale(_upc);
    }

    /**
     * @dev Buys an item. Caller should be a manufacturer
     * @param _upc the desired _upc item to buy
     */
    function buyItem(uint _upc) 
        public 
        payable 
        onlyManufacturer 
        forSale(_upc) 
        paidEnough(items[_upc].itemPrice) 
        checkValueForSelling(_upc)
    {
        Item storage item = items[_upc];
        address(uint160(item.miner)).transfer(item.itemPrice);
        item.owner = msg.sender;
        item.manufacturer = msg.sender;
        item.itemState = State.Sold;
        emit Sold(_upc);
    }

    /**
     * @dev The Miner marks/sends a bought item to the buyer (manufacturer)
     * @param _upc the item's id to be send to the manufacturer/buyer  
     */
    function sendItem(uint _upc) public sold(_upc) verifyCaller(items[_upc].miner) {
        items[_upc].itemState = State.Sent;
        emit Sent(_upc);
    }

    /**
     * @dev The rightful buyer (manufacturer) receives the item and marks it as received
     * @param _upc the item to mark as received   
     */
    function receiveItem(uint _upc) public sent(_upc) verifyCaller(items[_upc].manufacturer) {
        items[_upc].itemState = State.Received;
        emit Received(_upc);
    }

    /**
     * @dev Send the item to cut
     * @param _upc the item's id 
     * @param masterjeweler the Masterjeweler's address. The given address has to have Masterjeweler Role
     */
    function sendItemToCut(uint _upc, address masterjeweler) 
        public 
        received(_upc) 
        verifyCaller(items[_upc].manufacturer)
    {
        require(isMasterjeweler(masterjeweler), "The given address is not a Masterjeweler Role");
        items[_upc].itemState = State.SentToCut;
        items[_upc].masterjeweler = masterjeweler;
        emit SentToCut(_upc);
    }

    /**
     * @dev Masterjeweler receives the item to cut
     * @param _upc the item's id that has been received   
     */
    function receiveItemToCut(uint _upc) 
        public 
        sentToCut(_upc) 
        verifyCaller(items[_upc].masterjeweler) 
        onlyMasterjeweler 
    {
        items[_upc].itemState = State.ReceivedForCutting;
        emit ReceivedForCutting(_upc);
    }

    /**
     * @dev Masterjeweler cuts the item
     * @param _upc the item's upc to cut  
     */
    function cutItem(uint _upc) 
        public
        receivedForCutting(_upc)
        verifyCaller(items[_upc].masterjeweler)
        onlyMasterjeweler
    {
        items[_upc].itemState = State.Cut;
        emit Cut(_upc);
    }

    /**
     * @dev Masterjeweler returns the cut item 
     * @param _upc the item to return
     */
    function returnCutItem(uint _upc) public cut(_upc) verifyCaller(items[_upc].masterjeweler) {
        items[_upc].itemState = State.SentFromCutting;
        emit SentFromCutting(_upc);
    }

    /**
     * @dev Receive the cut item back from the masterjeweler
     * @param _upc the item's upc
     */
    function receiveCutItem(uint _upc) 
        public 
        sentFromCutting(_upc)
        verifyCaller(items[_upc].manufacturer)
    {
        items[_upc].itemState = State.ReceivedFromCutting;
        emit ReceivedFromCutting(_upc);
    }

    /**
     * @dev Manufacturer marks the item for Purchasing for the given price
     * @param _upc the item's upc to mark for purchasing
     * @param _price the price for the disired product.
     * @notice The item is to treated as product now.
     */
    function markForPurchasing(uint _upc, uint _price) 
        public
        receivedFromCutting(_upc)
        verifyCaller(items[_upc].manufacturer)
    {
        items[_upc].itemState = State.MarkedForPurchasing;
        items[_upc].productPrice = _price;
        emit MarkedForPurchasing(_upc);
    }

    /**
     * @dev Send the marked item to the retailer to be displayed and purchased
     * @param _upc the item's upc
     * @param retailer The address of the retailer. Reverts if the given address is NOT a RetailerRole 
     */
    function sendItemForPurchasing(uint _upc, address retailer) 
        public
        markedForPurchasing(_upc)
        verifyCaller(items[_upc].manufacturer)
    {
        require(isRetailer(retailer), "The given address is not a Retailer Role");
        items[_upc].itemState = State.SentForPurchasing;
        items[_upc].retailer = retailer;
        emit SentForPurchasing(_upc);
    }

    /**
     * @dev Allows the retailer to receive the item (product)
     * @param _upc the item to receive  
     */
    function receiveItemForPurchasing(uint _upc) 
        public 
        sentForPurchasing(_upc) 
        verifyCaller(items[_upc].retailer)
    {
        items[_upc].itemState = State.ReceivedForPurchasing;
        emit ReceivedForPurchasing(_upc);
    }

    function putUpForPurchasing(uint _upc) 
        public
        receivedForPurchasing(_upc)
        verifyCaller(items[_upc].retailer)
        onlyRetailer
    {
        items[_upc].itemState = State.ForPurchasing;
        emit ForPurchasing(_upc);
    }

    /**
     * @dev Allows a customer to purchase the final product
     * @param _upc the item's upc that is being purchased
     */
    function purchaseItem(uint _upc)
        public 
        payable 
        forPurchasing(_upc) 
        paidEnough(items[_upc].productPrice) 
        onlyCustomer 
        checkValueForPurchasing(_upc)
    {
        Item storage item = items[_upc];
        address(uint160(item.retailer)).transfer(item.productPrice);
        item.owner = msg.sender;
        item.customer = msg.sender;
        item.itemState = State.Purchased;
        emit Purchased(_upc);
    }
    
    /**
     * @dev Allows the rightful customer to take the product out of the shop
     * @param _upc the item's upc to fetch/get out of shop
     */
    function fetchItem(uint _upc) public purchased(_upc) verifyCaller(items[_upc].customer)
    {
        items[_upc].itemState = State.Fetched;
        emit Fetched(_upc);
    }

    /**
     * @dev Allows the original miner to upload a image Hash of the item freshly mined.
     * @param _upc the item's upc to which the image hash belongs
     * @param _ipfsHash the image's ipfs hash
     */
    function uploadHash(uint _upc, string calldata _ipfsHash) 
        external 
        verifyCaller(items[_upc].miner) 
    {
        items[_upc].ipfsHash = _ipfsHash;
    }

    /**
     * @dev Read the ipfs image hash of the given upc item
     * @param _upc the item's upc
     * @return the image hash
     */
    function readHash(uint _upc) external view returns (string memory){
        return items[_upc].ipfsHash;
    }

    /**
     * @dev fetch data/info about the given item
     * @param _upc the item's upc   
     */
    function fetchItemBufferOne(uint _upc) 
        public 
        view 
        returns (
            uint sku,
            uint upc,
            address owner,
            address miner,
            string memory minerName,
            string memory mineInformation,
            string memory mineLatitude,
            string memory mineLongitude
        ) 
    {
        Item memory item = items[_upc];
        return (
            item.sku,
            item.upc,
            item.owner,
            item.miner,
            item.minerName,
            item.mineInformation,
            item.mineLatitude,
            item.mineLongitude
        );
    }

    /**
     * @dev fetch data/info about the given item
     * @param _upc the item's upc   
     */
    function fetchItemBufferTwo(uint _upc) 
        public 
        view 
        returns (
            uint sku,
            uint upc,
            uint productID,
            string memory itemNotes,
            uint itemPrice,
            uint productPrice,
            State itemState,
            address manufacturer,
            address masterjeweler,
            address retailer,
            address customer
        ) 
    {
        Item memory item = items[_upc];
        return (
            item.sku,
            item.upc,
            item.productID,
            item.itemNotes,
            item.itemPrice,
            item.productPrice,
            item.itemState,
            item.manufacturer,
            item.masterjeweler,
            item.retailer,
            item.customer
        );
    }
}