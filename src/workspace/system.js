import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';

import { CONFIG_DIR, CliError } from '../commands/shared.js';

export const BACKGROUND_APPS_PATH = path.join(CONFIG_DIR, 'background-apps.json');
const PACKAGE_JSON_PATH = fileURLToPath(new URL('../../package.json', import.meta.url));

const REGISTRY_LIMIT = 100;
const WINDOWS_EXECUTABLE_EXTENSIONS = /\.(exe|cmd|bat|com)$/i;

export function getPowerCommand(actionInput, options = {}, platform = process.platform) {
  const action = normalizePowerAction(actionInput);
  const delay = normalizeDelay(options.delay ?? 0);
  const force = Boolean(options.force);

  if (platform === 'win32') {
    return {
      command: 'shutdown',
      args: [
        action === 'restart' ? '/r' : '/s',
        '/t',
        String(delay),
        ...(force ? ['/f'] : []),
      ],
      label: action,
    };
  }

  if (platform === 'darwin') {
    const script = `tell application "System Events" to ${action === 'restart' ? 'restart' : 'shut down'}`;
    return withDelay({ command: 'osascript', args: ['-e', script], label: action }, delay);
  }

  return withDelay({
    command: 'systemctl',
    args: [action === 'restart' ? 'reboot' : 'poweroff'],
    label: action,
  }, delay);
}

export async function runPowerAction(action, options = {}) {
  const commandSpec = getPowerCommand(action, options);

  if (!options.dryRun) {
    await execa(commandSpec.command, commandSpec.args, { stdio: 'ignore' });
  }

  return commandSpec;
}

export function getUpdateCommand(options = {}, platform = process.platform) {
  const packageName = options.packageName ?? 'perky';

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['install', '-g', `${packageName}@latest`],
    label: 'update',
  };
}

export function getLatestVersionCommand(options = {}, platform = process.platform) {
  const packageName = options.packageName ?? 'perky';

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['view', `${packageName}@latest`, 'version'],
    label: 'check latest version',
  };
}

export async function updatePerky(options = {}) {
  const platform = options.platform ?? process.platform;
  const packageName = options.packageName ?? 'perky';
  const commandSpec = getUpdateCommand({ packageName }, platform);

  if (options.dryRun) {
    return commandSpec;
  }

  const currentVersion = options.currentVersion ?? await readPackageVersion(options.packageJsonPath);
  const latestVersion = options.latestVersion ?? await fetchLatestPackageVersion({ ...options, packageName, platform });
  const updateAvailable = isNewerVersion(latestVersion, currentVersion);

  if (!updateAvailable) {
    return {
      ...commandSpec,
      currentVersion,
      latestVersion,
      skipped: true,
      message: `${packageName} is already using the latest version (${currentVersion}).`,
    };
  }

  const exec = options.exec ?? execa;

  try {
    await exec(commandSpec.command, commandSpec.args, { stdio: 'inherit' });
  } catch (error) {
    throw new CliError(
      `Update failed. Run "${formatCommand(commandSpec)}" manually, or use "npm link" from this repo for local development.`,
      { cause: error },
    );
  }

  return {
    ...commandSpec,
    currentVersion,
    latestVersion,
    updated: true,
    message: `${packageName} updated from ${currentVersion} to ${latestVersion}.`,
  };
}

export async function readPackageVersion(packageJsonPath = PACKAGE_JSON_PATH) {
  try {
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(raw);
    const version = String(packageJson.version ?? '').trim();

    if (!version) {
      throw new CliError(`Package version is missing in ${packageJsonPath}`);
    }

    return version;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw new CliError(`Unable to read package version from ${packageJsonPath}`, { cause: error });
  }
}

export async function fetchLatestPackageVersion(options = {}) {
  const platform = options.platform ?? process.platform;
  const packageName = options.packageName ?? 'perky';
  const commandSpec = getLatestVersionCommand(options, platform);
  const exec = options.exec ?? execa;

  try {
    const { stdout } = await exec(commandSpec.command, commandSpec.args, { stdio: 'pipe' });
    const latestVersion = String(stdout ?? '').trim();

    if (!latestVersion) {
      throw new CliError(`No latest version was returned by "${formatCommand(commandSpec)}".`);
    }

    return latestVersion;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw new CliError(
      `Unable to check the latest ${packageName} version. Run "${formatCommand(commandSpec)}" manually to verify the published version.`,
      { cause: error },
    );
  }
}

export function isNewerVersion(candidateVersion, currentVersion) {
  return compareVersions(candidateVersion, currentVersion) > 0;
}

export async function recordBackgroundApp(entry) {
  const normalized = normalizeBackgroundEntry(entry);
  if (!normalized) {
    return;
  }

  const registry = await readBackgroundRegistry();
  const apps = [...registry.apps, normalized].slice(-REGISTRY_LIMIT);

  await fs.mkdir(path.dirname(BACKGROUND_APPS_PATH), { recursive: true });
  await fs.writeFile(
    `${BACKGROUND_APPS_PATH}.tmp`,
    `${JSON.stringify({ version: 1, apps }, null, 2)}\n`,
    'utf8',
  );
  await fs.rename(`${BACKGROUND_APPS_PATH}.tmp`, BACKGROUND_APPS_PATH);
}

export function getProcessNamesForLauncher(launcher, platform = process.platform) {
  const launchCommand = getLaunchTargetCommand(launcher, platform);
  const processName = normalizeProcessName(launchCommand, platform);

  return processName ? [processName] : [];
}

export function normalizeProcessName(command, platform = process.platform) {
  const rawCommand = String(command ?? '').trim().replace(/^"|"$/g, '');
  if (!rawCommand) {
    return null;
  }

  const basename = (platform === 'win32' ? path.win32.basename(rawCommand) : path.basename(rawCommand)).trim();
  if (!basename) {
    return null;
  }

  if (platform === 'win32') {
    return WINDOWS_EXECUTABLE_EXTENSIONS.test(basename)
      ? basename.replace(/\.(cmd|bat|com)$/i, '.exe')
      : `${basename}.exe`;
  }

  return basename.replace(WINDOWS_EXECUTABLE_EXTENSIONS, '');
}

export function formatCommand(commandSpec) {
  return [commandSpec.command, ...(commandSpec.args ?? [])].map(formatCommandPart).join(' ');
}

function normalizePowerAction(actionInput) {
  const action = String(actionInput ?? '').trim().toLowerCase();

  if (action === 'restart' || action === 'reboot') {
    return 'restart';
  }

  if (action === 'shutdown' || action === 'poweroff') {
    return 'shutdown';
  }

  throw new CliError(`Unsupported system action: ${actionInput}`);
}

function normalizeDelay(value) {
  const delay = Number(value);
  if (!Number.isInteger(delay) || delay < 0) {
    throw new CliError(`Delay must be a non-negative integer, received: ${value}`);
  }

  return delay;
}

function withDelay(commandSpec, delay) {
  if (!delay) {
    return commandSpec;
  }

  const delayedCommand = [commandSpec.command, ...commandSpec.args].map(shellSingleQuote).join(' ');
  return {
    command: 'sh',
    args: ['-lc', `sleep ${delay}; ${delayedCommand}`],
    label: commandSpec.label,
  };
}

async function readBackgroundRegistry() {
  try {
    const raw = await fs.readFile(BACKGROUND_APPS_PATH, 'utf8');
    const registry = JSON.parse(raw);

    return {
      version: 1,
      apps: Array.isArray(registry.apps) ? registry.apps : [],
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { version: 1, apps: [] };
    }

    if (error instanceof SyntaxError) {
      throw new CliError(`Invalid background app registry: ${BACKGROUND_APPS_PATH}`, { cause: error });
    }

    throw error;
  }
}

function normalizeBackgroundEntry(entry) {
  const processNames = [...new Set((entry.processNames ?? [])
    .map((processName) => normalizeProcessName(processName))
    .filter(Boolean))];

  const pid = Number(entry.pid);
  const normalizedPid = Number.isInteger(pid) && pid > 0 ? pid : undefined;

  if (!normalizedPid && processNames.length === 0) {
    return null;
  }

  return {
    kind: entry.kind ?? 'app',
    name: String(entry.name ?? entry.label ?? 'app'),
    launchedAt: new Date().toISOString(),
    ...(normalizedPid ? { pid: normalizedPid } : {}),
    ...(entry.command ? { command: String(entry.command) } : {}),
    ...(Array.isArray(entry.args) ? { args: entry.args.map(String) } : {}),
    processNames,
  };
}

function getLaunchTargetCommand(launcher, platform) {
  if (!launcher) {
    return null;
  }

  if (platform === 'win32' && path.win32.basename(launcher.command ?? '').toLowerCase() === 'cmd') {
    const args = launcher.args ?? [];
    const startIndex = args.findIndex((arg) => String(arg).toLowerCase() === 'start');

    if (startIndex >= 0) {
      const maybeTitleIndex = startIndex + 1;
      const commandIndex = args[maybeTitleIndex] === '' ? maybeTitleIndex + 1 : maybeTitleIndex;
      return args[commandIndex] ?? launcher.command;
    }
  }

  return launcher.command;
}

function formatCommandPart(value) {
  const part = String(value);
  return /^[A-Za-z0-9_./:=@+-]+$/.test(part) ? part : JSON.stringify(part);
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function compareVersions(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);

  for (let index = 0; index < left.main.length; index += 1) {
    if (left.main[index] !== right.main[index]) {
      return left.main[index] > right.main[index] ? 1 : -1;
    }
  }

  if (left.prerelease.length === 0 && right.prerelease.length > 0) {
    return 1;
  }

  if (left.prerelease.length > 0 && right.prerelease.length === 0) {
    return -1;
  }

  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    if (leftPart.value === rightPart.value && leftPart.numeric === rightPart.numeric) {
      continue;
    }

    if (leftPart.numeric && rightPart.numeric) {
      return leftPart.value > rightPart.value ? 1 : -1;
    }

    if (leftPart.numeric !== rightPart.numeric) {
      return leftPart.numeric ? -1 : 1;
    }

    return leftPart.value > rightPart.value ? 1 : -1;
  }

  return 0;
}

function parseSemver(version) {
  const raw = String(version ?? '').trim().replace(/^v/i, '');
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);

  if (!match) {
    throw new CliError(`Invalid semantic version: ${version}`);
  }

  return {
    main: match.slice(1, 4).map(Number),
    prerelease: match[4] ? match[4].split('.').map(parsePrereleasePart) : [],
  };
}

function parsePrereleasePart(part) {
  return /^\d+$/.test(part)
    ? { numeric: true, value: Number(part) }
    : { numeric: false, value: part };
}
