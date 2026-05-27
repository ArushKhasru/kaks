/**
 * Configuration utilities — read, write, merge, and validate the perky config store.
 *
 * This module surfaces the config helpers that live in the shared barrel
 * (`src/commands/shared.js`) under a dedicated import path matching the
 * project structure described in the spec (`src/utils/config.js`).
 */

export {
  CONFIG_DIR,
  CONFIG_PATH,
  LOCAL_CONFIG_NAME,
  getDefaultConfig,
  loadGlobalConfig,
  saveGlobalConfig,
  loadLocalConfig,
  mergeConfig,
  readJson,
  writeJson,
  getByPath,
  setByPath,
  deleteByPath,
  parseConfigValue,
  validateConfigValue,
  pathExists,
  resolveUserPath,
} from '../commands/shared.js';
