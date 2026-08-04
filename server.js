const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello, this is the Task API' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});