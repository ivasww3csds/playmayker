const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fetch = require('node-fetch');
const ExcelJS = require('exceljs');
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
db.run(\`CREATE TABLE IF NOT EXISTS clicks_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)\`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/shorten', (req, res) => {
  const longUrl = req.body.url;
  const customCode = req.body.custom || crypto.randomBytes(3).toString('hex');
  db.run('INSERT INTO urls (code, longUrl) VALUES (?, ?)', [customCode, longUrl], function(err) {
    if (err) return res.status(500).send('Код уже зайнятий або помилка сервера');
    res.send(\`\${req.protocol}://\${req.get('host')}/\${customCode}\`);
  });
});

app.get('/:code', async (req, res) => {
  const code = req.params.code;
  db.get('SELECT * FROM urls WHERE code = ?', [code], async (err, row) => {
    if (row) {
      db.run('UPDATE urls SET clicks = clicks + 1 WHERE code = ?', [code]);
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      let country = '', city = '';
      try {
        const geo = await fetch(\`http://ip-api.com/json/\${ip}?fields=country,city\`);
        const data = await geo.json();
        country = data.country || '';
        city = data.city || '';
      } catch (e) {}
      db.run('INSERT INTO clicks_log (code, ip, country, city, user_agent) VALUES (?, ?, ?, ?, ?)', [code, ip, country, city, userAgent]);
      res.redirect(row.longUrl);
    } else {
      res.status(404).send('Посилання не знайдено');
    }
  });
});

app.get('/:code/stats', (req, res) => {
  const code = req.params.code;
  db.all('SELECT * FROM clicks_log WHERE code = ?', [code], async (err, rows) => {
    if (!rows || rows.length === 0) return res.status(404).send('Немає статистики.');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Статистика');
    sheet.columns = [
      { header: 'IP', key: 'ip' },
      { header: 'Країна', key: 'country' },
      { header: 'Місто', key: 'city' },
      { header: 'User-Agent', key: 'user_agent' },
      { header: 'Дата', key: 'created_at' }
    ];
    rows.forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="\${code}-stats.xlsx"\`);
    await workbook.xlsx.write(res);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(\`Сервер працює на http://localhost:\${PORT}\`);
});
