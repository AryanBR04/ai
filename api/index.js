const https = require('https');

const API_KEY = process.env.API_KEY;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        console.error("CRITICAL: API_KEY is missing from Environment Variables");
        return res.status(500).json({ error: "API_KEY not configured in Vercel." });
    }

    return new Promise((resolve, reject) => {
        try {
            const body = JSON.stringify(req.body);

            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            };

            const proxyReq = https.request(HF_URL, options, (proxyRes) => {
                let resBody = '';
                proxyRes.on('data', chunk => resBody += chunk);
                proxyRes.on('end', () => {
                    try {
                        const parsed = JSON.parse(resBody || '{}');
                        res.status(proxyRes.statusCode).json(parsed);
                        resolve();
                    } catch (e) {
                        console.error("HF Response Parse Error:", resBody);
                        res.status(500).json({ error: "Invalid JSON from AI model", raw: resBody });
                        resolve();
                    }
                });
            });

            proxyReq.on('error', (e) => {
                console.error("Proxy Request Error:", e);
                res.status(500).json({ error: e.message });
                resolve();
            });

            proxyReq.write(body);
            proxyReq.end();
        } catch (error) {
            console.error("Serverless Function Internal Error:", error);
            res.status(500).json({ error: 'Internal Server Error' });
            resolve();
        }
    });
};
