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
        // Vercel handles body parsing automatically in Node.js runtime. 
        // We just need to stringify it back for the HF request.
        const body = JSON.stringify(req.body);

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
