const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// List available PDF source files
app.get('/api/pdfs', (_req, res) => {
  const pdfsDir = path.join(__dirname, 'data', 'pdfs');
  fs.readdir(pdfsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Could not read PDFs directory' });
    res.json(files.filter(f => f.endsWith('.pdf')).sort());
  });
});

// Serve static files from /src as root
app.use('/', express.static(path.join(__dirname, 'src')));
// Serve data files
app.use('/data', express.static(path.join(__dirname, 'data')));
// Serve root-level files (index.html, etc)
app.use('/', express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`);
});
