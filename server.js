import express from 'express'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDB } from './db/connection.js'
import portfolioRouter from './routes/portfolio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())
app.use('/api', portfolioRouter)

// Frontend is plain static HTML/CSS/JS served from the same server —
// no separate dev server, no proxy, one process to run.
app.use(express.static(path.join(__dirname, 'public')))

const PORT = process.env.PORT || 5050

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Portfolio Manager running at http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })
