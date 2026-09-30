// Run with `npm run benchmark`. Demonstrates the effect of the index on
// transactions.symbol by inserting a large batch of dummy trades, querying
// with the index, dropping it, querying again, then restoring it.
import { connectDB, getClient } from './db/connection.js'

const DUMMY_COUNT = 20000
const SYMBOLS = ['TCS', 'INFY', 'RELI', 'HDFC', 'WIPRO']

async function benchmark() {
  const db = await connectDB()
  const tx = db.collection('transactions')

  console.log(`Inserting ${DUMMY_COUNT} dummy transactions for the benchmark...`)
  const docs = Array.from({ length: DUMMY_COUNT }, (_, i) => ({
    type: i % 2 === 0 ? 'buy' : 'sell',
    symbol: SYMBOLS[i % SYMBOLS.length],
    quantity: 10,
    price: 100,
    total: 1000,
    timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365),
    isBenchmarkData: true,
  }))
  await tx.insertMany(docs)

  async function timedQuery(label) {
    const start = process.hrtime.bigint()
    const explanation = await tx.find({ symbol: 'TCS' }).explain('executionStats')
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    const stats = explanation.executionStats

    console.log(`\n--- ${label} ---`)
    console.log(`Wall time: ${ms.toFixed(2)}ms`)
    console.log(`Documents examined: ${stats.totalDocsExamined}`)
    console.log(`Documents returned: ${stats.nReturned}`)
    console.log(`Execution stage: ${explanation.queryPlanner.winningPlan.stage}`)
  }

  console.log('\nRunning query WITH the symbol index in place...')
  await timedQuery('WITH index')

  console.log('\nDropping the symbol index...')
  await tx.dropIndex('symbol_1')
  await timedQuery('WITHOUT index')

  console.log('\nRecreating the index and cleaning up dummy data...')
  await tx.createIndex({ symbol: 1 })
  await tx.deleteMany({ isBenchmarkData: true })

  console.log('\nDone. Compare "Documents examined" and "Execution stage" (IXSCAN vs COLLSCAN).')
  await getClient().close()
}

benchmark().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
