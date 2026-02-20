// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMinter is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    uint256 public purchasePrice = 0.00001 ether;
    
    struct NFTInfo {
        address creator;
        uint256 price;
        bool forSale;
    }
    
    mapping(uint256 => NFTInfo) public nftInfo;
    
    event NFTMinted(address indexed creator, uint256 indexed tokenId, string tokenURI);
    event NFTPurchased(address indexed buyer, address indexed seller, uint256 indexed tokenId, uint256 price);
    event NFTListedForSale(uint256 indexed tokenId, uint256 price);
    event NFTRemovedFromSale(uint256 indexed tokenId);

    constructor() ERC721("FloralGallery", "FLORAL") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    function mint(string memory tokenURI, uint256 price) public returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        nftInfo[newTokenId] = NFTInfo({
            creator: msg.sender,
            price: price,
            forSale: true
        });
        
        emit NFTMinted(msg.sender, newTokenId, tokenURI);
        
        return newTokenId;
    }

    function burn(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        _burn(tokenId);
        delete nftInfo[tokenId];
    }

    function purchaseNFT(uint256 tokenId) public payable {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        require(nftInfo[tokenId].forSale, "NFT is not for sale");
        require(msg.value >= nftInfo[tokenId].price, "Insufficient payment");
        require(msg.sender != ownerOf(tokenId), "You already own this NFT");
        
        address seller = ownerOf(tokenId);
        uint256 price = nftInfo[tokenId].price;
        
        nftInfo[tokenId].forSale = false;
        
        _transfer(seller, msg.sender, tokenId);
        
        payable(seller).transfer(price);
        
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit NFTPurchased(msg.sender, seller, tokenId, price);
    }

    function listForSale(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        require(price > 0, "Price must be greater than 0");
        
        nftInfo[tokenId].price = price;
        nftInfo[tokenId].forSale = true;
        
        emit NFTListedForSale(tokenId, price);
    }

    function removeFromSale(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        
        nftInfo[tokenId].forSale = false;
        
        emit NFTRemovedFromSale(tokenId);
    }

    function getAllNFTs() public view returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](_tokenIdCounter);
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            tokenIds[i - 1] = i;
        }
        return tokenIds;
    }

    function getNFTsForSale() public view returns (uint256[] memory) {
        uint256 forSaleCount = 0;
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (nftInfo[i].forSale) {
                forSaleCount++;
            }
        }
        
        uint256[] memory forSaleTokens = new uint256[](forSaleCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (nftInfo[i].forSale) {
                forSaleTokens[index] = i;
                index++;
            }
        }
        
        return forSaleTokens;
    }

    function getTotalMinted() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function setPurchasePrice(uint256 newPrice) public onlyOwner {
        purchasePrice = newPrice;
    }
}
