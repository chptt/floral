import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './App.css';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const MINT_PRICE = '0.000001';
const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex

const CONTRACT_ABI = [
  "function mint(string memory tokenURI) public payable returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function ownerOf(uint256 tokenId) public view returns (address)"
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

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

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

    if (!CONTRACT_ADDRESS || !PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      setError('Please configure environment variables');
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
      
      const tx = await contract.mint(metadataUrl, {
        value: ethers.parseEther(MINT_PRICE)
      });
      
      setTxHash(tx.hash);
      setSuccess('Processing...');
      
      await tx.wait();
      
      setSuccess(`Your picture has been saved successfully!`);
      setNftName('');
      setNftDescription('');
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
    } catch (err) {
      console.error('Error minting NFT:', err);
      if (err.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds. You need at least 0.000001 ETH plus gas fees.');
      } else if (err.code === 'ACTION_REJECTED') {
        setError('Action cancelled');
      } else {
        setError(err.message || 'Failed to save picture');
      }
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>Floral Gallery</h1>
        
        {!isConnected ? (
          <button className="connect-btn" onClick={connectWallet}>
            Connect MetaMask
          </button>
        ) : (
          <div className="wallet-info">
            <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
            {network && <p className="network">Network: {network}</p>}
          </div>
        )}

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {isConnected && (
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

            <div className="mint-info">
              <p>Fee: {MINT_PRICE} ETH</p>
              <p className="gas-note">+ network fees</p>
            </div>

            <button
              className="mint-btn"
              onClick={mintNFT}
              disabled={isMinting || !selectedFile || !nftName || !nftDescription}
            >
              {isMinting ? 'Saving...' : 'Save Picture'}
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
        )}
      </div>
    </div>
  );
}

export default App;
