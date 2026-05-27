import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { AI_PROVIDER_DEFAULTS, AiConfigError, hasAiCredentials, normalizeAiError, completeWithAi } from '../../src/ai/provider.js';
import { CliError } from '../../src/utils/errors.js';

test('AI_PROVIDER_DEFAULTS contains expected keys and shapes', () => {
  assert.ok(AI_PROVIDER_DEFAULTS.gemini);
  assert.ok(AI_PROVIDER_DEFAULTS.openai);
  assert.ok(AI_PROVIDER_DEFAULTS.ollama);
  assert.equal(AI_PROVIDER_DEFAULTS.gemini.envKey, 'GEMINI_API_KEY');
});

test('AiConfigError produces correct messages', () => {
  const err1 = new AiConfigError('gemini');
  assert.match(err1.message, /GEMINI_API_KEY/);
  assert.equal(err1.name, 'AiConfigError');

  const err2 = new AiConfigError('openai');
  assert.match(err2.message, /OPENAI_API_KEY/);

  const err3 = new AiConfigError('ollama');
  assert.match(err3.message, /ollama/i);
});

test('hasAiCredentials returns correct boolean based on config and env', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalOpenaiKey = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    // Ollama always returns true
    assert.equal(hasAiCredentials({}, 'ollama'), true);

    // No config, no env
    assert.equal(hasAiCredentials({}, 'gemini'), false);

    // With config
    assert.equal(hasAiCredentials({ ai: { apiKey: 'dummy' } }, 'gemini'), true);

    // With env
    process.env.GEMINI_API_KEY = 'dummy-env';
    assert.equal(hasAiCredentials({}, 'gemini'), true);
  } finally {
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalOpenaiKey) process.env.OPENAI_API_KEY = originalOpenaiKey;
  }
});

test('normalizeAiError maps error status/code correctly', () => {
  // 401/403 -> Authentication failed
  const err401 = new Error('Unauthorized');
  err401.response = { status: 401 };
  const norm401 = normalizeAiError(err401, 'gemini');
  assert.match(norm401.message, /Authentication failed/);
  assert.equal(norm401.cause, err401);

  // 429 -> Rate limited
  const err429 = new Error('Too Many Requests');
  err429.response = { status: 429, headers: { 'retry-after': '30' } };
  const norm429 = normalizeAiError(err429, 'openai');
  assert.match(norm429.message, /Rate limited.*after 30 seconds/);

  // Timeout
  const errTimeout = new Error('Timeout');
  errTimeout.code = 'ECONNABORTED';
  const normTimeout = normalizeAiError(errTimeout, 'ollama');
  assert.match(normTimeout.message, /timed out/);

  // Network down (no response)
  const errNoResponse = new Error('No response');
  const normNoResponse = normalizeAiError(errNoResponse, 'gemini');
  assert.match(normNoResponse.message, /Could not reach/);

  // Other status
  const errOther = new Error('Other');
  errOther.response = { status: 500, statusText: 'Internal Server Error' };
  const normOther = normalizeAiError(errOther, 'openai');
  assert.match(normOther.message, /AI request failed: 500 Internal Server Error/);
});

test('completeWithAi throws on unsupported provider', async () => {
  await assert.rejects(
    () => completeWithAi({ systemPrompt: 'sys', userPrompt: 'usr', config: { ai: { provider: 'unknown' } } }),
    /Unsupported AI provider: unknown/
  );
});

test('completeWithAi calls correct provider implementation', async () => {
  const originalPost = axios.post;
  let postCalledWith = null;

  axios.post = async (url, data, config) => {
    postCalledWith = { url, data, config };
    if (url.includes('openai.com')) {
      return { data: { choices: [{ message: { content: 'openai response' } }] } };
    }
    if (url.includes('generativelanguage')) {
      return { data: { candidates: [{ content: { parts: [{ text: 'gemini response' }] } }] } };
    }
    if (url.includes('localhost:11434')) {
      return { data: { response: 'ollama response' } };
    }
    throw new Error('Unexpected URL');
  };

  try {
    // Test Gemini
    const geminiRes = await completeWithAi({
      systemPrompt: 'sys-gem',
      userPrompt: 'usr-gem',
      config: { ai: { provider: 'gemini', apiKey: 'key-g' } }
    });
    assert.equal(geminiRes, 'gemini response');
    assert.ok(postCalledWith.url.includes('generativelanguage'));
    assert.equal(postCalledWith.data.contents[0].parts[0].text, 'usr-gem');

    // Test OpenAI
    const openaiRes = await completeWithAi({
      systemPrompt: 'sys-oa',
      userPrompt: 'usr-oa',
      config: { ai: { provider: 'openai', apiKey: 'key-oa' } }
    });
    assert.equal(openaiRes, 'openai response');
    assert.ok(postCalledWith.url.includes('openai.com'));
    assert.equal(postCalledWith.data.messages[1].content, 'usr-oa');

    // Test Ollama
    const ollamaRes = await completeWithAi({
      systemPrompt: 'sys-ol',
      userPrompt: 'usr-ol',
      config: { ai: { provider: 'ollama' } }
    });
    assert.equal(ollamaRes, 'ollama response');
    assert.ok(postCalledWith.url.includes('11434'));
  } finally {
    axios.post = originalPost;
  }
});
