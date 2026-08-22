require('dotenv').config();
const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const auth = require('./auth');

const app = express();
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

const PORT = process.env.PORT || 3000;

const JWKS = createRemoteJWKSet(new URL(process.env.JWKS_URL));

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

// Reusable auth guard — verifies the bearer token and attaches the user to req.user
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = {
      id: payload.sub,
      email: payload.email,
      createdAt: payload.createdAt,
    };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /protected/profile — Stage 4: uses the shared middleware
app.get('/protected/profile', requireAuth, (req, res) => {
  res.status(200).json(req.user);
});

// GET /protected/dashboard — proves the middleware is reusable, no new auth code
app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.status(200).json({ message: `Welcome to your dashboard, ${req.user.email}` });
});

// POST /auth/logout — protected route, ends the session
app.post('/auth/logout', requireAuth, async (req, res) => {
  await auth.signOut({
    fetchOptions: { headers: { Authorization: `Bearer ${req.token}` } },
  });
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Connected to Neon Auth');
});
