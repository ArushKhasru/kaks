import chalk from 'chalk';

import {
  handleCommandError,
} from './shared.js';

export function registerTimeCommand(program) {
  program
    .command('time')
    .description('Show the current local time')
    .option('--live', 'Continuously update the time')
    .addHelpText('after', `

Examples:
  $ perky time
  $ perky time --live
`)
    .action(async (options) => {
      try {
        await showTime(options);
      } catch (error) {
        handleCommandError(error);
      }
    });
}

export async function showTime(options = {}) {
  const output = formatTimeLines(formatLocalTime(new Date()));

  if (!options.live || !process.stdout.isTTY) {
    console.log(output);
    return;
  }

  const render = () => {
    const next = formatTimeLines(formatLocalTime(new Date()));
    process.stdout.write('\x1b[2J\x1b[0f');
    process.stdout.write(`${next}\n`);
  };

  render();
  const timer = setInterval(render, 1000);
  const stop = () => {
    clearInterval(timer);
    process.stdout.write('\n');
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

function formatTimeLines(formatted) {
  return [
    chalk.cyan(`Date: ${formatted.date}`),
    chalk.green(`Time: ${formatted.time}`),
    chalk.yellow(`GMT: ${formatted.gmt}`),
  ].join('\n');
}

function formatLocalTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);
  const tz = `GMT${sign}${offsetHours}:${offsetMins}`;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`,
    gmt: tz,
  };
}
