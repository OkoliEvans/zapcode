import { PrivyClient as PrivyServerAuth } from '@privy-io/server-auth'
import { PrivyClient as PrivyNode } from '@privy-io/node'

if (!process.env.PRIVY_APP_ID)     throw new Error('PRIVY_APP_ID env var is required')
if (!process.env.PRIVY_APP_SECRET) throw new Error('PRIVY_APP_SECRET env var is required')

// server-auth: used for verifyAuthToken, getUser
export const privy = new PrivyServerAuth(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET,
)

// node: used for wallet create/sign (official StarkZap pattern)
export const privyNode = new PrivyNode({
  appId:     process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
})
