const API_KEY = process.env.API_KEY;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'API_KEY missing on server' });
    }

    try {
        let bodyData = req.body;

        // Defensive check: if req.body is not parsed, parse it manually
        if (!bodyData || typeof bodyData !== 'object') {
            const rawBody = await new Promise((resolve, reject) => {
                let data = '';
                req.on('data', chunk => data += chunk);
                req.on('end', () => resolve(data));
                req.on('error', reject);
            });
            try {
                bodyData = JSON.parse(rawBody);
            } catch (e) {
                console.error("JSON Parse Error:", rawBody);
                return res.status(400).json({ error: "Invalid JSON body", raw: rawBody });
            }
        }

        const body = JSON.stringify(bodyData);

        const response = await fetch(HF_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: body
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Hugging Face Error:', data);
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
