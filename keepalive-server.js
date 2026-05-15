const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'dev.log');

function startServer() {
  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  
  // Pipe stdout and stderr to log file
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  
  child.unref();
  console.log(`Server started with PID: ${child.pid}`);
  
  child.on('exit', (code, signal) => {
    const msg = `\nServer exited with code ${code}, signal ${signal} at ${new Date().toISOString()}. Restarting in 5s...\n`;
    logStream.write(msg);
    setTimeout(startServer, 5000);
  });
}

startServer();
