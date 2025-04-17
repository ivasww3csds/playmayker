const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
  const customCode = req.body.custom;
  const code = customCode || crypto.randomBytes(3).toString('hex');

  db.run(
    `INSERT INTO urls (code, longUrl) VALUES (?, ?)`,
    [code, longUrl],
    function (err) {
      if (err) {
        return res.status(500).send('Помилка при створенні або код вже існує');
      }
      res.send(`${req.protocol}://${req.get('host')}/${code}`);
    }
  );
});

app.get('/export', (req, res) => {
  db.all(`SELECT * FROM clicks_log`, (err, rows) => {
    if (err) return res.status(500).send('Помилка при зчитуванні логів');

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Кліки');

    const filePath = path.join(__dirname, 'clicks.xlsx');
    XLSX.writeFile(workbook, filePath);

    res.download(filePath, 'clicks.xlsx');
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip) || {};
  const country = geo.country || 'Unknown';
  const city = geo.city || 'Unknown';

  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);
      db.run(
        `INSERT INTO clicks_log (code, ip, country, city) VALUES (?, ?, ?, ?)`,
        [code, ip, country, city]
      );
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Скорочене посилання не знайдено');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
