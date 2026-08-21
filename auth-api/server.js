require('dotenv').config();
const express = require('express');
const auth = require('./auth');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Connected to Neon Auth');
});
