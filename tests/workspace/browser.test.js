import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUrl, assertValidUrl, getOpenCommand } from '../../src/workspace/browser.js';

test('normalizeUrl works correctly', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com');
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com');
  assert.equal(normalizeUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeUrl('127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.equal(normalizeUrl('192.168.1.1'), 'http://192.168.1.1');
  assert.equal(normalizeUrl('10.0.0.1'), 'http://10.0.0.1');
  assert.equal(normalizeUrl('172.16.0.1'), 'http://172.16.0.1');

  assert.throws(() => normalizeUrl(''), /Missing URL/);
});

test('assertValidUrl validates correctly', () => {
  assert.doesNotThrow(() => assertValidUrl('http://example.com'));
  assert.doesNotThrow(() => assertValidUrl('https://localhost:3000'));
  assert.doesNotThrow(() => assertValidUrl('https://127.0.0.1'));

  assert.throws(() => assertValidUrl('ftp://example.com'), /Doesn't look like a valid URL/);
  assert.throws(() => assertValidUrl('http://invalidhostname'), /Doesn't look like a valid URL/);
});

test('getOpenCommand returns platform-appropriate commands', () => {
  const originalPlatform = process.platform;

  try {
    // Win32
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    assert.deepEqual(getOpenCommand('http://google.com', 'default'), {
      command: 'cmd',
      args: ['/c', 'start', '', 'http://google.com']
    });
    assert.deepEqual(getOpenCommand('http://google.com', 'chrome'), {
      command: 'cmd',
      args: ['/c', 'start', '', 'chrome', 'http://google.com']
    });

    // Darwin
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    assert.deepEqual(getOpenCommand('http://google.com', 'default'), {
      command: 'open',
      args: ['http://google.com']
    });
    assert.deepEqual(getOpenCommand('http://google.com', 'firefox'), {
      command: 'open',
      args: ['-a', 'Firefox', 'http://google.com']
    });

    // Linux
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    assert.deepEqual(getOpenCommand('http://google.com', 'default'), {
      command: 'xdg-open',
      args: ['http://google.com']
    });
    assert.deepEqual(getOpenCommand('http://google.com', 'edge'), {
      command: 'microsoft-edge',
      args: ['http://google.com']
    });
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});
