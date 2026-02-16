// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMinter is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    uint256 public constant MINT_PRICE = 0.000001 ether;

    event NFTMinted(address indexed minter, uint256 indexed tokenId, string tokenURI);

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    function mint(string memory tokenURI) public payable returns (uint256) {
        require(msg.value == MINT_PRICE, "Incorrect payment amount. Must be exactly 0.000001 ETH");
        
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        emit NFTMinted(msg.sender, newTokenId, tokenURI);
        
        return newTokenId;
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    function getTotalMinted() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
