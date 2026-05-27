/**
 * Custom error classes and error handling utilities.
 *
 * Base error class for all CLI errors.
 * Extracted to its own module to avoid circular dependency issues between
 * shared.js and the ai/ layer.
 */

/**
 * Base error class for all CLI errors.
 * Provides a structured exit code and optional cause chain.
 */
export class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? 1;
    this.cause = options.cause;
  }
}

/**
 * Error categories matching spec section 11.1.
 * Used to classify errors for consistent user-facing messages.
 */
export const ErrorCategory = {
  CONFIG_MISSING: 'CONFIG_MISSING',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  FILE_ERROR: 'FILE_ERROR',
  INVALID_URL: 'INVALID_URL',
  TOOL_MISSING: 'TOOL_MISSING',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Classify an error into one of the known error categories.
 *
 * @param {Error} error - The error to classify
 * @returns {string} One of the ErrorCategory values
 */
export function classifyError(error) {
  const message = String(error?.message ?? '').toLowerCase();

  if (message.includes('api key') || message.includes('not found for') || message.includes('run "perky init"')) {
    return ErrorCategory.CONFIG_MISSING;
  }

  if (error?.response?.status === 429 || message.includes('rate limit')) {
    return ErrorCategory.RATE_LIMIT;
  }

  if (!error?.response && (message.includes('could not reach') || message.includes('econnrefused') || message.includes('econnaborted') || error?.code === 'ECONNREFUSED' || error?.code === 'ECONNABORTED')) {
    return ErrorCategory.NETWORK_ERROR;
  }

  if (message.includes('file not found') || message.includes('not a file') || message.includes('binary file') || error?.code === 'ENOENT') {
    return ErrorCategory.FILE_ERROR;
  }

  if (message.includes('valid url') || message.includes('missing url')) {
    return ErrorCategory.INVALID_URL;
  }

  if (message.includes('not found:') && (message.includes('editor') || message.includes('command'))) {
    return ErrorCategory.TOOL_MISSING;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Format an error into a user-friendly message string with an appropriate emoji prefix.
 *
 * @param {Error} error - The error to format
 * @returns {string} Formatted error message with emoji prefix
 */
export function formatErrorMessage(error) {
  const category = classifyError(error);
  const message = error instanceof CliError ? error.message : `Something went wrong. Error: ${error.message}`;

  const prefixes = {
    [ErrorCategory.CONFIG_MISSING]: '🔑',
    [ErrorCategory.NETWORK_ERROR]: '🌐',
    [ErrorCategory.RATE_LIMIT]: '⏳',
    [ErrorCategory.FILE_ERROR]: '📁',
    [ErrorCategory.INVALID_URL]: '❌',
    [ErrorCategory.TOOL_MISSING]: '📝',
    [ErrorCategory.UNKNOWN]: '❌',
  };

  return `${prefixes[category]} ${message}`;
}
