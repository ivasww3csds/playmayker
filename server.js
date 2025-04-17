const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// init db
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
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
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/shorten', (req, res) => {
  const longUrl = req.body.url;
  const customCode = req.body.custom || crypto.randomBytes(3).toString('hex');
  db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [customCode, longUrl], function (err) {
    if (err) return res.status(400).send('Код вже використано.');
    res.send(`${req.protocol}://${req.get('host')}/${customCode}`);
  });
});

app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.all(`SELECT * FROM clicks_log WHERE code = ? ORDER BY timestamp DESC`, [code], (err, rows) => {
    if (err) return res.status(500).send('Помилка сервера');

    let html = `<h2>\u{1F4CA} Статистика для <code>${code}</code></h2><table border="1" cellpadding="6"><tr><th>IP</th><th>Країна</th><th>Місто</th><th>Час</th></tr>`;
    for (const row of rows) {
      html += `<tr><td>${row.ip}</td><td>${row.country || '-'}</td><td>${row.city || '-'}</td><td>${new Date(row.timestamp).toLocaleString()}</td></tr>`;
    }
    html += `</table><br><a href="/export">⬇️ Завантажити все у Excel</a>`;
    res.send(html);
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip) || {};

  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);
      db.run(`INSERT INTO clicks_log (code, ip, country, city) VALUES (?, ?, ?, ?)`, [code, ip, geo.country, geo.city]);
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Посилання не знайдено');
    }
  });
});

app.get('/export', (req, res) => {
  db.all(`SELECT * FROM clicks_log ORDER BY timestamp DESC`, (err, rows) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stats');
    const filePath = path.join(__dirname, 'clicks_stats.xlsx');
    XLSX.writeFile(workbook, filePath);
    res.download(filePath);
  });
});

app.listen(PORT, () => {
  console.log(`Сервер працює на http://localhost:${PORT}`);
});
