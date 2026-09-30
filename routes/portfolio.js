import { Router } from 'express'
import { connectDB, runTransaction } from '../db/connection.js'

const router = Router()
const WALLET_ID = 'wallet'

function round2(n) {
  return Math.round(n * 100) / 100
}

// GET /api/wallet — current cash balance
router.get('/wallet', async (req, res) => {
  const db = await connectDB()
  const wallet = await db.collection('cash').findOne({ _id: WALLET_ID })
  res.json({ balance: wallet?.balance ?? 0 })
})

// GET /api/holdings — current stock positions
router.get('/holdings', async (req, res) => {
  const db = await connectDB()
  const holdings = await db.collection('holdings').find().sort({ symbol: 1 }).toArray()
  res.json(holdings)
})

// GET /api/transactions — full trade log, newest first
router.get('/transactions', async (req, res) => {
  const db = await connectDB()
  const transactions = await db.collection('transactions').find().sort({ timestamp: -1 }).limit(100).toArray()
  res.json(transactions)
})

// POST /api/buy  { symbol, quantity, price }
// Transaction: decrement cash, upsert the holding with a recalculated
// average price, insert a transaction log entry. All three or none.
router.post('/buy', async (req, res) => {
  const symbol = String(req.body.symbol || '').toUpperCase().trim()
  const quantity = Number(req.body.quantity)
  const price = Number(req.body.price)

  if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid symbol, quantity, or price' })
  }

  const cost = round2(quantity * price)
  const db = await connectDB()

  try {
    const result = await runTransaction(async (session) => {
      const cashCol = db.collection('cash')
      const holdingsCol = db.collection('holdings')
      const txCol = db.collection('transactions')

      const wallet = await cashCol.findOne({ _id: WALLET_ID }, { session })
      const balance = wallet?.balance ?? 0
      if (balance < cost) {
        throw new Error(`Insufficient cash: balance is ${balance}, trade costs ${cost}`)
      }

      await cashCol.updateOne(
        { _id: WALLET_ID },
        { $inc: { balance: -cost } },
        { session }
      )

      const existing = await holdingsCol.findOne({ symbol }, { session })
      if (existing) {
        const newQuantity = existing.quantity + quantity
        const newAvgPrice = round2((existing.avgPrice * existing.quantity + cost) / newQuantity)
        await holdingsCol.updateOne(
          { symbol },
          { $set: { quantity: newQuantity, avgPrice: newAvgPrice } },
          { session }
        )
      } else {
        await holdingsCol.insertOne({ symbol, quantity, avgPrice: price }, { session })
      }

      await txCol.insertOne(
        { type: 'buy', symbol, quantity, price, total: cost, timestamp: new Date() },
        { session }
      )

      const newBalance = await cashCol.findOne({ _id: WALLET_ID }, { session })
      return newBalance.balance
    })

    res.status(201).json({ ok: true, balance: result })
  } catch (err) {
    console.error('Buy transaction failed:', err.message)
    res.status(400).json({ ok: false, error: err.message })
  }
})

// POST /api/sell  { symbol, quantity, price }
// Transaction: decrement (or remove) the holding, increment cash, insert a
// transaction log entry. All or nothing.
router.post('/sell', async (req, res) => {
  const symbol = String(req.body.symbol || '').toUpperCase().trim()
  const quantity = Number(req.body.quantity)
  const price = Number(req.body.price)

  if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid symbol, quantity, or price' })
  }

  const proceeds = round2(quantity * price)
  const db = await connectDB()

  try {
    const result = await runTransaction(async (session) => {
      const cashCol = db.collection('cash')
      const holdingsCol = db.collection('holdings')
      const txCol = db.collection('transactions')

      const holding = await holdingsCol.findOne({ symbol }, { session })
      if (!holding || holding.quantity < quantity) {
        throw new Error(`Not enough shares of ${symbol} to sell`)
      }

      const remaining = holding.quantity - quantity
      if (remaining === 0) {
        await holdingsCol.deleteOne({ symbol }, { session })
      } else {
        await holdingsCol.updateOne({ symbol }, { $set: { quantity: remaining } }, { session })
      }

      await cashCol.updateOne(
        { _id: WALLET_ID },
        { $inc: { balance: proceeds } },
        { session }
      )

      await txCol.insertOne(
        { type: 'sell', symbol, quantity, price, total: proceeds, timestamp: new Date() },
        { session }
      )

      const newBalance = await cashCol.findOne({ _id: WALLET_ID }, { session })
      return newBalance.balance
    })

    res.status(201).json({ ok: true, balance: result })
  } catch (err) {
    console.error('Sell transaction failed:', err.message)
    res.status(400).json({ ok: false, error: err.message })
  }
})

// GET /api/summary — aggregation pipelines: most-traded symbol, trades per day
router.get('/summary', async (req, res) => {
  const db = await connectDB()
  const txCol = db.collection('transactions')

  const [mostTraded, tradesPerDay, totals] = await Promise.all([
    txCol.aggregate([
      { $group: { _id: '$symbol', totalQuantity: { $sum: '$quantity' }, tradeCount: { $sum: 1 } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, symbol: '$_id', totalQuantity: 1, tradeCount: 1 } },
    ]).toArray(),

    txCol.aggregate([
      { $group: { _id: { $dateTrunc: { date: '$timestamp', unit: 'day' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: '$_id', count: 1 } },
    ]).toArray(),

    txCol.aggregate([
      { $group: { _id: '$type', totalValue: { $sum: '$total' }, count: { $sum: 1 } } },
    ]).toArray(),
  ])

  res.json({ mostTraded, tradesPerDay, totals })
})

export default router
