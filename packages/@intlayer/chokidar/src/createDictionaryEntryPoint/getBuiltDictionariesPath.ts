import { existsSync, mkdirSync } from 'node:fs';
import { getConfiguration, normalizePath } from '@intlayer/config';
import fg from 'fast-glob';

/**
 * This function generates a list of dictionaries in the main directory
 */
export const getBuiltDictionariesPath = (
  configuration = getConfiguration()
) => {
  const { dictionariesDir, mainDir } = configuration.content;

  // Create main directory if it doesn't exist
  if (!existsSync(mainDir)) {
    mkdirSync(mainDir, { recursive: true });
  }

  const dictionariesPath: string[] = fg.sync(
    `${normalizePath(dictionariesDir)}/**/*.json`
  );

  return dictionariesPath;
};
