# Floral Gallery

A web application for uploading and saving floral pictures.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your configuration:
```
VITE_CONTRACT_ADDRESS=your_contract_address
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_api_key
```

3. Run the development server:
```bash
npm run dev
```

## Deploy to Vercel

### Option 1: Via Vercel Dashboard

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure project:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. **Add Environment Variables** (Important!):
   - Click "Environment Variables"
   - Add these three variables:
     - `VITE_CONTRACT_ADDRESS` = your deployed contract address
     - `VITE_PINATA_API_KEY` = your Pinata API key
     - `VITE_PINATA_SECRET_API_KEY` = your Pinata secret key
7. Click "Deploy"

### Option 2: Via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Add environment variables:
```bash
vercel env add VITE_CONTRACT_ADDRESS
vercel env add VITE_PINATA_API_KEY
vercel env add VITE_PINATA_SECRET_API_KEY
```

5. Deploy to production:
```bash
vercel --prod
```

## Important Notes

- Make sure to add all three environment variables in Vercel
- The app will show error messages if environment variables are missing
- Get Sepolia testnet ETH from https://sepoliafaucet.com/
