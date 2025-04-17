const express = require('express');
const path = require('path');
const app = express();
const geoip = require('geoip-lite');
const bodyParser = require('body-parser');
const db = new Map();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/shorten', (req, res) => {
  const { url, custom } = req.body;
  const code = custom || Math.random().toString(36).substring(2, 8);
  db.set(code, { url, clicks: 0, logs: [] });
  res.json({ shortUrl: `/${code}` });
});

app.get('/:code', (req, res) => {
  const entry = db.get(req.params.code);
  if (!entry) return res.status(404).send('Not found');
  entry.clicks++;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip) || {};
  entry.logs.push({ ip, country: geo.country || 'N/A', city: geo.city || 'N/A', date: new Date() });
  res.redirect(entry.url);
});

// ⬇️ Вставить сюда
app.get('/:code/stats', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(__dirname + '/public/stats.html');
  }

  const code = req.params.code;
  const stats = db.get(code);
  if (!stats) return res.status(404).json({ error: 'Not found' });
  res.json({ details: stats.logs });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер працює на порті ${PORT}`);
});
