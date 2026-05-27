/**
 * Colored logging helpers built on chalk.
 *
 * Usage:
 *   import { log } from '../utils/logger.js';
 *
 *   log.info('Starting server...');
 *   log.success('Server ready on port 3000');
 *   log.warn('Deprecated option used');
 *   log.error('Connection refused');
 *   log.debug('Verbose details only shown when perky_DEBUG is set');
 *   log.dim('Supplementary context');
 */

import process from 'node:process';

import chalk from 'chalk';

/**
 * Write a cyan informational message to stdout.
 * @param {string} message
 */
function info(message) {
  console.log(chalk.cyan(message));
}

/**
 * Write a green success message to stdout.
 * @param {string} message
 */
function success(message) {
  console.log(chalk.green(message));
}

/**
 * Write a yellow warning message to stderr.
 * @param {string} message
 */
function warn(message) {
  console.error(chalk.yellow(message));
}

/**
 * Write a red error message to stderr.
 * @param {string} message
 */
function error(message) {
  console.error(chalk.red(message));
}

/**
 * Write a debug message to stderr — only visible when `perky_DEBUG` is set.
 * @param {string} message
 */
function debug(message) {
  if (process.env.perky_DEBUG) {
    console.error(chalk.dim(`[debug] ${message}`));
  }
}

/**
 * Write a dimmed/muted message to stdout.
 * @param {string} message
 */
function dim(message) {
  console.log(chalk.dim(message));
}

export const log = { info, success, warn, error, debug, dim };
