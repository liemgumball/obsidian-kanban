import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { boardToMd, mdToBoard } from './board';

const fixtureDir = join(__dirname, '__fixtures__');
const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith('.md'));

describe('round trip', () => {
  it('has fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('%s survives parse and serialize unchanged', (fixture) => {
    const md = readFileSync(join(fixtureDir, fixture), 'utf8');
    expect(boardToMd(mdToBoard(md, fixture))).toBe(md);
  });
});
