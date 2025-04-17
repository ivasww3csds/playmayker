const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const dbPath = path.join(__dirname, 'shortener.json');
const statPath = path.join(__dirname, 'stats.json');

function load(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.post('/shorten', (req, res) => {
  const { url, custom } = req.body;
  const db = load(dbPath);
  const code = custom || Math.random().toString(36).substring(2, 7);
  if (db[code]) return res.status(409).send('Цей код уже використовується');
  db[code] = { url, clicks: 0 };
  save(dbPath, db);
  res.send({ short: `${req.headers.origin}/${code}` });
});

app.get('/:code', (req, res) => {
  const db = load(dbPath);
  const stats = load(statPath);
  const entry = db[req.params.code];
  if (!entry) return res.status(404).send('Не знайдено');

  entry.clicks += 1;
  db[req.params.code] = entry;
  save(dbPath, db);

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const geo = geoip.lookup(ip) || {};
  stats[req.params.code] = stats[req.params.code] || [];
  stats[req.params.code].push({
    ip,
    country: geo.country || 'Невідомо',
    city: geo.city || 'Невідомо',
    date: new Date().toISOString()
  });
  save(statPath, stats);

  res.redirect(entry.url);
});

app.get('/:code/stats', (req, res) => {
  const stats = load(statPath);
  res.send({ details: stats[req.params.code] || [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер працює на порті ${PORT}`);
});
