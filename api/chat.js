const https = require('https');

const API_KEY = process.env.API_KEY;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_HOST = "router.huggingface.co";
const HF_PATH = "/v1/chat/completions";

module.exports = (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

    if (!API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API_KEY missing on server' }));
        return;
    }

    // Read raw body from the request stream
    let rawBody = '';
    req.on('data', chunk => rawBody += chunk.toString());
    req.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read request: ' + err.message }));
    });
    req.on('end', () => {
        const options = {
            hostname: HF_HOST,
            path: HF_PATH,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(rawBody)
            }
        };

        const proxyReq = https.request(options, proxyRes => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        });

        proxyReq.on('error', err => {
            console.error('Proxy error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(rawBody);
        proxyReq.end();
    });
};
