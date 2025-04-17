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

app.post('/shorten', (req, res) => {
  const longUrl = req.body.url;
  const customCode = req.body.custom || crypto.randomBytes(3).toString('hex');
  db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [customCode, longUrl], function (err) {
    if (err) return res.status(500).send('Помилка при створенні');
    const shortUrl = `${req.protocol}://${req.get('host')}/${customCode}`;
    db.all(`SELECT ip, country, city, timestamp FROM clicks_log WHERE code = ? ORDER BY timestamp DESC`, [customCode], (err, rows) => {
      res.send(`
        <html lang="uk">
          <head>
            <meta charset="UTF-8">
            <title>Скорочене посилання</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; background: #111; color: #fff; display: flex; justify-content: center; align-items: flex-start; padding-top: 50px; height: 100vh; flex-direction: column; align-items: center; }
              .box { background: #222; padding: 40px; border-radius: 12px; box-shadow: 0 0 20px rgba(0,0,0,0.4); text-align: center; max-width: 600px; width: 100%; }
              .box h2 { margin-bottom: 20px; }
              .box input { width: 100%; padding: 10px; border-radius: 5px; border: none; text-align: center; margin-bottom: 10px; }
              .button { background: #FFD057; color: #000; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: block; width: fit-content; margin: 10px auto; }
              table { margin-top: 20px; background: #fff; color: #000; border-collapse: collapse; width: 100%; max-width: 800px; border-radius: 5px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
              th { background-color: #f7f7f7; font-weight: bold; }
              tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>Ваше скорочене посилання</h2>
              <input type="text" value="${shortUrl}" readonly onclick="this.select(); document.execCommand('copy');" />
              <h3>Статистика переходів</h3>
              <table>
                <tr><th>IP</th><th>Країна</th><th>Місто</th><th>Час</th></tr>
                ${rows.map(r => `<tr><td>${r.ip}</td><td>${r.country}</td><td>${r.city}</td><td>${new Date(r.timestamp).toLocaleString()}</td></tr>`).join('')}
              </table>
              <a href="/" class="button">⬅ Повернутись назад</a>
            </div>
          </body>
        </html>
      `);
    });
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
