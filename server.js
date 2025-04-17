const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// База данных
const db = new sqlite3.Database('./database.db');
db.run(`CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  longUrl TEXT,
  clicks INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 👉 Вот эта строка фиксит твою ошибку:
app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/shorten', (req, res) => {
  const longUrl = req.body.url;
  const code = crypto.randomBytes(3).toString('hex');
  db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [code, longUrl], function (err) {
    if (err) return res.status(500).send('Помилка при створенні');
    res.send(`${req.protocol}://${req.get('host')}/${code}`);
  });
});

app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      db.run(`UPDATE urls SET clicks = clicks + 1 WHERE code = ?`, [code]);
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Скорочене посилання не знайдено');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Сайт працює на http://localhost:${PORT}`);
});
