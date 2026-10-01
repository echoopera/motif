// Contract tests for {{name}}. Every export in CONTRACT.md gets a test. Every state in README gets a test.
import { MODULE } from '../src/index';
export const tests = [
  ['exports its name', () => { if (MODULE !== '{{name}}') throw new Error('name mismatch'); }],
];
