const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.API_KEY;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

const PORT = 3001;

const server = http.createServer((req, res) => {
    // 1. Static File Serving
    if (req.method === 'GET') {
        let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
        const extname = path.extname(filePath);
        let contentType = 'text/html';

        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
            case '.png': contentType = 'image/png'; break;
            case '.jpg': contentType = 'image/jpg'; break;
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(500);
                    res.end(`Server error: ${error.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }

    // 2. API Proxy (OpenAI Compatible Router)
    else if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            };

            const proxyReq = https.request(HF_URL, options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
