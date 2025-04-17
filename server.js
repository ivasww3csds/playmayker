const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const XLSX = require('xlsx');

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
    res.send(`${req.protocol}://${req.get('host')}/${customCode}`);
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const geo = geoip.lookup(ip.split(',')[0].trim()) || {};
      db.run(
        `INSERT INTO clicks_log (code, ip, country, city) VALUES (?, ?, ?, ?)`,
        [code, ip, geo.country || '-', geo.city || '-']
      );
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Скорочене посилання не знайдено');
    }
  });
});

app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.all(`SELECT ip, country, city, timestamp FROM clicks_log WHERE code = ? ORDER BY timestamp DESC`, [code], (err, rows) => {
    if (err) return res.status(500).send('Помилка при завантаженні статистики');
    const html = `
      <html lang="uk">
        <head>
          <meta charset="UTF-8">
          <title>Статистика</title>
          <style>
            body {
              font-family: 'Segoe UI', sans-serif;
              background: #f4f4f4;
              padding: 20px;
            }
            h2 {
              display: flex;
              align-items: center;
              font-size: 24px;
              margin-bottom: 10px;
            }
            h2 img {
              width: 24px;
              margin-right: 10px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              background: #fff;
              border-radius: 5px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
            }
            th {
              background-color: #f7f7f7;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <h2><img src="https://img.icons8.com/color/48/statistics.png"/>Статистика для <code>${code}</code></h2>
          <table>
            <tr><th>IP</th><th>Країна</th><th>Місто</th><th>Час</th></tr>
            ${rows.map(r => `<tr><td>${r.ip}</td><td>${r.country}</td><td>${r.city}</td><td>${new Date(r.timestamp).toLocaleString()}</td></tr>`).join('')}
          </table>
        </body>
      </html>`;
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`Сайт працює на http://localhost:${PORT}`);
});
