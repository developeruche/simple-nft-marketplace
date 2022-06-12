// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";




contract Marketplace is ReentrancyGuard {

    // declaration of state variables 
    address payable public immutable feeAccount;
    uint public immutable feePercent;
    uint public itemCount;

    struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool sold;
    }

    event Offered (
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );

    event Bought (
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    mapping (uint => Item) public items;

    constructor(uint _feePercent) {
        feeAccount = payable(msg.sender);
        feePercent = _feePercent;
    }


    function makeItem(IERC721 _nft, uint _tokenId, uint _price) external nonReentrant {
        require(_price > 0, "Price must be greater than zero");

        // increasing the item count
        itemCount++;

        // transferring the NFT to the smart contract
        _nft.transferFrom(msg.sender, address(this), _tokenId);

        // adding new item to mapping 
        items[itemCount] = Item(
            itemCount,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            false
        );

        // emiting event 
        emit Offered(itemCount, address(_nft), _tokenId, _price, msg.sender);
    }


    function purchaseItem(uint _itemId) external payable nonReentrant {
        uint _totalPrice = getTotalPrice(_itemId);
        Item storage item = items[_itemId];

        require(_itemId > 0 && _itemId <= itemCount, "item doesn't exist");
        require(msg.value >= _totalPrice, "not enough ether to cover item cost and market fee");
        require(!item.sold, "item already sold");

        // pay the seller and transaction fee
        item.seller.transfer(item.price);
        feeAccount.transfer(_totalPrice - item.price);

        // update the item to reflect that it has been sold
        item.sold = true;

        // transfering the nft to buyer
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);

        // emitting a bought event
        emit Bought(_itemId, address(item.nft), item.tokenId, item.price, item.seller, msg.sender);
    }

    function getTotalPrice(uint _itemId) view public returns(uint) {
        return(items[_itemId].price*(100 + feePercent) / 100);
    }

}
