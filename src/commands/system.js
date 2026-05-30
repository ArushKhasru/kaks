import {
  formatCommand,
  runPowerAction,
  updatePerky,
} from '../workspace/system.js';
import { CliError, handleCommandError } from './shared.js';

export function registerSystemCommands(program) {
  program.option('--update', 'Update perky to the latest published version');

  program
    .command('shutdown')
    .description('Shut down the system')
    .option('--delay <seconds>', 'Delay before shutting down', parseNonNegativeInteger, 0)
    .option('-f, --force', 'Force running apps to close')
    .option('--dry-run', 'Print the system command without running it')
    .addHelpText('after', `

Examples:
  $ perky shutdown
  $ perky shutdown --delay 60
`)
    .action(async (options) => {
      await handleSystemAction(() => runPowerAction('shutdown', options), {
        dryRun: options.dryRun,
        success: 'Shutdown command sent.',
      });
    });

  program
    .command('restart')
    .alias('reboot')
    .description('Restart the system')
    .option('--delay <seconds>', 'Delay before restarting', parseNonNegativeInteger, 0)
    .option('-f, --force', 'Force running apps to close')
    .option('--dry-run', 'Print the system command without running it')
    .addHelpText('after', `

Examples:
  $ perky restart
  $ perky reboot --delay 30
`)
    .action(async (options) => {
      await handleSystemAction(() => runPowerAction('restart', options), {
        dryRun: options.dryRun,
        success: 'Restart command sent.',
      });
    });

  program
    .command('update')
    .description('Update perky to the latest published version')
    .option('--dry-run', 'Print the update command without running it')
    .addHelpText('after', `

Examples:
  $ perky update
  $ perky update --dry-run
`)
    .action(async (options) => {
      await handleSystemAction(() => updatePerky(options), {
        dryRun: options.dryRun,
        before: 'Checking for perky updates...',
        success: 'perky update finished.',
      });
    });
}

export async function runRootUpdateOption(program) {
  if (!program.opts().update) {
    return false;
  }

  await handleSystemAction(() => updatePerky({}), {
    before: 'Checking for perky updates...',
    success: 'perky update finished.',
  });

  return true;
}

async function handleSystemAction(task, messages) {
  try {
    if (messages.before && !messages.dryRun) {
      console.log(messages.before);
    }

    const commandSpec = await task();

    if (messages.dryRun) {
      console.log(`Would run: ${formatCommand(commandSpec)}`);
      return;
    }

    console.log(commandSpec.message ?? messages.success);
  } catch (error) {
    handleCommandError(error);
  }
}

function parseNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== String(value).trim()) {
    throw new CliError(`Expected a non-negative integer, received: ${value}`);
  }

  return parsed;
}
