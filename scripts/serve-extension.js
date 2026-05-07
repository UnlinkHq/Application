const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Extension Dev Server
 * 
 * Usage: node serve-extension.js <extension-folder>
 * Example: node serve-extension.js greyscale-fader
 */

const EXTENSION_NAME = process.argv[2];
if (!EXTENSION_NAME) {
  console.error('❌  Please specify an extension folder name.');
  process.exit(1);
}

const PORT = 8081;
const EXTENSION_PATH = path.join(__dirname, '../extensions', EXTENSION_NAME);

if (!fs.existsSync(EXTENSION_PATH)) {
  console.error(`❌  Extension path not found: ${EXTENSION_PATH}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // Basic CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const filePath = path.join(EXTENSION_PATH, req.url === '/' ? 'extension.json' : req.url);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath);
    res.setHeader('Content-Type', filePath.endsWith('.json') ? 'application/json' : 'text/javascript');
    res.end(content);
  } else {
    res.statusCode = 404;
    res.end('Not Found');
    console.warn(`⚠️  404: ${req.url}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {

});
