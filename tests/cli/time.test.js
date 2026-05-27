import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(repoRoot, 'cli.js');

test('time prints local time', async () => {
  const result = await runCli(['time']);
  const output = stripAnsi(result.stdout);

  assert.equal(result.code, 0, result.stderr);
  assert.match(output, /Date:\s+\d{4}-\d{2}-\d{2}/);
  assert.match(output, /Time:\s+\d{2}:\d{2}:\d{2}/);
  assert.match(output, /GMT:\s+GMT[+-]\d{2}:\d{2}/);
});

async function runCli(args, env = {}) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      timeout: 5000,
    });

    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

function stripAnsi(text) {
  return String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '');
}
