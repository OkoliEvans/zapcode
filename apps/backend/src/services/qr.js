import QRCode from 'qrcode'
import { Jimp } from 'jimp'

export function buildQRPayload(walletAddress, network, merchantId) {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  return `${base}/pay/${walletAddress}`
}

export async function generateQRPng(text, { businessName, logoUrl } = {}) {
  const SIZE = 800

  // QR with navy/blue palette
  const qrBuffer = await QRCode.toBuffer(text, {
    width:                SIZE,
    margin:               2,
    color: {
      dark:  '#eef1ff',  // blue-white modules
      light: '#060d1f',  // deep navy background
    },
    errorCorrectionLevel: 'H',
    type:                 'png',
  })

  if (!logoUrl) return qrBuffer
  console.log('[qr] generating with logo:', logoUrl)

  try {
    // Load QR image from buffer
    const qrImg = await Jimp.read(qrBuffer)

    // Fetch and load logo
    const logoRes = await fetch(logoUrl)
    if (!logoRes.ok) return qrBuffer
    const logoBuf = Buffer.from(await logoRes.arrayBuffer())
    const logoImg = await Jimp.read(logoBuf)

    // Resize logo to 18% of QR
    const logoSize = Math.round(SIZE * 0.18)
    logoImg.resize({ w: logoSize, h: logoSize })

    // Center coordinates
    const lx = Math.round((SIZE - logoSize) / 2)
    const ly = Math.round((SIZE - logoSize) / 2)

    // Composite logo onto QR
    qrImg.composite(logoImg, lx, ly)

    return await qrImg.getBuffer('image/png')
  } catch (err) {
    console.error('[qr] logo overlay failed:', err.message)
    return qrBuffer
  }
}