import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './apps/api/vitest.config.ts',
    test: { name: 'api', root: './apps/api' },
  },
  {
    extends: './apps/dashboard/vitest.config.ts',
    test: { name: 'dashboard', root: './apps/dashboard' },
  },
])
