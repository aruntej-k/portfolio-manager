async function loadWallet() {
  const res = await fetch('/api/wallet')
  const data = await res.json()
  document.getElementById('walletBalance').textContent = `₹${data.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

async function loadHoldings() {
  const res = await fetch('/api/holdings')
  const holdings = await res.json()
  const tbody = document.querySelector('#holdingsTable tbody')
  tbody.innerHTML = ''
  document.getElementById('holdingsEmpty').style.display = holdings.length ? 'none' : 'block'
  for (const h of holdings) {
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${h.symbol}</td><td>${h.quantity}</td><td>₹${h.avgPrice.toFixed(2)}</td><td>₹${(h.avgPrice * h.quantity).toFixed(2)}</td>`
    tbody.appendChild(tr)
  }
}

async function loadTransactions() {
  const res = await fetch('/api/transactions')
  const txs = await res.json()
  const tbody = document.querySelector('#txTable tbody')
  tbody.innerHTML = ''
  document.getElementById('txEmpty').style.display = txs.length ? 'none' : 'block'
  for (const t of txs) {
    const tr = document.createElement('tr')
    const when = new Date(t.timestamp).toLocaleString()
    tr.innerHTML = `<td class="type-${t.type}">${t.type.toUpperCase()}</td><td>${t.symbol}</td><td>${t.quantity}</td><td>₹${t.price.toFixed(2)}</td><td>₹${t.total.toFixed(2)}</td><td>${when}</td>`
    tbody.appendChild(tr)
  }
}

async function loadSummary() {
  const res = await fetch('/api/summary')
  const data = await res.json()

  const mostTraded = document.getElementById('mostTraded')
  mostTraded.innerHTML = data.mostTraded.length
    ? data.mostTraded.map(m => `<div class="stat-row"><span>${m.symbol}</span><span>${m.totalQuantity} shares / ${m.tradeCount} trades</span></div>`).join('')
    : '<p class="empty-msg">No trades yet.</p>'

  const tradesPerDay = document.getElementById('tradesPerDay')
  tradesPerDay.innerHTML = data.tradesPerDay.length
    ? data.tradesPerDay.map(d => `<div class="stat-row"><span>${new Date(d.day).toLocaleDateString()}</span><span>${d.count}</span></div>`).join('')
    : '<p class="empty-msg">No trades yet.</p>'

  const totals = document.getElementById('totals')
  totals.innerHTML = data.totals.length
    ? data.totals.map(t => `<div class="stat-row"><span>${t._id.toUpperCase()}</span><span>₹${t.totalValue.toFixed(2)} (${t.count})</span></div>`).join('')
    : '<p class="empty-msg">No trades yet.</p>'
}

async function refreshAll() {
  await Promise.all([loadWallet(), loadHoldings(), loadTransactions(), loadSummary()])
}

function showMessage(id, text, isError) {
  const el = document.getElementById(id)
  el.textContent = text
  el.className = `form-message ${isError ? 'error' : 'success'}`
  setTimeout(() => { el.textContent = ''; el.className = 'form-message' }, 4000)
}

document.getElementById('buyForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const fd = new FormData(e.target)
  try {
    const res = await fetch('/api/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: fd.get('symbol'), quantity: fd.get('quantity'), price: fd.get('price') }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Buy failed')
    showMessage('buyMessage', 'Bought successfully.', false)
    e.target.reset()
    refreshAll()
  } catch (err) {
    showMessage('buyMessage', err.message, true)
  }
})

document.getElementById('sellForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const fd = new FormData(e.target)
  try {
    const res = await fetch('/api/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: fd.get('symbol'), quantity: fd.get('quantity'), price: fd.get('price') }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Sell failed')
    showMessage('sellMessage', 'Sold successfully.', false)
    e.target.reset()
    refreshAll()
  } catch (err) {
    showMessage('sellMessage', err.message, true)
  }
})

refreshAll()
