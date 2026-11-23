import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Other sessions may keep git worktrees under .claude/; their tests are
    // not this checkout's tests.
    exclude: [...configDefaults.exclude, '.claude/**', 'content/**'],
  },
});
