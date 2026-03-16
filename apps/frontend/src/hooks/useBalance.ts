import { useState, useEffect } from 'react'
import { sepoliaTokens, mainnetTokens, fromAddress } from 'starkzap'
import type { Token } from 'starkzap'
import { useMerchant } from '../context/MerchantContext'

// Bridged USDC.e on Starknet mainnet
const USDCE_ADDRESS = '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'

const USDCE_TOKEN: Token = {
  name:     'Bridged USDC',
  address:  fromAddress(USDCE_ADDRESS),
  decimals: 6,
  symbol:   'USDC.e',
}

interface BalanceState {
  raw:     string | null   // formatted total: "42.50 USDC"
  usd:     number | null   // total numeric USDC amount for fiat conversion
  usdc:    number | null   // native USDC only
  usdce:   number | null   // bridged USDC.e only
  loading: boolean
  error:   string | null
}

export function useBalance() {
  const { wallet, merchant } = useMerchant()
  const [state, setState] = useState<BalanceState>({
    raw:     null,
    usd:     null,
    usdc:    null,
    usdce:   null,
    loading: false,
    error:   null,
  })

  useEffect(() => {
    if (!wallet || !merchant) return
    let cancelled = false

    async function fetchBalance() {
      setState(s => ({ ...s, loading: true, error: null }))
      try {
        const network = merchant!.network ?? 'mainnet'
        const USDC    = network === 'mainnet' ? mainnetTokens.USDC : sepoliaTokens.USDC

        // Fetch native USDC
        let usdc  = 0
        let usdce = 0

        try {
          const b = await wallet!.balanceOf(USDC)
          usdc = parseFloat(b.toUnit())
        } catch { /* ignore */ }

        // Fetch USDC.e — mainnet only
        if (network === 'mainnet') {
          try {
            const b = await wallet!.balanceOf(USDCE_TOKEN)
            usdce = parseFloat(b.toUnit())
          } catch { /* ignore */ }
        }

        if (cancelled) return

        const total = usdc + usdce

        setState({
          raw:     `USDC ${total.toFixed(2)}`,
          usd:     total,
          usdc,
          usdce,
          loading: false,
          error:   null,
        })
      } catch (e: any) {
        if (cancelled) return
        setState({ raw: null, usd: null, usdc: null, usdce: null, loading: false, error: e.message })
      }
    }

    fetchBalance()
    const interval = setInterval(fetchBalance, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [wallet, merchant])

  return state
}