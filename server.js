const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('shortener.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Создание таблиц
db.run(`CREATE TABLE IF NOT EXISTS urls (
  code TEXT PRIMARY KEY,
  url TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS clicks_log (
  code TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Сокращение ссылки
app.post('/shorten', (req, res) => {
  const url = req.body.url;
  let customCode = req.body.custom || Math.random().toString(36).substring(2, 8);

  db.run('INSERT OR REPLACE INTO urls (code, url) VALUES (?, ?)', [customCode, url], err => {
    if (err) return res.status(500).send('DB error');
    res.send(`${req.protocol}://${req.get('host')}/${customCode}`);
  });
});

// Переход по короткой ссылке и логирование
app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT url FROM urls WHERE code = ?', [code], (err, row) => {
    if (err || !row) return res.status(404).send('Not found');

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip) || {};

    db.run('INSERT INTO clicks_log (code, ip, country, city) VALUES (?, ?, ?, ?)', [
      code,
      ip,
      geo.country || '-',
      geo.city || '-'
    ]);

    res.redirect(row.url);
  });
});

// Просмотр статистики
app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.all('SELECT ip, country, city, timestamp FROM clicks_log WHERE code = ? ORDER BY timestamp DESC', [code], (err, rows) => {
    if (err) return res.status(500).send('DB error');

    let html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Статистика для ${code}</title>
          <style>
            body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
            table { border-collapse: collapse; width: 100%; background: #fff; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
            th { background: #eee; }
          </style>
        </head>
        <body>
          <h2>Статистика для /${code}</h2>
          <table>
            <tr><th>IP</th><th>Страна</th><th>Город</th><th>Время</th></tr>
            ${rows.map(r => `<tr><td>${r.ip}</td><td>${r.country}</td><td>${r.city}</td><td>${r.timestamp}</td></tr>`).join('')}
          </table>
        </body>
      </html>
    `;
    res.send(html);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
