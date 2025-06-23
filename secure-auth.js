import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 3000;
const base = ''; // No base path needed if deployed at root

// Replace with your actual credentials
const CLIENT_ID = 'aWhxbmxMTDFQRXlaTG1GeDQ5NFU6MTpjaQ';
const REDIRECT_URI = 'https://twitter-auth-server.onrender.com/callback'; // 👈 Replace this after deploying
const SCOPES = 'tweet.read tweet.write users.read offline.access';

const sessionStore = {};

// --- Helpers for PKCE ---
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// --- Health check route ---
app.get(`${base}/`, (req, res) => {
  res.send('✅ Twitter Auth Server is Live!');
});

// --- Start OAuth flow ---
app.get(`${base}/start`, (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(8).toString('hex');

  sessionStore[state] = codeVerifier;

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log(`[start] Redirecting to: ${authUrl.toString()}`);
  res.redirect(authUrl.toString());
});

// --- Handle callback from Twitter ---
app.get(`${base}/callback`, async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) return res.send(`❌ Twitter Error: ${error} - ${error_description}`);
  if (!code || !state || !sessionStore[state]) {
    return res.send('❌ Missing or invalid code/state. Try /start again.');
  }

  const codeVerifier = sessionStore[state];
  delete sessionStore[state];

  try {
    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    if (tokenData.access_token) {
      const bearerToken = `Bearer ${tokenData.access_token}`;
      return res.send(`
        <h1>✅ Success!</h1>
        <p>YOUR AUTHORIZATION TOKEN:</p>
        <h1><code>${bearerToken}</code></h1>

        <p><strong>REFRESH TOKEN:</strong></p>
        <code>${tokenData.refresh_token || 'No refresh token received'}</code>
        <p>Store it securely. This gives access to your Twitter account.</p>
        `);
    } else {
      return res.send(`<h2>❌ Failed to get access_token</h2><pre>${JSON.stringify(tokenData)}</pre>`);
    }
  } catch (err) {
    return res.send(`❌ Token Exchange Error: ${err.message}`);
  }
});

// --- Token exchange ---
async function exchangeCodeForToken(code, codeVerifier) {
  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errBody}`);
  }

  return resp.json();
}

// --- Launch server ---
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
