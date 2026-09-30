# Portfolio Manager

A standalone stock portfolio tracker built to demonstrate MongoDB
**transactions**, **aggregation pipelines**, and **indexing** for a DBMS mini
project. One server, one process — no separate frontend dev server, no proxy.

## Collections

- `cash` — a single document holding your cash balance
- `holdings` — one document per stock symbol you currently hold (quantity, average price)
- `transactions` — append-only log of every buy/sell

## Setup

1. `npm install`
2. `cp .env.example .env` and paste in your MongoDB Atlas connection string
   (same kind of setup as before — free tier, already a replica set, which
   transactions require).
3. `npm run seed` — creates your starting ₹100,000 cash balance and the indexes.
4. `npm start`
5. Open **http://localhost:5050** in your browser. That's it — one URL, one
   running process.

## Why this is simpler to run than the portfolio-site version

Everything — the API and the webpage — is served by the same Express process
on the same port. There's no Vite dev server, no proxy config, no two
terminals to keep alive in sync. If it connects to MongoDB, it works.

## The transaction (core demo)

Buying or selling a stock touches **two collections plus a log entry** in one
atomic unit, in `routes/portfolio.js`:
- Buy: decrement `cash`, upsert `holdings` with a recalculated average price, insert into `transactions`
- Sell: decrement/remove from `holdings`, increment `cash`, insert into `transactions`

To demonstrate the rollback for your viva: in `routes/portfolio.js`, inside
the `buy` route, comment out the `txCol.insertOne(...)` line and add
`throw new Error('forced failure')` right after the holdings update. Buy
something — it'll fail, and your cash balance and holdings will be
**unchanged**, because the whole transaction rolled back. Undo the change
afterward.

## Aggregation pipelines

`GET /api/summary` runs three pipelines, shown at the bottom of the page:
- Most-traded symbols (`$group` + `$sort`)
- Trades per day (`$group` with `$dateTrunc`)
- Buy vs. sell totals (`$group` by type)

## Indexing

`npm run benchmark` inserts 20,000 dummy transactions, queries by symbol with
the index in place, drops the index, queries again, and prints
`totalDocsExamined` and the execution stage (`IXSCAN` vs `COLLSCAN`) for both —
that comparison is your evidence that the index matters.
