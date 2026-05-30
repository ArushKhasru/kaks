import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(repoRoot, 'cli.js');

test('system commands support dry-run without executing system actions', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perky-system-test-'));

  try {
    const shutdown = await runCli(['shutdown', '--dry-run', '--delay', '5'], { perky_CONFIG_DIR: configDir });
    assert.equal(shutdown.code, 0, shutdown.stderr);
    assert.match(shutdown.stdout, /Would run: shutdown/);

    const restart = await runCli(['restart', '--dry-run'], { perky_CONFIG_DIR: configDir });
    assert.equal(restart.code, 0, restart.stderr);
    assert.match(restart.stdout, /Would run: shutdown/);

    const update = await runCli(['update', '--dry-run'], { perky_CONFIG_DIR: configDir });
    assert.equal(update.code, 0, update.stderr);
    assert.match(update.stdout, /install -g perky@latest/);

    const help = await runCli(['--help'], { perky_CONFIG_DIR: configDir });
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout, /update \[options\]/);
    assert.doesNotMatch(help.stdout, /--update \[options\]/);
    assert.doesNotMatch(help.stdout, /\bclose\b/);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
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
