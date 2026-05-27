import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAskPrompt, buildExplainPrompt, buildSummarizePrompt } from '../../src/ai/prompt.js';

// ---------------------------------------------------------------------------
// buildAskPrompt
// ---------------------------------------------------------------------------

test('buildAskPrompt returns systemPrompt containing "senior developer"', () => {
  const { systemPrompt } = buildAskPrompt('What is Node.js?');
  assert.match(systemPrompt, /senior developer/i);
});

test('buildAskPrompt returns userPrompt equal to the question', () => {
  const question = 'How do I read a file in Node.js?';
  const { userPrompt } = buildAskPrompt(question);
  assert.equal(userPrompt, question);
});

test('buildAskPrompt appends project context when provided', () => {
  const question = 'What framework is used?';
  const context = 'This project uses Express.js with TypeScript.';
  const { userPrompt } = buildAskPrompt(question, context);

  assert.ok(userPrompt.includes(question));
  assert.ok(userPrompt.includes(context));
  assert.match(userPrompt, /Project context:/);
});

test('buildAskPrompt omits context section when empty string', () => {
  const question = 'Explain closures';
  const { userPrompt } = buildAskPrompt(question, '');

  assert.equal(userPrompt, question);
  assert.doesNotMatch(userPrompt, /Project context:/);
});

// ---------------------------------------------------------------------------
// buildExplainPrompt
// ---------------------------------------------------------------------------

test('buildExplainPrompt includes file displayPath in userPrompt', () => {
  const file = { displayPath: 'src/utils/helpers.js', content: 'const x = 1;' };
  const { userPrompt } = buildExplainPrompt(file, { language: 'javascript' });

  assert.ok(userPrompt.includes('src/utils/helpers.js'));
});

test('buildExplainPrompt includes language in userPrompt', () => {
  const file = { displayPath: 'index.ts', content: 'const x: number = 1;' };
  const { userPrompt } = buildExplainPrompt(file, { language: 'typescript' });

  assert.ok(userPrompt.includes('typescript'));
});

test('buildExplainPrompt includes detail level in userPrompt', () => {
  const file = { displayPath: 'app.js', content: 'console.log("hi");' };
  const { userPrompt } = buildExplainPrompt(file, { language: 'javascript', detail: 'high' });

  assert.match(userPrompt, /Detail level: high/);
});

test('buildExplainPrompt includes section instruction when section provided', () => {
  const file = { displayPath: 'config.yaml', content: 'key: value' };
  const { userPrompt } = buildExplainPrompt(file, { language: 'yaml', section: 'database settings' });

  assert.match(userPrompt, /Focus only on this section or topic: database settings/);
});

test('buildExplainPrompt omits section line when no section', () => {
  const file = { displayPath: 'main.py', content: 'print("hi")' };
  const { userPrompt } = buildExplainPrompt(file, { language: 'python' });

  assert.doesNotMatch(userPrompt, /Focus only on this section/);
});

// ---------------------------------------------------------------------------
// buildSummarizePrompt
// ---------------------------------------------------------------------------

test('buildSummarizePrompt includes label in userPrompt', () => {
  const { userPrompt } = buildSummarizePrompt('some log output', {
    label: 'build.log',
    lines: 42,
    errors: 2,
    warnings: 5,
  });

  assert.ok(userPrompt.includes('build.log'));
});

test('buildSummarizePrompt includes error and warning counts', () => {
  const { userPrompt } = buildSummarizePrompt('error occurred', {
    label: 'app.log',
    lines: 100,
    errors: 3,
    warnings: 7,
  });

  assert.match(userPrompt, /Errors: 3/);
  assert.match(userPrompt, /Warnings: 7/);
});

test('buildSummarizePrompt includes log content in code block', () => {
  const logContent = 'ERROR: connection refused\nWARN: retrying';
  const { userPrompt } = buildSummarizePrompt(logContent, {
    label: 'server.log',
    lines: 2,
    errors: 1,
    warnings: 1,
  });

  assert.ok(userPrompt.includes('```log'));
  assert.ok(userPrompt.includes(logContent));
  assert.ok(userPrompt.includes('```'));
});

test('buildSummarizePrompt systemPrompt mentions "log analysis"', () => {
  const { systemPrompt } = buildSummarizePrompt('log data', {
    label: 'stdin',
    lines: 1,
    errors: 0,
    warnings: 0,
  });

  assert.match(systemPrompt, /log analysis/i);
});
