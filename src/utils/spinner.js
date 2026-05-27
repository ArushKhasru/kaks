/**
 * Ora spinner helpers.
 *
 * Re-exports the high-level `runWithSpinner` from shared and adds a
 * lower-level `createSpinner` factory for cases where manual start/stop
 * control is needed.
 *
 * Usage:
 *   import { runWithSpinner, createSpinner } from '../utils/spinner.js';
 *
 *   // High-level — run a task with automatic spinner lifecycle
 *   const result = await runWithSpinner('Loading...', () => fetchData());
 *
 *   // Low-level — manual control
 *   const spinner = createSpinner('Processing...');
 *   spinner.start();
 *   // ... do work ...
 *   spinner.succeed('Done!');
 */

import ora from 'ora';

export { runWithSpinner } from '../commands/shared.js';

/**
 * Create an ora spinner instance with the given message.
 *
 * The spinner is **not** started automatically — call `.start()` when ready.
 *
 * @param {string} message - Initial spinner text
 * @param {object} [options] - Additional ora options
 * @returns {import('ora').Ora}
 */
export function createSpinner(message, options = {}) {
  return ora({ text: message, ...options });
}
