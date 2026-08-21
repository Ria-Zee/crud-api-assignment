const { createAuthClient } = require('@neondatabase/auth');

if (!process.env.AUTH_URL) {
  throw new Error('Missing required env var: AUTH_URL. Check your .env file.');
}

const auth = createAuthClient(process.env.AUTH_URL);

module.exports = auth;
