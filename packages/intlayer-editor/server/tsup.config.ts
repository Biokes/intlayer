import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageBuildOptions } from '@utils/tsup-config';
import { defineConfig } from 'tsup';

const dir = __dirname ? __dirname : dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  packageBuildOptions.map((options) => ({
    ...options,
    outDir: `${dir}/dist`,
  }))
);
