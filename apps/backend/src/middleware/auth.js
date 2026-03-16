import { privy } from '../lib/privy.js'

/**
 * Verifies the Privy JWT from Authorization: Bearer <token>.
 * Attaches req.userId (Privy user id) for downstream routes.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const claims = await privy.verifyAuthToken(token)
    req.userId = claims.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}