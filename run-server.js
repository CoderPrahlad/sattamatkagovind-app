const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = true; // Use dev mode for live updates
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port, dir: '/home/z/my-project' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
  
  // Keep alive
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[heartbeat] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
  }, 30000);
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});

// Handle signals
process.on('SIGTERM', () => { console.log('SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT'); process.exit(0); });
process.on('uncaughtException', (err) => { console.error('Uncaught:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });
process.on('exit', (code) => { console.log(`Exit with code ${code}`); });
