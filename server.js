const express = require('express');
const path = require('path');
const geoip = require('geoip-lite');
const bodyParser = require('body-parser');
const app = express();
const db = new Map();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/shorten', (req, res) => {
  const { url, custom } = req.body;
  const code = custom || Math.random().toString(36).substring(2, 8);
  db.set(code, { url, clicks: 0, logs: [] });
  res.json({ short: `${code}` });
});

app.get('/:code', (req, res) => {
  const entry = db.get(req.params.code);
  if (!entry) return res.status(404).send('Not found');
  entry.clicks++;

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
  .split(',')[0].trim();
  const geo = geoip.lookup(ip) || {};
  entry.logs.push({
    ip,
    country: geo.country || 'N/A',
    city: geo.city || 'N/A',
    date: new Date()
  });

  res.redirect(entry.url);
});

// HTML page
app.get('/:code/stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// API endpoint
app.get('/api/:code/stats', (req, res) => {
  const code = req.params.code;
  const stats = db.get(code);
  if (!stats) return res.status(404).json({ error: 'Not found' });
  res.json({ details: stats.logs });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер працює на порті ${PORT}`);
});
