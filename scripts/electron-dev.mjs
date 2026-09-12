import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';

// A dedicated ephemeral port avoids disturbing an existing browser dev server.
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false },
});
await server.listen();
const address = server.httpServer.address();
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  electron,
  ['.', `--dev-url=http://127.0.0.1:${address.port}`],
  { stdio: 'inherit', env },
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.once('exit', (code) => void stop(code ?? 0));
child.once('error', (error) => {
  console.error(error);
  void stop(1);
});
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
