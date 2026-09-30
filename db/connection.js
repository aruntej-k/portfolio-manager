import { MongoClient } from 'mongodb'
import 'dotenv/config'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'portfolio_manager'

if (!uri) {
  throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.')
}

const client = new MongoClient(uri)
let db = null

export async function connectDB() {
  if (db) return db
  await client.connect()
  db = client.db(dbName)
  console.log(`Connected to MongoDB database: ${dbName}`)
  return db
}

// Every trade (buy or sell) touches two collections at once — cash and
// holdings — plus writes a log entry. This helper wraps that in a single
// transaction so a trade either fully happens or doesn't happen at all.
export async function runTransaction(work) {
  const session = client.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

export function getClient() {
  return client
}
