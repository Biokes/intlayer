import { readFileSync } from 'node:fs';
import { dirname as pathDirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isESModule } from '@intlayer/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const dirname = isESModule
  ? pathDirname(fileURLToPath(import.meta.url))
  : __dirname;

const packageJson = JSON.parse(
  readFileSync(resolve(dirname, '../../../package.json'), 'utf8')
);

export const loadClient = () =>
  new Client({
    name: `mcp-client-for-intlayer-mcp-server`,
    version: packageJson.version,
  });
