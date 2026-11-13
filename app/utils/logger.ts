/**
 * Console output that does not follow users into production.
 *
 * The app was shipping ~300 `console.log` calls, several of them on paths
 * that run on every render or every push-state check. In a browser that
 * is noise in the console; on a phone it is also wasted work, because
 * `DebugConsole` intercepts every console call and notifies its
 * subscribers on each one.
 *
 * `import.meta.env.DEV` is replaced by a literal at build time, so in a
 * production bundle these calls fold away to nothing.
 *
 * Errors and warnings are deliberately NOT silenced — when something
 * actually goes wrong in production we still want to hear about it.
 */
const isDev = import.meta.env.DEV;

export const log = (...args: unknown[]): void => {
  if (isDev) console.log(...args);
};

export const info = (...args: unknown[]): void => {
  if (isDev) console.info(...args);
};

/** Always shown: a warning is for something the user may be affected by. */
export const warn = (...args: unknown[]): void => console.warn(...args);

/** Always shown. */
export const error = (...args: unknown[]): void => console.error(...args);
