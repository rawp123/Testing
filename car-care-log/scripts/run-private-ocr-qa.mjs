import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'tests/privateOcrQa.test.ts'], {
  env: {
    ...process.env,
    CAR_CARE_LOG_PRIVATE_OCR_QA: '1'
  },
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 1);
