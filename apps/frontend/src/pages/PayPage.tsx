import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { StarkZap, OnboardStrategy, accountPresets, mainnetTokens, sepoliaTokens, fromAddress } from 'starkzap'
import type { Token } from 'starkzap'
import type { PublicMerchant } from '../types'
import { api } from '../services/api'
import { CopyButton, Spinner, Button } from '../components/ui'

const API_URL = import.meta.env.VITE_API_URL as string

const USDC_MAINNET  = '0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb'
const USDCE_MAINNET = '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
const USDC_SEPOLIA  = '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080'

type PayStep =
  | 'loading'
  | 'ready'
  | 'connecting'
  | 'amount'
  | 'paying'
  | 'done'
  | 'error'

interface Balances {
  usdc:  number
  usdce: number
  total: number
}

export function PayPage() {
  const { merchantId }  = useParams<{ merchantId: string }>()
  const { authenticated, login, getAccessToken } = usePrivy()

  const [merchant, setMerchant] = useState<PublicMerchant | null>(null)
  const [step, setStep]         = useState<PayStep>('loading')
  const [amount, setAmount]     = useState('')
  const [txHash, setTxHash]     = useState<string | null>(null)
  const [errMsg, setErrMsg]     = useState<string | null>(null)
  const [balances, setBalances] = useState<Balances | null>(null)
  const [payToken, setPayToken] = useState<'USDC' | 'USDC.e'>('USDC')
  const walletRef               = useRef<any>(null)
  const deployingRef            = useRef(false)

  // ── Load merchant ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!merchantId) return
    if (merchantId === 'demo') {
      setMerchant({
        id: 'demo', businessName: 'Demo Coffee Shop',
        walletAddress: '0x04a0bfed4de4e2cefd10c18c4f38c8d4b7e7f832a2b1c3d4e5f6a7b8c9d0e1f2',
        currency: 'USD', network: 'mainnet', logoUrl: null,
        fx: { rate: 1, currency: 'USD', fetchedAt: Date.now(), ageSeconds: 0 },
      })
      setStep('ready')
      return
    }
    api.merchants.get(merchantId)
      .then(m => { setMerchant(m); setStep('ready') })
      .catch(() => { setStep('error'); setErrMsg('Payment page not found.') })
  }, [merchantId])

  // ── Trigger wallet init when user authenticates ───────────────────────────
  useEffect(() => {
    if (!authenticated || !merchant || step !== 'ready') return
    if (walletRef.current) { setStep('amount'); return }
    initWallet()
  }, [authenticated, merchant])

  // ── Init wallet ───────────────────────────────────────────────────────────
  const initWallet = async () => {
    if (!merchant) return
    if (deployingRef.current) return
    deployingRef.current = true
    setStep('connecting')

    const network   = (merchant.network ?? 'mainnet') as 'mainnet' | 'sepolia' | 'devnet'
    const usdcToken = network === 'mainnet' ? mainnetTokens.USDC : sepoliaTokens.USDC

    try {
      const sdk = new StarkZap({
        network,
        paymaster: { nodeUrl: `${API_URL}/api/wallet/paymaster` },
      })

      const onboard = await sdk.onboard({
        strategy:      OnboardStrategy.Privy,
        accountPreset: accountPresets.argentXV050,
        deploy:        'if_needed',
        feeMode:       'user_pays',
        privy: {
          resolve: async () => {
            const token = await getAccessToken()
            const res   = await fetch(`${API_URL}/api/wallet/starknet`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error('Could not initialise wallet')
            const { wallet: w } = await res.json()
            if (!w.publicKey) throw new Error('Wallet not ready — try again shortly')
            return {
              walletId:  w.id,
              publicKey: w.publicKey,
              serverUrl: `${API_URL}/api/wallet/sign`,
            }
          },
        },
      })

      walletRef.current = onboard.wallet

      // Fetch both USDC and USDC.e balances
      let usdc  = 0
      let usdce = 0

      try {
        const b = await onboard.wallet.balanceOf(usdcToken)
        usdc = parseFloat(b.toUnit())
      } catch { /* ignore */ }

      // USDC.e — mainnet only, use raw contract address as Token
      if (network === 'mainnet') {
        try {
          const usdceToken: Token = {
            name:     'Bridged USDC',
            address:  fromAddress(USDCE_MAINNET),
            decimals: 6,
            symbol:   'USDC.e',
          }
          const b = await onboard.wallet.balanceOf(usdceToken)
          usdce = parseFloat(b.toUnit())
        } catch { /* ignore */ }
      }

      setBalances({ usdc, usdce, total: usdc + usdce })
      // Default to whichever token has a higher balance
      setPayToken(usdce > usdc ? 'USDC.e' : 'USDC')
      setStep('amount')
    } catch (e: any) {
      if (e.message?.includes('same hash already exists')) {
        setErrMsg(null)
        setStep('connecting')
        deployingRef.current = false
        setTimeout(() => initWallet(), 20000)
        return
      }
      setStep('error')
      setErrMsg(e.message)
    } finally {
      deployingRef.current = false
    }
  }

  // ── Pay ───────────────────────────────────────────────────────────────────
  const pay = async () => {
    if (!merchant || !walletRef.current) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setStep('paying')
    try {
      const network  = (merchant.network ?? 'mainnet') as 'mainnet' | 'sepolia'
      const usdcAddr = payToken === 'USDC.e'
        ? USDCE_MAINNET
        : network === 'mainnet' ? USDC_MAINNET : USDC_SEPOLIA

      const tx = await walletRef.current.execute(
        [{
          contractAddress: usdcAddr,
          entrypoint:      'transfer',
          calldata:        [merchant.walletAddress, String(Math.round(parsed * 1_000_000)), '0'],
        }],
        { feeMode: 'sponsored' },
      )
      await tx.wait()
      setTxHash(tx.hash)
      setStep('done')
    } catch (e: any) {
      setErrMsg(e.message)
      setStep('error')
    }
  }

  const explorerBase = merchant?.network === 'mainnet'
    ? 'https://voyager.online/tx'
    : 'https://sepolia.voyager.online/tx'

  const explorerAddrBase = merchant?.network === 'mainnet'
    ? 'https://voyager.online/contract'
    : 'https://sepolia.voyager.online/contract'

  const fx           = merchant?.fx
  const fxStr        = fx ? `1 USDC ≈ ${fx.rate.toFixed(2)} ${merchant?.currency}` : null
  const networkLabel = merchant?.network === 'mainnet' ? 'Mainnet' : 'Sepolia'

  const parsedAmount    = parseFloat(amount)
  const activeBalance   = balances ? (payToken === 'USDC.e' ? balances.usdce : balances.usdc) : null
  const insufficientFunds = activeBalance !== null && parsedAmount > 0 && parsedAmount > activeBalance

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(200,146,42,0.06) 0%, transparent 60%), #080604' }}>
      <div className="w-full max-w-sm">

        {/* Merchant identity */}
        {merchant && (
          <div className="text-center mb-8">
            {merchant.logoUrl && (
              <img src={merchant.logoUrl} alt={merchant.businessName}
                className="w-14 h-14 rounded-full mx-auto mb-3 object-cover border border-white/10" />
            )}
            <div className="text-[10px] tracking-[0.28em] uppercase text-gold mb-2">Pay with USDC</div>
            <h1 className="font-display text-3xl font-bold text-cream">{merchant.businessName}</h1>
            {fxStr && (
              <p className="text-[11px] text-muted mt-1">
                {fxStr}
                {fx && <span className="text-dim ml-1">· {fx.ageSeconds}s ago</span>}
              </p>
            )}
          </div>
        )}

        <div className="bg-s1 border border-white/7 rounded-2xl p-6">

          {step === 'loading' && (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          )}

          {step === 'error' && (
            <div className="text-center py-4">
              <p className="text-sm text-danger mb-2">{errMsg ?? 'Something went wrong.'}</p>
              {errMsg && !errMsg.includes('not found') && (
                <button
                  onClick={() => {
                    setErrMsg(null)
                    if (walletRef.current) {
                      setStep('amount')
                    } else {
                      deployingRef.current = false
                      setStep('ready')
                    }
                  }}
                  className="text-[11px] text-gold underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {step === 'ready' && merchant && (
            <>
              <p className="text-[10px] tracking-widest uppercase text-muted mb-2">Send USDC to this address</p>
              <div className="bg-s2 border border-white/7 rounded-xl px-4 py-3 mb-2">
                <p className="text-[11px] font-mono text-cream break-all leading-relaxed">{merchant.walletAddress}</p>
              </div>
              <CopyButton value={merchant.walletAddress} label="Copy address" />

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/7" />
                <span className="text-[10px] tracking-widest uppercase text-dim">or</span>
                <div className="flex-1 h-px bg-white/7" />
              </div>

              <p className="text-[10px] tracking-widest uppercase text-muted mb-3">Pay directly — no wallet needed</p>
              <Button onClick={login} className="w-full" variant="outline">
                Continue with email / Google →
              </Button>
              <p className="text-[11px] text-dim mt-2 text-center leading-relaxed">
                We create a Starknet wallet for you automatically.
              </p>
            </>
          )}

          {step === 'connecting' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size={24} />
              <p className="text-xs text-muted">Setting up your wallet…</p>
              <p className="text-[11px] text-dim">This only takes a moment.</p>
            </div>
          )}

          {step === 'amount' && merchant && (
            <>
              {/* Token selector — only show if both have balance */}
              {balances && balances.usdce > 0 && balances.usdc > 0 && (
                <div className="flex gap-2 mb-4">
                  {(['USDC', 'USDC.e'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setPayToken(t)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                        payToken === t
                          ? 'bg-gold/20 border border-gold/40 text-gold'
                          : 'bg-s2 border border-white/7 text-dim'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[10px] tracking-widest uppercase text-muted mb-4">Enter amount</p>
              <div className="relative mb-2">
                <input
                  type="number" min="0.01" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className={`w-full bg-s2 border rounded-xl px-4 py-4 text-2xl font-display font-bold text-cream placeholder-dim focus:outline-none transition-colors pr-24 ${
                    insufficientFunds
                      ? 'border-danger focus:border-danger'
                      : 'border-white/10 focus:border-gold'
                  }`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gold">{payToken}</span>
              </div>

              {/* Balance display */}
              {balances && (
                <div className="mb-4 space-y-1">
                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dim">
                      Total: <span className={`font-semibold ${balances.total === 0 ? 'text-danger' : 'text-cream'}`}>
                        {balances.total.toFixed(4)} USDC
                      </span>
                    </span>
                    {insufficientFunds && (
                      <span className="text-[10px] text-danger">Insufficient balance</span>
                    )}
                    {activeBalance !== null && parsedAmount > 0 && !insufficientFunds && (
                      <span className="text-[11px] text-dim">
                        After: <span className="text-cream">{(activeBalance - parsedAmount).toFixed(4)}</span>
                      </span>
                    )}
                  </div>
                  {/* Breakdown — show if both non-zero */}
                  {balances.usdc > 0 && balances.usdce > 0 && (
                    <div className="flex gap-3 text-[10px] text-dim">
                      <span>USDC: <span className="text-muted">{balances.usdc.toFixed(4)}</span></span>
                      <span>USDC.e: <span className="text-muted">{balances.usdce.toFixed(4)}</span></span>
                    </div>
                  )}
                  {/* Single balance if only one */}
                  {(balances.usdc === 0 || balances.usdce === 0) && (
                    <div className="text-[11px] text-dim">
                      {payToken}: <span className={`font-semibold ${activeBalance === 0 ? 'text-danger' : 'text-cream'}`}>
                        {activeBalance?.toFixed(4)} {payToken}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {fx && amount && parsedAmount > 0 && (
                <p className="text-xs text-muted mb-5 text-center">
                  ≈ {(parsedAmount * fx.rate).toFixed(2)} {merchant.currency}
                </p>
              )}

              <Button
                onClick={pay}
                disabled={!amount || parsedAmount <= 0 || insufficientFunds}
                className="w-full"
              >
                Pay {amount ? `${parsedAmount.toFixed(2)} ${payToken}` : ''}
              </Button>

              <p className="text-[10px] text-dim text-center mt-2">Gas is sponsored — no extra fees</p>

              <div className="mt-5 pt-5 border-t border-white/7">
                <p className="text-[10px] tracking-widest uppercase text-dim mb-2">Or pay with Argent / Braavos</p>
                <div className="flex items-center gap-2 bg-s2 border border-white/7 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-mono text-dim truncate flex-1">{merchant.walletAddress}</p>
                  <CopyButton value={merchant.walletAddress} />
                </div>
              </div>
            </>
          )}

          {step === 'paying' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size={24} />
              <p className="text-xs text-muted">Sending payment…</p>
              <p className="text-[11px] text-dim">This usually takes a few seconds.</p>
            </div>
          )}

          {step === 'done' && txHash && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-ok/10 border-2 border-ok flex items-center justify-center text-2xl mx-auto mb-5">✓</div>
              <h2 className="font-display text-2xl font-bold text-cream mb-1">Payment sent!</h2>
              <p className="text-xs text-muted mb-5">Your USDC is on its way to {merchant?.businessName}.</p>
              <a href={`${explorerBase}/${txHash}`} target="_blank" rel="noreferrer"
                className="text-[11px] text-gold underline">
                View on Voyager ↗
              </a>
            </div>
          )}
        </div>

        {merchant && (
          <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-gold/60" />
            Starknet {networkLabel} · USDC ·{' '}
            <a href={`${explorerAddrBase}/${merchant.walletAddress}`} target="_blank" rel="noreferrer"
              className="hover:text-muted transition-colors">Verify ↗</a>
          </div>
        )}
      </div>
    </div>
  )
}