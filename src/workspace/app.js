import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { execa } from 'execa';

import { CliError, resolveUserPath } from '../commands/shared.js';
import { launchDetached } from './process.js';

const WINDOWS_APP_PATHS = [
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
];

export async function openApp(nameParts) {
  const appName = normalizeAppName(nameParts);
  if (!appName) {
    throw new CliError('Missing app name.');
  }

  const launcher = await resolveAppLauncher(appName);
  if (!launcher) {
    throw new CliError(`App not found: ${appName}. Use "perky open <project>" to open a configured project.`);
  }

  await launchDetached(launcher.command, launcher.args ?? [], launcher.options);
  console.log(`Opening app: ${launcher.label ?? appName}`);
}

async function resolveAppLauncher(appName) {
  if (isExplicitPath(appName)) {
    const resolvedPath = resolveUserPath(appName);
    await assertFileExists(resolvedPath, appName);
    return { command: resolvedPath, args: [], label: resolvedPath };
  }

  const pathMatch = await resolveExecutableOnPath(appName);
  if (pathMatch) {
    return { command: pathMatch, args: [], label: appName };
  }

  if (process.platform === 'win32') {
    const registryMatch = await resolveWindowsAppPath(appName);
    if (registryMatch) {
      return { command: registryMatch, args: [], label: appName };
    }
  }

  return null;
}

function normalizeAppName(nameParts) {
  if (Array.isArray(nameParts)) {
    return nameParts.join(' ').trim();
  }
  return String(nameParts ?? '').trim();
}

function isExplicitPath(value) {
  if (!value) return false;
  return value.includes('\\')
    || value.includes('/')
    || value.startsWith('.')
    || /^[a-z]:/i.test(value);
}

async function assertFileExists(targetPath, displayName) {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) {
      throw new CliError(`App path is not a file: ${displayName}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new CliError(`App path not found: ${displayName}`);
    }
    throw error;
  }
}

async function fileExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveExecutableOnPath(command) {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execa('where.exe', [command]);
      const candidate = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      return candidate || null;
    } catch {
      return null;
    }
  }

  try {
    const { stdout } = await execa('sh', ['-lc', `command -v -- ${shellSingleQuote(command)}`]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function resolveWindowsAppPath(appName) {
  const keyName = appName.toLowerCase().endsWith('.exe') ? appName : `${appName}.exe`;

  for (const hive of WINDOWS_APP_PATHS) {
    const keyPath = `${hive}\\${keyName}`;
    try {
      const { stdout } = await execa('reg', ['query', keyPath, '/ve']);
      const match = stdout.match(/\(Default\)\s+REG_\w+\s+(.+)/i);
      if (match) {
        const rawPath = match[1].trim();
        const cleaned = normalizeExecutablePath(expandWindowsEnv(stripQuotes(rawPath)));
        if (cleaned && await fileExists(cleaned)) {
          return cleaned;
        }
      }
    } catch {
      // Try the next hive.
    }
  }

  return null;
}

function stripQuotes(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeExecutablePath(value) {
  if (!value) return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?\.exe)\b/i);
  return match ? match[1] : trimmed;
}

function expandWindowsEnv(value) {
  return value.replace(/%([^%]+)%/g, (match, envKey) => process.env[envKey] ?? match);
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
