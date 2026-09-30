// Run with `npm run seed` after setting MONGODB_URI in .env
import { connectDB, getClient } from './db/connection.js'

const STARTING_BALANCE = 100000

async function seed() {
  const db = await connectDB()

  await db.collection('cash').updateOne(
    { _id: 'wallet' },
    { $setOnInsert: { balance: STARTING_BALANCE } },
    { upsert: true }
  )

  await db.collection('holdings').createIndex({ symbol: 1 }, { unique: true })
  await db.collection('transactions').createIndex({ timestamp: -1 })
  await db.collection('transactions').createIndex({ symbol: 1 })

  console.log(`Wallet ready with starting balance ${STARTING_BALANCE}, indexes created.`)
  await getClient().close()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
