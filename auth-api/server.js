require('dotenv').config();
const express = require('express');
const auth = require('./auth');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function isValid(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!isValid(email) || !isValid(password)) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const { data, error } = await auth.signUp.email({
    email,
    password,
    name: isValid(name) ? name : email.split('@')[0],
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.status(201).json(data);
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!isValid(email) || !isValid(password)) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let sessionCookie = null;
  const { error } = await auth.signIn.email(
    { email, password },
    {
      onSuccess: (ctx) => {
        sessionCookie = ctx.response.headers.get('set-cookie');
      },
    }
  );
  if (error || !sessionCookie) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  // The cookie value itself is what we verify against later; extract just the
  // name=value pair (before the first semicolon) to send back as the access token.
  const cookiePair = sessionCookie.split(';')[0];

  // Exchange the cookie for the real JWT living inside session.token
  const { data: sessionData } = await auth.getSession({
    fetchOptions: { headers: { Cookie: cookiePair } },
  });

  res.status(200).json({
    access_token: sessionData?.session?.token || null,
    refresh_token: cookiePair,
    user: sessionData?.user,
  });
});

// GET /public/info
app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// GET /protected/profile — Stage 2: only checks a token was presented, doesn't verify it yet
app.get('/protected/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  res.status(200).json({ message: 'Token present, not yet verified' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Connected to Neon Auth');
});
