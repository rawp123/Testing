const express = require('express');
const path = require('path');

const server = express();
const rootDir = __dirname;
const port = Number(process.env.PORT) || 3000;

const staticMounts = [
  { route: '/', directory: 'src' },
  { route: '/data', directory: 'data' },
  { route: '/', directory: '.' }
];

staticMounts.forEach(({ route, directory }) => {
  server.use(route, express.static(path.join(rootDir, directory)));
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
