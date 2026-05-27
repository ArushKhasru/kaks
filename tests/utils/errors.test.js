import assert from 'node:assert/strict';
import test from 'node:test';
import { CliError, ErrorCategory, classifyError, formatErrorMessage } from '../../src/utils/errors.js';

test('CliError stores custom property values', () => {
  const err = new CliError('Oops', { exitCode: 42, cause: new Error('original') });
  assert.equal(err.message, 'Oops');
  assert.equal(err.exitCode, 42);
  assert.equal(err.cause.message, 'original');
  assert.equal(err.name, 'CliError');
});

test('CliError defaults exitCode to 1', () => {
  const err = new CliError('Oops');
  assert.equal(err.exitCode, 1);
  assert.equal(err.cause, undefined);
});

test('classifyError detects proper categories based on message and codes', () => {
  // CONFIG_MISSING
  assert.equal(classifyError(new Error('api key missing')), ErrorCategory.CONFIG_MISSING);
  assert.equal(classifyError(new Error('run "perky init" to setup')), ErrorCategory.CONFIG_MISSING);

  // RATE_LIMIT
  const limitErr = new Error('Too many requests');
  limitErr.response = { status: 429 };
  assert.equal(classifyError(limitErr), ErrorCategory.RATE_LIMIT);
  assert.equal(classifyError(new Error('rate limit reached')), ErrorCategory.RATE_LIMIT);

  // NETWORK_ERROR
  const netErr = new Error('Connection timed out');
  netErr.code = 'ECONNABORTED';
  assert.equal(classifyError(netErr), ErrorCategory.NETWORK_ERROR);

  // FILE_ERROR
  const fileErr = new Error('File not found');
  fileErr.code = 'ENOENT';
  assert.equal(classifyError(fileErr), ErrorCategory.FILE_ERROR);

  // INVALID_URL
  assert.equal(classifyError(new Error('missing url')), ErrorCategory.INVALID_URL);

  // TOOL_MISSING
  assert.equal(classifyError(new Error('editor not found: code')), ErrorCategory.TOOL_MISSING);

  // UNKNOWN
  assert.equal(classifyError(new Error('random error')), ErrorCategory.UNKNOWN);
});

test('formatErrorMessage adds correct emoji prefix', () => {
  const cliErr = new CliError('Config is missing API key');
  const formatted = formatErrorMessage(cliErr);
  assert.ok(formatted.startsWith('🔑'));
  assert.ok(formatted.includes('Config is missing API key'));

  const unknownErr = new Error('something bad');
  const formattedUnknown = formatErrorMessage(unknownErr);
  assert.ok(formattedUnknown.startsWith('❌'));
  assert.ok(formattedUnknown.includes('Something went wrong'));
});
