import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Google OAuth2 Client setup
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`
);

app.use(express.json());

// API Routes
app.get('/api/auth/google-fit/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.body.read',
      'https://www.googleapis.com/auth/fitness.location.read'
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

app.get('/api/auth/spotify/url', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${process.env.APP_URL || 'http://localhost:3000'}/auth/spotify/callback`,
    scope: 'user-read-private user-read-email playlist-read-private',
    show_dialog: 'true'
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
});

app.get(['/auth/spotify/callback', '/auth/spotify/callback/'], async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.APP_URL || 'http://localhost:3000'}/auth/spotify/callback`
      })
    });

    const tokens = await response.json();

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Spotify Connected! This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for Spotify tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    // In a real app, you'd store these tokens in Firestore for the user
    // For this demo, we'll just send a success message back to the popup
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

// Vite Middleware
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
