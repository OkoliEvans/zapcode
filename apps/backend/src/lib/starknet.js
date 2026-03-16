import { RpcProvider, hash } from 'starknet'
import process from 'node:process'

const network = process.env.STARKNET_NETWORK ?? 'mainnet'
if (network !== 'mainnet') console.warn('[starknet] WARNING: running on', network)

const RPC_URL = process.env.STARKNET_RPC_URL
if (!RPC_URL) throw new Error('STARKNET_RPC_URL is required')

export const provider = new RpcProvider({
  nodeUrl:         RPC_URL,
  blockIdentifier: 'latest',
})

// Native USDC on Starknet mainnet (Circle-issued)
export const USDC_ADDRESS = network === 'mainnet'
  ? '0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb'
  : '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080'

// Bridged USDC.e on Starknet mainnet (Stargate/LayerZero bridged)
export const USDCE_ADDRESS = network === 'mainnet'
  ? '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
  : null // no USDC.e on sepolia

export const TRANSFER_SELECTOR = hash.getSelectorFromName('Transfer')
export { network }