const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');

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

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/shorten', (req, res) => {
  console.log('POST /shorten запит отримано');

  const longUrl = req.body.url;
  const customCode = req.body.custom || '';
  const code = customCode !== '' ? customCode : crypto.randomBytes(3).toString('hex');

  if (!longUrl || !longUrl.startsWith('http')) {
    console.log('❌ Неправильне посилання:', longUrl);
    return res.status(400).send('Невалідне посилання');
  }

  console.log('✅ Посилання:', longUrl);
  console.log('🆔 Код:', code);

  db.get(`SELECT * FROM urls WHERE code = ?`, [code], (err, row) => {
    if (row) {
      console.log('⚠️ Код вже зайнятий:', code);
      return res.status(400).send('Цей код вже зайнятий. Спробуйте інший.');
    }

    db.run(`INSERT INTO urls (code, longUrl) VALUES (?, ?)`, [code, longUrl], function (err) {
      if (err) {
        console.log('💥 DB Insert Error:', err.message);
        return res.status(500).send('Помилка при збереженні в базу');
      }

      const fullUrl = `${req.protocol}://${req.get('host')}/${code}`;
      console.log('✅ Коротке посилання створено:', fullUrl);
      res.send(fullUrl);
    });
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
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});