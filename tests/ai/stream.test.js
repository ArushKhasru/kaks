import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { Readable } from 'node:stream';
import { printStream, streamWithAi } from '../../src/ai/stream.js';

test('printStream outputs chunks to stdout and appends newline if missing', async () => {
  const originalWrite = process.stdout.write;
  const written = [];
  process.stdout.write = (chunk) => {
    written.push(chunk);
    return true;
  };

  try {
    const stream = (async function* () {
      yield 'hello';
      yield ' world';
    })();

    const result = await printStream(stream);
    assert.equal(result, 'hello world');
    assert.deepEqual(written, ['hello', ' world', '\n']);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('printStream does not append newline if stream already ends with one', async () => {
  const originalWrite = process.stdout.write;
  const written = [];
  process.stdout.write = (chunk) => {
    written.push(chunk);
    return true;
  };

  try {
    const stream = (async function* () {
      yield 'hello\n';
    })();

    const result = await printStream(stream);
    assert.equal(result, 'hello\n');
    assert.deepEqual(written, ['hello\n']);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('streamWithAi parses OpenAI stream protocol correctly', async () => {
  const originalPost = axios.post;
  axios.post = async () => {
    return {
      data: Readable.from([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: [DONE]\n'
      ])
    };
  };

  try {
    const stream = streamWithAi({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      config: { ai: { provider: 'openai', apiKey: 'key' } }
    });

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, ['Hello', ' world']);
  } finally {
    axios.post = originalPost;
  }
});

test('streamWithAi parses Gemini stream protocol correctly', async () => {
  const originalPost = axios.post;
  axios.post = async () => {
    return {
      data: Readable.from([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}}]}][}\n', // malformed json test line (should skip/handle gracefully or be valid)
        'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" there"}]}}]}\n'
      ])
    };
  };

  try {
    const stream = streamWithAi({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      config: { ai: { provider: 'gemini', apiKey: 'key' } }
    });

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, ['Hi', ' there']);
  } finally {
    axios.post = originalPost;
  }
});

test('streamWithAi parses Ollama stream protocol correctly', async () => {
  const originalPost = axios.post;
  axios.post = async () => {
    return {
      data: Readable.from([
        '{"response":"Ollama","done":false}\n',
        '{"response":" rocks","done":false}\n',
        '{"done":true}\n'
      ])
    };
  };

  try {
    const stream = streamWithAi({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      config: { ai: { provider: 'ollama' } }
    });

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, ['Ollama', ' rocks']);
  } finally {
    axios.post = originalPost;
  }
});
