import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchLatestPackageVersion,
  getLatestVersionCommand,
  getPowerCommand,
  getUpdateCommand,
  isNewerVersion,
  updatePerky,
} from '../../src/workspace/system.js';

test('getPowerCommand builds Windows shutdown and restart commands', () => {
  assert.deepEqual(getPowerCommand('shutdown', { delay: 30, force: true }, 'win32'), {
    command: 'shutdown',
    args: ['/s', '/t', '30', '/f'],
    label: 'shutdown',
  });

  assert.deepEqual(getPowerCommand('reboot', {}, 'win32'), {
    command: 'shutdown',
    args: ['/r', '/t', '0'],
    label: 'restart',
  });
});

test('getUpdateCommand updates the published perky package', () => {
  assert.deepEqual(getUpdateCommand({}, 'linux'), {
    command: 'npm',
    args: ['install', '-g', 'perky@latest'],
    label: 'update',
  });

  assert.deepEqual(getUpdateCommand({}, 'win32'), {
    command: 'npm.cmd',
    args: ['install', '-g', 'perky@latest'],
    label: 'update',
  });
});

test('getLatestVersionCommand checks the published perky version', () => {
  assert.deepEqual(getLatestVersionCommand({}, 'linux'), {
    command: 'npm',
    args: ['view', 'perky@latest', 'version'],
    label: 'check latest version',
  });

  assert.deepEqual(getLatestVersionCommand({}, 'win32'), {
    command: 'npm.cmd',
    args: ['view', 'perky@latest', 'version'],
    label: 'check latest version',
  });
});

test('isNewerVersion compares semantic versions', () => {
  assert.equal(isNewerVersion('0.0.5', '0.0.5'), true);
  assert.equal(isNewerVersion('0.0.10', '0.0.9'), true);
  assert.equal(isNewerVersion('0.0.5', '0.0.5'), false);
  assert.equal(isNewerVersion('0.0.3', '0.0.5'), false);
  assert.equal(isNewerVersion('1.0.0', '1.0.0-beta.1'), true);
});

test('fetchLatestPackageVersion reads npm view output', async () => {
  const calls = [];
  const latestVersion = await fetchLatestPackageVersion({
    platform: 'linux',
    exec: async (command, args, options) => {
      calls.push({ command, args, options });
      return { stdout: '0.0.5\n' };
    },
  });

  assert.equal(latestVersion, '0.0.5');
  assert.deepEqual(calls, [{
    command: 'npm',
    args: ['view', 'perky@latest', 'version'],
    options: { stdio: 'pipe' },
  }]);
});

test('updatePerky skips install when already using latest version', async () => {
  const calls = [];
  const result = await updatePerky({
    currentVersion: '0.0.5',
    latestVersion: '0.0.5',
    platform: 'linux',
    exec: async (command, args, options) => {
      calls.push({ command, args, options });
      return {};
    },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.currentVersion, '0.0.5');
  assert.equal(result.latestVersion, '0.0.5');
  assert.match(result.message, /already using the latest version/);
  assert.deepEqual(calls, []);
});

test('updatePerky installs latest package when a newer version is available', async () => {
  const calls = [];
  const result = await updatePerky({
    currentVersion: '0.0.5',
    latestVersion: '0.0.5',
    platform: 'linux',
    exec: async (command, args, options) => {
      calls.push({ command, args, options });
      return {};
    },
  });

  assert.equal(result.updated, true);
  assert.equal(result.currentVersion, '0.0.5');
  assert.equal(result.latestVersion, '0.0.5');
  assert.match(result.message, /updated from 0\.0\.4 to 0\.0\.5/);
  assert.deepEqual(calls, [{
    command: 'npm',
    args: ['install', '-g', 'perky@latest'],
    options: { stdio: 'inherit' },
  }]);
});
