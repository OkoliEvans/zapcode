import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
import process from 'node:process'
import * as schema from './schema.js'

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : { rejectUnauthorized: false },
  max: 10,
})

export const db = drizzle(pool, { schema })
export { pool }