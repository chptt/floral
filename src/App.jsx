import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './App.css';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const MINT_PRICE = '0.000001';
const SEPOLIA_CHAIN_ID = '0xaa36a7';

const CONTRACT_ABI = [
  "function mint(string memory tokenURI, uint256 price) public returns (uint256)",
  "function burn(uint256 tokenId) public",
  "function purchaseNFT(uint256 tokenId) public payable",
  "function listForSale(uint256 tokenId, uint256 price) public",
  "function removeFromSale(uint256 tokenId) public",
  "function getAllNFTs() public view returns (uint256[] memory)",
  "function getNFTsForSale() public view returns (uint256[] memory)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function nftInfo(uint256 tokenId) public view returns (address creator, uint256 price, bool forSale)",
  "function getTotalMinted() public view returns (uint256)"
];

function App() {
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [network, setNetwork] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [allNFTs, setAllNFTs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [isBuying, setIsBuying] = useState(false);
  const [nftPrice, setNftPrice] = useState('0.00001');
  const [nftQuantity, setNftQuantity] = useState(1);
  const [showOnlyForSale, setShowOnlyForSale] = useState(false);

  useEffect(() => {
    checkIfWalletIsConnected();
    loadAllNFTs();
  }, []);

  const loadAllNFTs = async () => {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') {
      console.log('No contract address configured');
      setAllNFTs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let provider;
      
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      }
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      console.log('Loading NFTs from contract:', CONTRACT_ADDRESS);
      
      const totalMinted = await contract.getTotalMinted();
      console.log('Total minted:', totalMinted.toString());
      
      if (totalMinted.toString() === '0') {
        setAllNFTs([]);
        setIsLoading(false);
        return;
      }
      
      const tokenIds = await contract.getAllNFTs();
      console.log('Token IDs:', tokenIds);
      
      const nftsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const tokenURI = await contract.tokenURI(tokenId);
            const owner = await contract.ownerOf(tokenId);
            const nftInfoData = await contract.nftInfo(tokenId);
            
            console.log(`Loading metadata for token ${tokenId} from:`, tokenURI);
            
            const metadataResponse = await fetch(tokenURI);
            const metadata = await metadataResponse.json();
            
            return {
              tokenId: tokenId.toString(),
              name: metadata.name,
              description: metadata.description,
              image: metadata.image,
              owner: owner,
              creator: nftInfoData.creator,
              price: ethers.formatEther(nftInfoData.price),
              forSale: nftInfoData.forSale
            };
          } catch (err) {
            console.error(`Error loading NFT ${tokenId}:`, err);
            return null;
          }
        })
      );
      
      const validNFTs = nftsData.filter(nft => nft !== null).reverse();
      console.log('Loaded NFTs:', validNFTs);
      setAllNFTs(validNFTs);
    } catch (err) {
      console.error('Error loading NFTs:', err);
      setAllNFTs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        await checkNetwork();
      }

      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
        } else {
          setAccount('');
          setIsConnected(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    } catch (err) {
      console.error(err);
      setError('Error checking wallet connection');
    }
  };

  const checkNetwork = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setNetwork(network.name);
      
      if (network.chainId !== BigInt(11155111)) {
        setError('Please switch to Sepolia testnet');
        return false;
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAccount(accounts[0]);
      setIsConnected(true);
      setError('');
      
      await switchToSepolia();
    } catch (err) {
      console.error(err);
      setError('Failed to connect wallet');
    }
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      setError('');
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          });
        } catch (addError) {
          setError('Failed to add Sepolia network');
        }
      } else {
        setError('Failed to switch to Sepolia network');
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a valid image file');
    }
  };

  const uploadToIPFS = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({
      name: file.name,
    });
    formData.append('pinataMetadata', metadata);

    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_API_KEY,
          },
        }
      );
      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } catch (err) {
      console.error('Error uploading file to IPFS:', err);
      throw new Error('Failed to upload image to IPFS');
    }
  };

  const uploadMetadataToIPFS = async (metadata) => {
    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        metadata,
        {
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_API_KEY,
          },
        }
      );
      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } catch (err) {
      console.error('Error uploading metadata to IPFS:', err);
      throw new Error('Failed to upload metadata to IPFS');
    }
  };

  const mintNFT = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!selectedFile || !nftName || !nftDescription) {
      setError('Please fill in all fields and select a picture');
      return;
    }

    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') {
      setError('Contract address not configured. Please contact the administrator.');
      return;
    }

    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      setError('Storage service not configured. Please contact the administrator.');
      return;
    }

    const isCorrectNetwork = await checkNetwork();
    if (!isCorrectNetwork) {
      setError('Please switch to Sepolia testnet');
      return;
    }

    setIsMinting(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      setSuccess('Uploading your picture...');
      const imageUrl = await uploadToIPFS(selectedFile);
      
      setSuccess('Saving your picture...');
      const metadata = {
        name: nftName,
        description: nftDescription,
        image: imageUrl,
      };
      const metadataUrl = await uploadMetadataToIPFS(metadata);
      
      setSuccess('Processing...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      try {
        const priceInWei = ethers.parseEther(nftPrice);
        const quantity = parseInt(nftQuantity);
        
        for (let i = 0; i < quantity; i++) {
          setSuccess(`Minting ${i + 1} of ${quantity}...`);
          const tx = await contract.mint(metadataUrl, priceInWei);
          await tx.wait();
          
          if (i === 0) {
            setTxHash(tx.hash);
          }
        }
        
        setSuccess(`Successfully minted ${quantity} NFT${quantity > 1 ? 's' : ''}!`);
        setNftName('');
        setNftDescription('');
        setSelectedFile(null);
        setNftPrice('0.00001');
        setNftQuantity(1);
        document.getElementById('fileInput').value = '';
        
        await loadAllNFTs();
        
        setTimeout(() => {
          setShowForm(false);
          setSuccess('');
        }, 2000);
      } catch (contractErr) {
        console.error('Contract error:', contractErr);
        if (contractErr.code === 'CALL_EXCEPTION') {
          setError('Contract error. Please verify: 1) Contract address is correct, 2) You have enough ETH for gas fees, 3) Contract is deployed on Sepolia');
        } else {
          throw contractErr;
        }
      }
    } catch (err) {
      console.error('Error minting NFT:', err);
      if (err.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds. You need at least 0.000001 ETH plus gas fees.');
      } else if (err.code === 'ACTION_REJECTED') {
        setError('Action cancelled');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to save picture. Please try again.');
      }
    } finally {
      setIsMinting(false);
    }
  };

  const buyNFT = async (tokenId, price) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsBuying(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const priceInWei = ethers.parseEther(price);
      
      setSuccess('Processing purchase...');
      const tx = await contract.purchaseNFT(tokenId, {
        value: priceInWei
      });

      setTxHash(tx.hash);
      setSuccess('Transaction submitted...');

      await tx.wait();

      setSuccess('Purchase successful!');
      setSelectedNFT(null);
      await loadAllNFTs();
    } catch (err) {
      console.error('Error buying NFT:', err);
      if (err.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds to purchase this NFT');
      } else if (err.code === 'ACTION_REJECTED') {
        setError('Transaction cancelled');
      } else {
        setError(err.message || 'Failed to purchase NFT');
      }
    } finally {
      setIsBuying(false);
    }
  };

  const deleteNFT = async (tokenId) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this NFT? This action cannot be undone.')) {
      return;
    }

    setIsBuying(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setSuccess('Deleting NFT...');
      const tx = await contract.burn(tokenId);

      await tx.wait();

      setSuccess('NFT deleted successfully!');
      setSelectedNFT(null);
      await loadAllNFTs();
    } catch (err) {
      console.error('Error deleting NFT:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction cancelled');
      } else {
        setError(err.message || 'Failed to delete NFT');
      }
    } finally {
      setIsBuying(false);
    }
  };

  const updatePrice = async (tokenId, newPrice) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!newPrice || parseFloat(newPrice) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    setIsBuying(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const priceInWei = ethers.parseEther(newPrice);
      
      setSuccess('Updating price...');
      const tx = await contract.listForSale(tokenId, priceInWei);

      await tx.wait();

      setSuccess('Price updated successfully!');
      await loadAllNFTs();
      
      const updatedNFT = { ...selectedNFT, price: newPrice };
      setSelectedNFT(updatedNFT);
    } catch (err) {
      console.error('Error updating price:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction cancelled');
      } else {
        setError(err.message || 'Failed to update price');
      }
    } finally {
      setIsBuying(false);
    }
  };

  const downloadImage = async (imageUrl, nftName) => {
    try {
      setSuccess('Downloading image...');
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${nftName.replace(/[^a-z0-9]/gi, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Image downloaded successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error downloading image:', err);
      setError('Failed to download image. You can right-click and save the image manually.');
    }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>Floral Gallery</h1>
          <div className="header-right">
            {isConnected && !showForm && (
              <button className="upload-btn" onClick={() => setShowForm(true)}>
                + Upload Picture
              </button>
            )}
            {!isConnected ? (
              <button className="connect-btn-small" onClick={connectWallet}>
                Connect Wallet
              </button>
            ) : (
              <div className="header-wallet">
                <span className="wallet-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
                {network && <span className="network-badge">{network}</span>}
              </div>
            )}
          </div>
        </header>

        {!showForm && (
          <>
            {error && <div className="error" style={{margin: '20px 40px'}}>{error}</div>}
            {success && <div className="success" style={{margin: '20px 40px'}}>{success}</div>}

            <div className="gallery-header">
              <h2>Discover Beautiful Flowers</h2>
              <p className="gallery-subtext">Explore floral pictures from our community</p>
              <div className="filter-section">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={showOnlyForSale}
                    onChange={(e) => setShowOnlyForSale(e.target.checked)}
                  />
                  <span>Show only available for sale</span>
                </label>
              </div>
            </div>

            {isLoading ? (
              <div className="loading">Loading gallery...</div>
            ) : allNFTs.filter(nft => !showOnlyForSale || nft.forSale).length === 0 ? (
              <div className="empty-gallery">
                <p>Empty</p>
                {!isConnected && (
                  <button className="connect-btn" onClick={connectWallet}>
                    Connect Wallet to Upload
                  </button>
                )}
              </div>
            ) : (
              <div className="gallery-grid">
                {allNFTs.filter(nft => !showOnlyForSale || nft.forSale).map((nft) => (
                  <div key={nft.tokenId} className="nft-card" onClick={() => setSelectedNFT(nft)}>
                    <img src={nft.image} alt={nft.name} className="nft-image" />
                    <div className="nft-info">
                      <h3>{nft.name}</h3>
                      <p className="nft-description">{nft.description}</p>
                      <div className="nft-meta">
                        <span className="nft-owner">By: {nft.creator.slice(0, 6)}...{nft.creator.slice(-4)}</span>
                        {nft.forSale && <span className="for-sale-badge">For Sale: {nft.price} ETH</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedNFT && (
          <div className="modal-overlay" onClick={() => setSelectedNFT(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedNFT(null)}>×</button>
              <div className="modal-body">
                <div className="modal-image-container">
                  <img src={selectedNFT.image} alt={selectedNFT.name} className="modal-image" />
                </div>
                <div className="modal-details">
                  <h2>{selectedNFT.name}</h2>
                  <p className="modal-description">{selectedNFT.description}</p>
                  
                  <div className="modal-info">
                    <div className="info-row">
                      <span className="info-label">Creator:</span>
                      <span className="info-value">{selectedNFT.creator.slice(0, 6)}...{selectedNFT.creator.slice(-4)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Owner:</span>
                      <span className="info-value">{selectedNFT.owner.slice(0, 6)}...{selectedNFT.owner.slice(-4)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Token ID:</span>
                      <span className="info-value">#{selectedNFT.tokenId}</span>
                    </div>
                    {selectedNFT.forSale && (
                      <div className="info-row">
                        <span className="info-label">Price:</span>
                        <span className="info-value price">{selectedNFT.price} ETH</span>
                      </div>
                    )}
                  </div>

                  {selectedNFT.forSale && selectedNFT.owner.toLowerCase() !== account.toLowerCase() && (
                    <button 
                      className="buy-btn" 
                      onClick={() => buyNFT(selectedNFT.tokenId, selectedNFT.price)}
                      disabled={isBuying || !isConnected}
                    >
                      {isBuying ? 'Purchasing...' : `Buy for ${selectedNFT.price} ETH`}
                    </button>
                  )}

                  {selectedNFT.owner.toLowerCase() === account.toLowerCase() && (
                    <div className="owner-actions">
                      <div className="owner-badge">You own this NFT</div>
                      
                      <button 
                        className="download-btn" 
                        onClick={() => downloadImage(selectedNFT.image, selectedNFT.name)}
                      >
                        📥 Download Image
                      </button>
                      
                      {selectedNFT.forSale && (
                        <div className="update-price-section">
                          <label>Update Price (ETH)</label>
                          <input
                            type="number"
                            step="0.00001"
                            min="0.00001"
                            defaultValue={selectedNFT.price}
                            id={`price-${selectedNFT.tokenId}`}
                            className="price-input"
                          />
                          <button 
                            className="update-price-btn" 
                            onClick={() => {
                              const newPrice = document.getElementById(`price-${selectedNFT.tokenId}`).value;
                              updatePrice(selectedNFT.tokenId, newPrice);
                            }}
                            disabled={isBuying}
                          >
                            Update Price
                          </button>
                        </div>
                      )}
                      
                      <button 
                        className="delete-btn" 
                        onClick={() => deleteNFT(selectedNFT.tokenId)}
                        disabled={isBuying}
                      >
                        {isBuying ? 'Deleting...' : 'Delete NFT'}
                      </button>
                    </div>
                  )}

                  {!selectedNFT.forSale && (
                    <div className="not-for-sale">Not for sale</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="upload-section">
            <div className="upload-container">
              <div className="upload-card">
                <div className="upload-header">
                  <h2>Upload Your Floral Picture</h2>
                  <button className="back-btn" onClick={() => {
                    setShowForm(false);
                    setError('');
                    setSuccess('');
                  }}>
                    ← Back to Gallery
                  </button>
                </div>

                {error && <div className="error">{error}</div>}
                {success && <div className="success">{success}</div>}
          <div className="mint-form">
            <div className="form-group">
              <label>Flower Name</label>
              <input
                type="text"
                value={nftName}
                onChange={(e) => setNftName(e.target.value)}
                placeholder="e.g., Rose, Tulip, Orchid"
                disabled={isMinting}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={nftDescription}
                onChange={(e) => setNftDescription(e.target.value)}
                placeholder="Describe your flower..."
                disabled={isMinting}
                rows="4"
              />
            </div>

            <div className="form-group">
              <label>Upload Picture</label>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isMinting}
              />
              {selectedFile && (
                <p className="file-name">Selected: {selectedFile.name}</p>
              )}
            </div>

            <div className="form-group">
              <label>Sale Price (ETH)</label>
              <input
                type="number"
                step="0.00001"
                min="0.00001"
                value={nftPrice}
                onChange={(e) => setNftPrice(e.target.value)}
                placeholder="0.00001"
                disabled={isMinting}
              />
              <p className="price-note">Set the price for your NFT in ETH</p>
            </div>

            <div className="form-group">
              <label>Quantity (Number of Copies)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={nftQuantity}
                onChange={(e) => setNftQuantity(e.target.value)}
                placeholder="1"
                disabled={isMinting}
              />
              <p className="price-note">How many copies to mint (1-100)</p>
            </div>

            <div className="mint-info">
              <p>Fee: FREE (only gas fees)</p>
              <p className="gas-note">You only pay network fees × {nftQuantity}</p>
            </div>

            <button
              className="mint-btn"
              onClick={mintNFT}
              disabled={isMinting || !selectedFile || !nftName || !nftDescription || !nftPrice || parseFloat(nftPrice) <= 0 || !nftQuantity || parseInt(nftQuantity) < 1 || parseInt(nftQuantity) > 100}
            >
              {isMinting ? 'Saving...' : `Save ${nftQuantity > 1 ? nftQuantity + ' Copies' : 'Picture'}`}
            </button>

            {txHash && (
              <div className="tx-hash">
                <p>Transaction Hash:</p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}
          </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
