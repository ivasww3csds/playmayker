const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const geoip = require('geoip-lite');
const XLSX = require('xlsx');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./database.db');

// Создание таблиц
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
  userAgent TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/shorten', (req, res) => {
  const { url, custom } = req.body;
  const code = custom || Math.random().toString(16).substring(2, 8);

  db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [code, url], function (err) {
    if (err) return res.send('Код уже зайнято, спробуйте інший');
    res.send(`${req.protocol}://${req.get('host')}/${code}`);
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);

      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
      const geo = geoip.lookup(ip) || {};
      const ua = req.headers['user-agent'];

      db.run(`INSERT INTO clicks_log (code, ip, country, city, userAgent) VALUES (?, ?, ?, ?, ?)`,
        [code, ip, geo.country || '', geo.city || '', ua]);

      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Посилання не знайдено');
    }
  });
});

app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.all(`SELECT * FROM clicks_log WHERE code = ?`, [code], (err, rows) => {
    const data = rows.map(r => ({
      IP: r.ip,
      Country: r.country,
      City: r.city,
      UserAgent: r.userAgent,
      Date: r.createdAt
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stats");

    const filePath = `/tmp/${code}_stats.xlsx`;
    XLSX.writeFile(wb, filePath);

    res.download(filePath);
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
