const https = require('https');
const API_KEY = 'AIzaSyAuqlhaJfTOEY-cnEJ5QLuaS0aon3QaL_E';
const MODEL = 'gemini-3.5-flash';

const data = JSON.stringify({
  contents: [{ parts: [{ text: 'Say "API key works" in one sentence.' }] }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 10000
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Body:', body.substring(0, 500)));
});

req.on('error', (e) => console.error('Request error:', e.message));
req.on('timeout', () => console.error('Timeout'));
req.write(data);
req.end();
