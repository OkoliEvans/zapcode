import nodemailer from 'nodemailer'
import process from 'node:process'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = `"Zapcode" <${process.env.GMAIL_USER}>`

function paymentReceivedHtml({ businessName, amount, fromAddress, txHash, fiatAmount, fiatCurrency, network }) {
  const explorerBase = network === 'mainnet'
    ? 'https://voyager.online/tx'
    : 'https://sepolia.voyager.online/tx'

  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#060912;color:#eef1ff;padding:36px;border-radius:12px;">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#4d7cfe;margin-bottom:8px;">Zapcode</div>
    <h1 style="font-size:28px;margin:0 0 6px;color:#eef1ff;">Payment received ✓</h1>
    <p style="color:#8fa4c8;font-size:13px;margin:0 0 28px;">A USDC payment just landed on your wallet.</p>

    <div style="background:#111828;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="font-size:36px;font-weight:700;color:#4d7cfe;">${parseFloat(amount).toFixed(2)} USDC</div>
      ${fiatAmount ? `<div style="font-size:13px;color:#8fa4c8;margin-top:4px;">≈ ${fiatAmount.toFixed(2)} ${fiatCurrency}</div>` : ''}
    </div>

    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr><td style="color:#8fa4c8;padding:6px 0;">Business</td><td style="text-align:right;color:#eef1ff;">${businessName}</td></tr>
      <tr><td style="color:#8fa4c8;padding:6px 0;">From</td><td style="text-align:right;color:#eef1ff;font-family:monospace;font-size:11px;">${fromAddress.slice(0,14)}…${fromAddress.slice(-8)}</td></tr>
      <tr><td style="color:#8fa4c8;padding:6px 0;">Network</td><td style="text-align:right;color:#eef1ff;">Starknet ${network === 'mainnet' ? 'Mainnet' : 'Sepolia'}</td></tr>
    </table>

    <a href="${explorerBase}/${txHash}" style="display:block;margin-top:24px;padding:14px;background:#4d7cfe;color:#ffffff;text-align:center;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
      View on Voyager →
    </a>

    <p style="margin-top:28px;font-size:12px;color:#6b7ea8;text-align:center;letter-spacing:.02em;">
      Zapcode · Non-custodial USDC payments on Starknet
    </p>
  </div>`
}

function welcomeHtml({ businessName, walletAddress }) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#060912;color:#eef1ff;padding:36px;border-radius:12px;">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#4d7cfe;margin-bottom:8px;">Zapcode</div>
    <h1 style="font-size:28px;margin:0 0 6px;color:#eef1ff;">Welcome, ${businessName} 👋</h1>
    <p style="color:#8fa4c8;font-size:13px;margin:0 0 28px;">Your USDC payment QR code is ready. Start accepting payments immediately.</p>

    <div style="background:#111828;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8fa4c8;margin-bottom:6px;">Your wallet address</div>
      <div style="font-family:monospace;font-size:12px;color:#4d7cfe;word-break:break-all;line-height:1.6;">${walletAddress}</div>
    </div>

    <p style="font-size:13px;color:#8fa4c8;line-height:1.8;">
      Your QR code is available in your dashboard. Download it, print it, and place it anywhere — your counter, tables, invoices, or website.<br/><br/>
      Zapcode never holds your funds. Your wallet, your keys.
    </p>

    <p style="margin-top:28px;font-size:12px;color:#6b7ea8;text-align:center;letter-spacing:.02em;">
      Zapcode · Non-custodial USDC payments on Starknet
    </p>
  </div>`
}

export async function sendPaymentReceived(merchant, tx, fxResult) {
  await transporter.sendMail({
    from:    FROM,
    to:      merchant.email,
    subject: `✓ ${parseFloat(tx.amount).toFixed(2)} USDC received — ${merchant.businessName}`,
    html:    paymentReceivedHtml({
      businessName: merchant.businessName,
      amount:       tx.amount,
      fromAddress:  tx.fromAddress,
      txHash:       tx.txHash,
      fiatAmount:   fxResult?.amount ?? null,
      fiatCurrency: merchant.currency,
      network:      merchant.network,
    }),
  })
}

export async function sendWelcome(merchant) {
  await transporter.sendMail({
    from:    FROM,
    to:      merchant.email,
    subject: `Welcome to Zapcode — ${merchant.businessName}`,
    html:    welcomeHtml({
      businessName:  merchant.businessName,
      walletAddress: merchant.walletAddress,
    }),
  })
}