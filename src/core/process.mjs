import { spawn } from "node:child_process";

export function run(cmd, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    let stdout = "", stderr = "";
    if (!options.inherit) {
      child.stdout?.on("data", d => stdout += d);
      child.stderr?.on("data", d => stderr += d);
    }
    child.on("error", err => resolve({ ok: false, code: null, stdout, stderr, error: err.message }));
    child.on("close", code => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}
