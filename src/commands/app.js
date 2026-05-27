import {
  handleCommandError,
} from './shared.js';
import { openApp } from '../workspace/app.js';

export function registerAppCommand(program) {
  program
    .command('app <name...>')
    .description('Open an installed application by name')
    .addHelpText('after', `

Examples:
  $ perky app chrome
  $ perky chrome
`)
    .action(async (nameParts) => {
      try {
        await openApp(nameParts);
      } catch (error) {
        handleCommandError(error);
      }
    });
}
