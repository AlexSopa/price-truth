// Your own copy, kept current: run both builds now and then every 15 minutes, until you stop it (Ctrl+C).
// Serve the folder at the same time (python -m http.server 8765); open pages pick up each new file by themselves.
import { spawn } from "node:child_process";

const EVERY = 15 * 60 * 1000;
const run = (args) => new Promise((resolve) => {
  spawn(process.execPath, ["scripts/build.mjs", ...args], { stdio: "inherit" }).on("exit", resolve);
});

for (;;) {
  const started = Date.now();
  console.log(`\n${new Date().toLocaleTimeString()} · building the globe and the crypto layer cake`);
  await run([]);
  await run(["crypto"]);
  const wait = Math.max(0, EVERY - (Date.now() - started));
  console.log(`next build at ${new Date(Date.now() + wait).toLocaleTimeString()}`);
  await new Promise((r) => setTimeout(r, wait));
}
