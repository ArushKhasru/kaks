import assert from 'node:assert/strict';
import test from 'node:test';
import { getEditorCommand, getTerminalCommand, getExplorerCommand } from '../../src/workspace/opener.js';

test('getEditorCommand formats correct commands on win32 vs others', () => {
  const originalPlatform = process.platform;

  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    assert.deepEqual(getEditorCommand('code', '/path/to/project'), {
      command: 'cmd',
      args: ['/c', 'start', '', 'code', '/path/to/project']
    });

    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    assert.deepEqual(getEditorCommand('code', '/path/to/project'), {
      command: 'code',
      args: ['/path/to/project']
    });
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});

test('getTerminalCommand formats shell and paths for win32/darwin/linux', () => {
  const originalPlatform = process.platform;
  const originalEnvTerminal = process.env.TERMINAL;

  try {
    // Win32 Windows Terminal
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    assert.deepEqual(getTerminalCommand('/path/to/project', 'wt'), {
      command: 'wt',
      args: ['-d', '/path/to/project']
    });

    // Win32 cmd
    assert.deepEqual(getTerminalCommand('/path/to/project', 'cmd'), {
      command: 'cmd',
      args: ['/c', 'start', '', 'cmd', '/k', `cd /d "/path/to/project"`]
    });

    // Win32 powershell (default)
    const pwshResult = getTerminalCommand("/path/to/o'project", 'default');
    assert.equal(pwshResult.command, 'cmd');
    assert.equal(pwshResult.args[3], 'powershell');
    assert.ok(pwshResult.args[6].includes("o''project")); // escaped single quote

    // Darwin
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    assert.deepEqual(getTerminalCommand('/path/to/project'), {
      command: 'open',
      args: ['-a', 'Terminal', '/path/to/project']
    });

    // Linux Gnome Terminal
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env.TERMINAL = '/usr/bin/gnome-terminal';
    assert.deepEqual(getTerminalCommand('/path/to/project'), {
      command: '/usr/bin/gnome-terminal',
      args: ['--working-directory=/path/to/project']
    });

    // Linux Konsole
    process.env.TERMINAL = '/usr/bin/konsole';
    assert.deepEqual(getTerminalCommand('/path/to/project'), {
      command: '/usr/bin/konsole',
      args: ['--workdir', '/path/to/project']
    });

    // Linux fallback
    process.env.TERMINAL = 'x-terminal-emulator';
    assert.deepEqual(getTerminalCommand('/path/to/project'), {
      command: 'x-terminal-emulator',
      args: []
    });
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalEnvTerminal !== undefined) {
      process.env.TERMINAL = originalEnvTerminal;
    } else {
      delete process.env.TERMINAL;
    }
  }
});

test('getExplorerCommand formats explorer/open/xdg-open based on platform', () => {
  const originalPlatform = process.platform;

  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    assert.deepEqual(getExplorerCommand('/path'), { command: 'explorer', args: ['/path'] });

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    assert.deepEqual(getExplorerCommand('/path'), { command: 'open', args: ['/path'] });

    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    assert.deepEqual(getExplorerCommand('/path'), { command: 'xdg-open', args: ['/path'] });
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});
