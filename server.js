const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./database.db');
db.run(`CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  longUrl TEXT,
  clicks INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.run(`CREATE TABLE IF NOT EXISTS clicks_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <html lang="uk">
    <head>
      <meta charset="UTF-8">
      <title>Скоротіть посилання</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #111; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .box { background: #222; padding: 40px; border-radius: 12px; box-shadow: 0 0 20px rgba(0,0,0,0.4); text-align: center; width: 600px; }
        input, button { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: none; }
        button { background: #FFD057; color: #000; font-weight: bold; cursor: pointer; }
        #shortUrlContainer, #statsTable { display: none; margin-top: 20px; }
        table { width: 100%; margin-top: 10px; background: #fff; color: #000; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 10px; }
        th { background: #f2f2f2; }
        #shortUrl { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: none; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Скоротіть посилання</h2>
        <form id="shortenForm">
          <input type="url" name="url" placeholder="https://example.com" required>
          <input type="text" name="custom" placeholder="Бажаний код (необов’язково)">
          <button type="submit">Скоротити</button>
        </form>
        <div id="shortUrlContainer">
          <input id="shortUrl" readonly onclick="this.select(); document.execCommand('copy');">
          <button id="showStatsBtn">Переглянути статистику</button>
        </div>
        <div id="statsTable"></div>
      </div>
      <script>
        let currentCode = '';

        document.getElementById('shortenForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const formData = new URLSearchParams(new FormData(this));
          const response = await fetch('/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
          });
          const html = await response.text();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const input = tempDiv.querySelector('input');
          const shortLink = input?.value || '';
          currentCode = shortLink.split('/').pop();
          document.getElementById('shortUrl').value = shortLink;
          document.getElementById('shortUrlContainer').style.display = 'block';
          document.getElementById('statsTable').style.display = 'none';
        });

        document.getElementById('showStatsBtn').onclick = async function() {
          const response = await fetch('/stats/' + currentCode);
          const html = await response.text();
          document.getElementById('statsTable').innerHTML = html;
          document.getElementById('statsTable').style.display = 'block';
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/shorten', (req, res) => {
  const longUrl = req.body.url;
  const customCode = req.body.custom || crypto.randomBytes(3).toString('hex');
  db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [customCode, longUrl], function (err) {
    if (err) return res.status(500).send('Помилка при створенні');
    const shortUrl = `${req.protocol}://${req.get('host')}/${customCode}`;
    res.send(`<input type="text" value="${shortUrl}" readonly onclick="this.select(); document.execCommand('copy');" />`);
  });
});

app.get('/stats/:code', (req, res) => {
  const code = req.params.code;
  db.all(`SELECT ip, country, city, timestamp FROM clicks_log WHERE code = ? ORDER BY timestamp DESC`, [code], (err, rows) => {
    const rowsHtml = rows.map(r => `<tr><td>${r.ip}</td><td>${r.country}</td><td>${r.city}</td><td>${new Date(r.timestamp).toLocaleString()}</td></tr>`).join('');
    res.send(`
      <table>
        <tr><th>IP</th><th>Країна</th><th>Місто</th><th>Час</th></tr>
        ${rowsHtml}
      </table>
    `);
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const geo = geoip.lookup(ip.split(',')[0].trim()) || {};
      db.run(`INSERT INTO clicks_log (code, ip, country, city) VALUES (?, ?, ?, ?)`, [code, ip, geo.country || '-', geo.city || '-']);
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Скорочене посилання не знайдено');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Сайт працює на http://localhost:${PORT}`);
});
