import { readFileSync, writeFileSync } from 'fs';
import type { Board } from 'src/components/types';
import { frontmatterKey } from 'src/parsers/common';
import { astToUnhydratedBoard, boardToMd } from 'src/parsers/formats/list';
import { parseMarkdown } from 'src/parsers/parseMarkdown';

import { createStateManager } from './stateManagerStub';

export class BoardError extends Error {}

/**
 * Parses markdown into a `Board` without hydrating it. Hydration resolves
 * moment dates and vault links for rendering, neither of which the CLI needs.
 */
export function mdToBoard(md: string, filePath: string): Board {
  const stateManager = createStateManager(filePath);
  const { settings, frontmatter, ast } = parseMarkdown(stateManager, md);

  if (!settings[frontmatterKey] && !frontmatter[frontmatterKey]) {
    throw new BoardError(`${filePath} is not a Kanban board: no "${frontmatterKey}" frontmatter`);
  }

  return astToUnhydratedBoard(stateManager, settings, frontmatter, ast, md);
}

export { boardToMd };

export function loadBoard(filePath: string): Board {
  let md: string;

  try {
    md = readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new BoardError(`Cannot read ${filePath}: ${(e as Error).message}`);
  }

  return mdToBoard(md, filePath);
}

/**
 * Serializes first, writes second, so a serialization failure leaves the
 * original file untouched.
 */
export function saveBoard(filePath: string, board: Board): void {
  const md = boardToMd(board);
  writeFileSync(filePath, md, 'utf8');
}
