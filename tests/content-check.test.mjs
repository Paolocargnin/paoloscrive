import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { validatePublicContent } from '../scripts/content-contract.mjs';

const execFileAsync = promisify(execFile);
const fixtures = path.join('tests', 'fixtures', 'content');
const posts = (name) => path.join(fixtures, name, 'src', 'content', 'posts');
const workspace = (name) => path.join(fixtures, name, 'content', 'workspace');

describe('content check', () => {
  it('accepts Racconti, a signed Translation and a private Workspace', async () => {
    const { stdout } = await execFileAsync('node', [
      './scripts/content-check.mjs',
      '--posts',
      posts('valid'),
      '--workspace',
      workspace('valid'),
    ]);

    expect(stdout).toContain(
      'Racconti pubblici e Workspace rispettano il contratto v3.',
    );
  });

  it('rejects a Racconto without a required metadato', async () => {
    await expect(
      execFileAsync('node', [
        './scripts/content-check.mjs',
        '--posts',
        posts('incomplete'),
        '--public-only',
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'manca il metadato obbligatorio description',
      ),
    });
  });

  it('runs the same public validation before production builds', async () => {
    await expect(
      validatePublicContent({ postsDirectory: posts('incomplete') }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        expect.stringContaining('manca il metadato obbligatorio description'),
      ]),
    });
  });

  it('rejects two Racconti with the same stable id', async () => {
    await expect(
      validatePublicContent({ postsDirectory: posts('duplicate-id') }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([expect.stringContaining('id già usato')]),
    });
  });

  it('holds back a Revisione until its Translation follows it', async () => {
    await expect(
      validatePublicContent({ postsDirectory: posts('stale-translation') }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        expect.stringContaining(
          'La Revisione non esce finché la Traduzione non la segue',
        ),
      ]),
    });
  });

  it('rejects a file the Workspace contract does not know', async () => {
    await expect(
      execFileAsync('node', [
        './scripts/content-check.mjs',
        '--posts',
        posts('valid'),
        '--workspace',
        workspace('incompatible'),
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('fact-check.md: file non previsto'),
    });
  });

  it('keeps the private Workspace out of the public-only check', async () => {
    const { stdout } = await execFileAsync('node', [
      './scripts/content-check.mjs',
      '--posts',
      posts('valid'),
      '--workspace',
      workspace('incompatible'),
      '--public-only',
    ]);

    expect(stdout).toContain('I Racconti pubblici rispettano il contratto v3.');
  });
});
