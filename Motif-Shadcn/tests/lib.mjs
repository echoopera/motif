import path from 'node:path'; import { fileURLToPath } from 'node:url';
export * from '../../Motif9/tests/v8/lib.mjs';
import { openApp as open } from '../../Motif9/tests/v8/lib.mjs';
export const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP = path.join(here, 'Motif.html');
export const openShadcn = (browser, o = {}) => open(browser, { file: APP, ...o });
