const API_KEY = process.env.API_KEY;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

module.exports = async (req, res) => {
    // CORS
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

    console.log("Incoming request body type:", typeof req.body);
    console.log("API_KEY present:", !!API_KEY);
    if (API_KEY) console.log("API_KEY starts with:", API_KEY.substring(0, 5) + "...");

    if (!API_KEY) {
        return res.status(500).json({ error: "API_KEY is missing on Vercel side." });
    }

    try {
        const response = await fetch(HF_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Hugging Face Error:", data);
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Serverless Function Error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error.message
        });
    }
};
