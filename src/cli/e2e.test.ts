import { execFileSync } from 'child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const cli = join(root, 'kanban-cli.js');

interface Result {
  status: number;
  stdout: string;
  stderr: string;
}

function kanban(args: string[]): Result {
  try {
    const stdout = execFileSync('node', [cli, ...args], { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

function board(name = 'simple.md'): string {
  const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
  const file = join(dir, name);
  copyFileSync(join(__dirname, '__fixtures__', name), file);
  return file;
}

beforeAll(() => {
  execFileSync('node', [join(root, 'esbuild.cli.mjs')], { cwd: root, stdio: 'ignore' });
}, 60_000);

describe('kanban list', () => {
  it('prints lanes and card indices', () => {
    const { status, stdout } = kanban(['list', board()]);
    expect(status).toBe(0);
    expect(stdout).toContain('## Todo');
    expect(stdout).toContain('   0 [ ] First card');
    expect(stdout).toContain('   0 [x] Finished card');
    expect(stdout).toContain('  (empty)');
  });

  it('emits stable json', () => {
    const { stdout } = kanban(['list', board(), '--json']);
    expect(JSON.parse(stdout)[0]).toEqual({
      title: 'Todo',
      cards: [
        { index: 0, title: 'First card', done: false },
        { index: 1, title: 'Second card', done: false },
      ],
    });
  });

  it('leaves the file untouched', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    kanban(['list', file]);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});

describe('mutating commands', () => {
  it('adds a card', () => {
    const file = board();
    const { status, stdout } = kanban(['add', file, '--lane', 'Todo', '--text', 'Third card']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('Added card to "Todo" (2)');
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Second card\n- [ ] Third card\n');
  });

  it('changes nothing else in the file', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    kanban(['add', file, '--lane', 'Todo', '--text', 'Third card']);
    expect(readFileSync(file, 'utf8')).toBe(
      before.replace('- [ ] Second card\n', '- [ ] Second card\n- [ ] Third card\n')
    );
  });

  it('edits, completes, moves, and removes a card', () => {
    const file = board();

    expect(
      kanban(['edit', file, '--lane', 'Todo', '--index', '0', '--text', 'Renamed']).status
    ).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Renamed');

    expect(kanban(['done', file, '--lane', 'Todo', '--index', '0']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [x] Renamed');

    expect(kanban(['done', file, '--lane', 'Todo', '--index', '0', '--undo']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Renamed');

    expect(kanban(['move', file, '--lane', 'Todo', '--index', '0', '--to', 'Doing']).status).toBe(
      0
    );
    expect(readFileSync(file, 'utf8')).toContain('## Doing\n\n- [ ] Renamed\n');

    expect(kanban(['rm', file, '--lane', 'Doing', '--index', '0']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).not.toContain('Renamed');
  });

  it('adds and removes lanes', () => {
    const file = board();

    expect(kanban(['lane', 'add', file, '--name', 'Blocked', '--pos', '1']).stdout.trim()).toBe(
      'Added lane "Blocked" at 1'
    );
    expect(readFileSync(file, 'utf8')).toContain(
      '## Todo\n\n- [ ] First card\n- [ ] Second card\n\n\n## Blocked'
    );

    expect(kanban(['lane', 'rm', file, '--name', 'Todo']).stdout.trim()).toBe(
      'Removed lane "Todo" and 2 cards'
    );
    expect(readFileSync(file, 'utf8')).not.toContain('## Todo');
  });
});

describe('errors', () => {
  it('exits 1 on a missing file', () => {
    const { status, stderr } = kanban(['list', '/nope/missing.md']);
    expect(status).toBe(1);
    expect(stderr).toContain('/nope/missing.md');
  });

  it('exits 1 on a file that is not a board', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    const file = join(dir, 'plain.md');
    writeFileSync(file, '---\n\ntitle: Not a board\n\n---\n\nhello');
    const { status, stderr } = kanban(['list', file]);
    expect(status).toBe(1);
    expect(stderr).toContain('is not a Kanban board');
  });

  it('exits 1 and names the file when it cannot be parsed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    const file = join(dir, 'notes.json');
    writeFileSync(file, '{}');
    const { status, stderr } = kanban(['list', file]);
    expect(status).toBe(1);
    expect(stderr).toContain(file);
    expect(stderr).toContain('Error parsing frontmatter');
  });

  it('exits 1 on an unknown lane and lists the valid ones', () => {
    const { status, stderr } = kanban(['add', board(), '--lane', 'Nope', '--text', 'x']);
    expect(status).toBe(1);
    expect(stderr).toContain('No lane named "Nope"');
    expect(stderr).toContain('Todo, Doing, Done');
  });

  it('exits 1 on an out of range index and leaves the file alone', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    const { status, stderr } = kanban(['rm', file, '--lane', 'Todo', '--index', '9']);
    expect(status).toBe(1);
    expect(stderr).toContain('Valid indices: 0-1');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('exits 1 on a missing flag and prints usage', () => {
    const { status, stderr } = kanban(['add', board(), '--lane', 'Todo']);
    expect(status).toBe(1);
    expect(stderr).toContain('Missing --text');
    expect(stderr).toContain('kanban list <file.md>');
  });
});
