module.exports = (req, res) => {
    const API_KEY = process.env.API_KEY;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        apiKeyPresent: !!API_KEY,
        apiKeyPrefix: API_KEY ? API_KEY.substring(0, 8) : 'missing',
        method: req.method,
        nodeVersion: process.version
    }));
};
