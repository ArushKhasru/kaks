import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  pathExists,
  readTextFileWithLimits,
  detectLanguage,
  tailLines,
  parsePositiveInteger
} from '../../src/commands/shared.js';

test('pathExists detects existing and non-existing files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perky-shared-test-'));
  const tempFile = path.join(tempDir, 'test.txt');

  try {
    assert.equal(await pathExists(tempFile), false);
    await fs.writeFile(tempFile, 'hello');
    assert.equal(await pathExists(tempFile), true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('readTextFileWithLimits behaves correctly for typical files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perky-shared-test-'));
  const tempFile = path.join(tempDir, 'test.txt');

  try {
    // Normal file within limits
    await fs.writeFile(tempFile, 'Hello world');
    const result = await readTextFileWithLimits(tempFile, { warnSize: 50, maxSize: 100 });
    assert.equal(result.content, 'Hello world');
    assert.equal(result.warned, false);
    assert.equal(result.truncated, false);

    // File exceeding warnSize
    const largeContent = 'a'.repeat(60);
    await fs.writeFile(tempFile, largeContent);
    const resultWarn = await readTextFileWithLimits(tempFile, { warnSize: 50, maxSize: 100 });
    assert.equal(resultWarn.warned, true);
    assert.equal(resultWarn.truncated, false);

    // File exceeding maxSize
    const hugeContent = 'a'.repeat(120);
    await fs.writeFile(tempFile, hugeContent);
    const resultTrunc = await readTextFileWithLimits(tempFile, { warnSize: 50, maxSize: 100 });
    assert.equal(resultTrunc.content.length, 100);
    assert.equal(resultTrunc.warned, true);
    assert.equal(resultTrunc.truncated, true);

    // Binary file check (has NUL byte)
    const binaryBuffer = Buffer.from([72, 101, 108, 108, 111, 0, 119, 111, 114, 108, 100]); // "Hello\0world"
    await fs.writeFile(tempFile, binaryBuffer);
    await assert.rejects(() => readTextFileWithLimits(tempFile), /Binary file rejected/);

    // Missing file check throws and suggests close match if possible
    const missingFile = path.join(tempDir, 'test2.txt');
    await assert.rejects(() => readTextFileWithLimits(missingFile), /File not found:.*Did you mean "test.txt"\?/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('detectLanguage maps extensions correctly', () => {
  assert.equal(detectLanguage('Dockerfile'), 'dockerfile');
  assert.equal(detectLanguage('config.yml'), 'yaml');
  assert.equal(detectLanguage('config.yaml'), 'yaml');
  assert.equal(detectLanguage('main.js'), 'javascript');
  assert.equal(detectLanguage('helper.mjs'), 'javascript');
  assert.equal(detectLanguage('index.ts'), 'typescript');
  assert.equal(detectLanguage('App.tsx'), 'typescript');
  assert.equal(detectLanguage('data.json'), 'json');
  assert.equal(detectLanguage('README.md'), 'markdown');
  assert.equal(detectLanguage('script.py'), 'python');
  assert.equal(detectLanguage('app.log'), 'log');
  assert.equal(detectLanguage('unknown.foo'), 'foo');
  assert.equal(detectLanguage('no-ext'), 'text');
});

test('tailLines returns correct last N lines', () => {
  const text = 'line 1\nline 2\nline 3\r\nline 4';
  assert.equal(tailLines(text, 2), 'line 3\nline 4');
  assert.equal(tailLines(text, 10), 'line 1\nline 2\nline 3\nline 4');
});

test('parsePositiveInteger parses and throws properly', () => {
  assert.equal(parsePositiveInteger('5'), 5);
  assert.equal(parsePositiveInteger('42', 10), 42);

  assert.throws(() => parsePositiveInteger('-5'), /Expected a positive integer/);
  assert.throws(() => parsePositiveInteger('abc'), /Expected a positive integer/);
  assert.equal(parsePositiveInteger('3.14'), 3);
});
