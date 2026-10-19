import { readdirSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { parse } from 'acorn';

const files = readdirSync(new URL('../dist/', import.meta.url));
if (files.length !== 1 || files[0] !== 'plugin.js') {
  throw new Error('Expected exactly one artifact: dist/plugin.js');
}
const source = readFileSync(new URL('../dist/plugin.js', import.meta.url), 'utf8');
const program = parse(source, { ecmaVersion: 2015, sourceType: 'script' });
if (program.body.length !== 1 || program.body[0].type !== 'ExpressionStatement') {
  throw new Error('Expected a single IIFE expression');
}
const expression = program.body[0].expression;
if (expression.type !== 'CallExpression' || expression.callee.type !== 'FunctionExpression') {
  throw new Error('Expected a self-contained IIFE');
}
console.log(`Verified plugin.js: ES2015 IIFE, ${source.length} characters, no extra chunks`);
