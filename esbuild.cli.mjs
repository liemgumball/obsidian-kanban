import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shim = (name) => path.join(root, 'src/cli/shims', name);

/**
 * Modules that only exist for the running plugin. Each one either requires the
 * real `obsidian` module or touches the DOM while it loads, so the CLI bundle
 * swaps in a stub. Keep this list in sync with the aliases in vitest.config.ts.
 */
export const cliAlias = {
  obsidian: shim('obsidian.ts'),
  'obsidian-daily-notes-interface': shim('dailyNotes.ts'),
  'choices.js': shim('choices.ts'),
  'src/components/Item/MetadataTable': shim('metadataTable.ts'),
};

const entry = process.argv[2] ?? 'src/cli/index.ts';
const outfile = process.argv[3] ?? 'kanban-cli.js';

await esbuild.build({
  entryPoints: [path.resolve(root, entry)],
  outfile: path.resolve(root, outfile),
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  alias: cliAlias,
  external: [...builtins],
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
});
