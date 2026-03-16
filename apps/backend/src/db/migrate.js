import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './index.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  console.log('[migrate] running migrations…')
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../drizzle'),
  })
  console.log('[migrate] done')
  await pool.end()
}

main().catch(err => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})