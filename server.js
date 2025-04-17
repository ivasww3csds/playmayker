const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./shortener.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Створити таблицю, якщо не існує
db.run(`CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  url TEXT,
  clicks INTEGER DEFAULT 0
)`);

// Віддати index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Створити коротке посилання
app.post('/shorten', (req, res) => {
  const { url, custom } = req.body;
  const code = custom || crypto.randomBytes(3).toString('hex');

  db.get('SELECT code FROM links WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).send('Помилка сервера');
    if (row) return res.status(400).send('Цей код уже зайнятий');

    db.run('INSERT INTO links (code, url) VALUES (?, ?)', [code, url], (err) => {
      if (err) return res.status(500).send('Помилка запису в базу');
      const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;
      res.send(shortUrl);
    });
  });
});

// Перенаправлення
app.get('/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT url FROM links WHERE code = ?', [code], (err, row) => {
    if (err || !row) return res.status(404).send('Посилання не знайдено');
    db.run('UPDATE links SET clicks = clicks + 1 WHERE code = ?', [code]);
    res.redirect(row.url);
  });
});

// Статистика
app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.get('SELECT code, url, clicks FROM links WHERE code = ?', [code], (err, row) => {
    if (err || !row) return res.status(404).send('Посилання не знайдено');
    res.json(row);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер працює на порті ${PORT}`);
});
