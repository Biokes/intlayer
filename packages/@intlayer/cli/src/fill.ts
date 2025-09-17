import { AIOptions, getAiAPI, getOAuthAPI } from '@intlayer/api'; // Importing only getAiAPI for now
import {
  listGitFiles,
  ListGitFilesOptions,
  mergeDictionaries,
  prepareIntlayer,
  processPerLocaleDictionary,
  reduceDictionaryContent,
  writeContentDeclaration,
} from '@intlayer/chokidar';
import {
  ANSIColors,
  getAppLogger,
  getConfiguration,
  GetConfigurationOptions,
  type IntlayerConfig,
  Locales,
} from '@intlayer/config';
import {
  type AutoFill,
  type ContentNode,
  type Dictionary,
  getFilteredLocalesContent,
  getFilterTranslationsOnlyContent,
  getLocaleName,
  getLocalisedContent,
} from '@intlayer/core';
import dictionariesRecord from '@intlayer/dictionaries-entry';
import unmergedDictionariesRecord from '@intlayer/unmerged-dictionaries-entry';
import pLimit from 'p-limit';
import { basename, dirname, extname, join, relative } from 'path';
import { checkAIAccess } from './utils/checkAIAccess';

const NB_CONCURRENT_TRANSLATIONS = 5;

// Arguments for the fill function
export type FillOptions = {
  sourceLocale?: Locales;
  outputLocales?: Locales | Locales[];
  file?: string | string[];
  mode?: 'complete' | 'review';
  keys?: string | string[];
  excludedKeys?: string | string[];
  filter?: (entry: Dictionary) => boolean; // DictionaryEntry needs to be defined
  pathFilter?: string | string[];
  gitOptions?: ListGitFilesOptions;
  configOptions?: GetConfigurationOptions;
  aiOptions?: AIOptions; // Added aiOptions to be passed to translateJSON
  verbose?: boolean;
  nbConcurrentTranslations?: number;
  build?: boolean;
};

const ensureArray = <T>(value: T | T[]): T[] => [value].flat() as T[];

const getTargetDictionary = async (options: FillOptions) => {
  const configuration = getConfiguration(options.configOptions);

  const { baseDir } = configuration.content;

  let result = Object.values(unmergedDictionariesRecord).flat();

  // 1. if filePath not defined, list all content declaration files based on unmerged dictionaries list
  if (typeof options.file !== 'undefined') {
    const fileArray = ensureArray(options.file);
    const absoluteFilePaths = fileArray.map((file) => join(baseDir, file));

    result = result.filter(
      (dict) =>
        dict.filePath &&
        (absoluteFilePaths.includes(dict.filePath) ||
          absoluteFilePaths.includes(join(baseDir, dict.filePath)))
    );
  }

  if (typeof options.keys !== 'undefined') {
    result = result.filter((dict) =>
      ensureArray(options.keys)?.includes(dict.key)
    );
  }

  if (typeof options.excludedKeys !== 'undefined') {
    result = result.filter(
      (dict) => !ensureArray(options.excludedKeys)?.includes(dict.key)
    );
  }

  if (typeof options.pathFilter !== 'undefined') {
    result = result.filter((dict) =>
      ensureArray(options.pathFilter)?.includes(dict.filePath ?? '')
    );
  }

  if (typeof options.filter !== 'undefined') {
    result = result.filter(options.filter);
  }

  const gitOptions = options.gitOptions;
  if (gitOptions) {
    const gitChangedFiles = await listGitFiles(gitOptions);

    if (gitChangedFiles) {
      // Convert dictionary file paths to be relative to git root for comparison

      // Filter dictionaries based on git changed files
      result = result.filter((dict) => {
        if (!dict.filePath) return false;

        return gitChangedFiles.some((gitFile) => dict.filePath === gitFile);
      });
    }
  }

  return result.filter((dict) => !dict.autoFilled);
};

const transformUriToAbsolutePath = (
  uri: string,
  filePath: string,
  baseDir: string
) => {
  if (uri.startsWith('/')) {
    return join(baseDir, uri);
  }

  if (uri.startsWith('./')) {
    return join(dirname(filePath), uri);
  }

  return filePath;
};

export type AutoFillData = {
  localeList: Locales[];
  filePath: string;
  isPerLocale: boolean;
};

const formatAutoFilledFilePath = (
  autoFillField: string,
  dictionaryKey: string,
  dictionaryFilePath: string,
  baseDir: string,
  locale?: Locales
) => {
  // transform `/src/components/home/index.content.json` to `index`
  // transform `./test.content.tsx` to `test`
  const fileName = basename(dictionaryFilePath)
    .split('.')
    .slice(0, -2) // Remove last 2 extensions (.content.tsx)
    .join('.');

  let result: string = autoFillField
    .replace('{{key}}', dictionaryKey)
    .replace('{{fileName}}', fileName);

  if (locale) {
    result = result.replace('{{locale}}', locale);
  }

  return transformUriToAbsolutePath(result, dictionaryFilePath, baseDir);
};

const formatAutoFillData = (
  autoFillField: AutoFill,
  localeList: Locales[],
  filePath: string,
  dictionaryKey: string,
  configuration: IntlayerConfig
): AutoFillData[] => {
  const outputContentDeclarationFile: AutoFillData[] = [];

  const baseDir = configuration.content.baseDir;

  if (!Boolean(autoFillField)) return outputContentDeclarationFile;

  if (autoFillField === true) {
    // wanted jsonFilePath: /..../src/components/home/index.content.json
    // replace file extension in json
    let jsonFilePath = filePath.replace(extname(filePath), '.json');

    // if both filePath jsonFilePath are same path, change it as : /..../src/components/home/index.fill.content.json
    if (filePath === jsonFilePath) {
      jsonFilePath = jsonFilePath.replace(extname(jsonFilePath), '.fill.json');
    }

    outputContentDeclarationFile.push({
      localeList,
      filePath: jsonFilePath,
      isPerLocale: false,
    });
  }

  if (typeof autoFillField === 'string') {
    if (autoFillField.includes('{{locale}}')) {
      const output = localeList.map((locale) => {
        const formattedFilePath = formatAutoFilledFilePath(
          autoFillField,
          dictionaryKey,
          filePath,
          baseDir,
          locale
        );

        return {
          localeList: [locale],
          filePath: formattedFilePath,
          isPerLocale: true,
        };
      });

      outputContentDeclarationFile.push(...output);
    } else {
      const formattedFilePath = formatAutoFilledFilePath(
        autoFillField,
        dictionaryKey,
        filePath,
        baseDir
      );

      outputContentDeclarationFile.push({
        localeList,
        filePath: formattedFilePath,
        isPerLocale: false,
      });
    }

    return outputContentDeclarationFile;
  }

  if (typeof autoFillField === 'object') {
    const localeList = Object.keys(autoFillField).filter(
      (locale) => typeof autoFillField[locale] === 'string'
    ) as Locales[];

    const output: AutoFillData[] = localeList
      .filter((locale) => Boolean(autoFillField[locale]))
      .map((locale) => {
        const formattedFilePath = formatAutoFilledFilePath(
          autoFillField[locale],
          dictionaryKey,
          filePath,
          baseDir,
          locale
        );

        return {
          localeList: [locale],
          filePath: formattedFilePath,
          isPerLocale: true,
        };
      });

    // Group by filePath and merge localeList
    const groupedByFilePath = output.reduce((acc, curr) => {
      const existing = acc.find((item) => item.filePath === curr.filePath);
      if (existing) {
        existing.localeList.push(...curr.localeList);
      } else {
        acc.push(curr);
      }
      return acc;
    }, [] as AutoFillData[]);

    outputContentDeclarationFile.push(...groupedByFilePath);
  }

  return outputContentDeclarationFile;
};

const autoFill = async (
  fullDictionary: Dictionary,
  contentDeclarationFile: Dictionary,
  autoFillOptions: AutoFill,
  outputLocales: Locales[],
  parentLocales: Locales[],
  configuration: IntlayerConfig
) => {
  const appLogger = getAppLogger(configuration);
  let localeList: Locales[] = (
    outputLocales ?? configuration.internationalization.locales
  ).filter((locale) => !parentLocales?.includes(locale));

  const filePath = contentDeclarationFile.filePath;

  if (!filePath) {
    appLogger('No file path found for dictionary', {
      level: 'error',
    });
    return;
  }

  const autoFillData: AutoFillData[] = formatAutoFillData(
    autoFillOptions,
    localeList,
    filePath,
    fullDictionary.key,
    configuration
  );

  for await (const output of autoFillData) {
    const reducedDictionary = reduceDictionaryContent(
      fullDictionary,
      contentDeclarationFile
    );

    if (output.isPerLocale) {
      const sourceLocale = output.localeList[0];

      const sourceLocaleContent = getLocalisedContent(
        reducedDictionary as unknown as ContentNode,
        sourceLocale,
        { dictionaryKey: reducedDictionary.key, keyPath: [] }
      );

      await writeContentDeclaration({
        ...fullDictionary,
        locale: sourceLocale,
        autoFilled: true,
        autoFill: undefined,
        content: sourceLocaleContent.content,
        filePath: output.filePath,
      });
    } else {
      const content = getFilteredLocalesContent(
        reducedDictionary.content as unknown as ContentNode,
        output.localeList,
        { dictionaryKey: reducedDictionary.key, keyPath: [] }
      );

      // write file
      await writeContentDeclaration({
        ...fullDictionary,
        autoFilled: true,
        autoFill: undefined,
        content,
        filePath: output.filePath,
      });
    }
  }
};

/**
 * Fill translations based on the provided options.
 */
export const fill = async (options: FillOptions): Promise<void> => {
  const configuration = getConfiguration(options.configOptions);
  const appLogger = getAppLogger(configuration);

  if (options.build) {
    await prepareIntlayer(configuration);
  }

  const { defaultLocale, locales } = configuration.internationalization;
  const mode = options.mode ?? 'review';
  const baseLocale = options.sourceLocale ?? defaultLocale;

  checkAIAccess(configuration, options.aiOptions);

  let oAuth2AccessToken: string | undefined;
  if (configuration.editor.clientId) {
    const intlayerAuthAPI = getOAuthAPI(configuration);
    const oAuth2TokenResult = await intlayerAuthAPI.getOAuth2AccessToken();

    oAuth2AccessToken = oAuth2TokenResult.data?.accessToken;
  }

  appLogger('Starting fill function', {
    level: 'info',
  });

  const targetUnmergedDictionaries = await getTargetDictionary(options);

  // Determine output locales
  const outputLocalesList: Locales[] = (
    options.outputLocales ? ensureArray(options.outputLocales) : locales
  ).filter((locale) =>
    // If mode is review, translate all locales
    // If mode is complete, translate only the locales that are not the source locale
    mode === 'review' ? true : locale !== baseLocale
  );

  const affectedDictionaryKeys = new Set<string>();
  targetUnmergedDictionaries.forEach((dict) => {
    affectedDictionaryKeys.add(dict.key);
  });

  appLogger(
    [
      'Affected dictionary keys for processing:',
      Array.from(affectedDictionaryKeys)
        .map((key) => `${ANSIColors.GREY}${key}${ANSIColors.RESET}`)
        .join(', '),
    ],
    {
      isVerbose: true,
    }
  );

  for (const targetUnmergedDictionary of targetUnmergedDictionaries) {
    const dictionaryKey = targetUnmergedDictionary.key;
    const mainDictionaryToProcess = dictionariesRecord[dictionaryKey];
    const sourceLocale: Locales =
      (targetUnmergedDictionary.locale as Locales) ?? baseLocale;

    if (!mainDictionaryToProcess) {
      appLogger(
        `Dictionary with key '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' not found in dictionariesRecord. Skipping.`,
        {
          level: 'warn',
        }
      );
      continue;
    }

    if (!targetUnmergedDictionary.filePath) {
      appLogger(
        `Dictionary with key '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' has no file path. Skipping.`,
        {
          level: 'warn',
        }
      );
      continue;
    }

    const relativePath = relative(
      configuration.content.baseDir,
      targetUnmergedDictionary.filePath
    );

    appLogger(
      `Processing content declaration: ${ANSIColors.GREY}${relativePath}${ANSIColors.RESET}`,
      {
        level: 'info',
      }
    );

    const sourceLocaleContent = getFilterTranslationsOnlyContent(
      mainDictionaryToProcess as unknown as ContentNode,
      sourceLocale,
      { dictionaryKey, keyPath: [] }
    );

    if (Object.keys(sourceLocaleContent).length === 0) {
      appLogger(
        `No content found for dictionary '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' in source locale ${sourceLocale}. Skipping translation for this dictionary.`,
        {
          level: 'warn',
        }
      );
      continue;
    }

    const result: Dictionary[] = [];

    // 5. for each locale to translate (exclude base locale) generate json translations
    // Limit concurrent translations to 5 at a time
    const limit = pLimit(
      options.nbConcurrentTranslations ?? NB_CONCURRENT_TRANSLATIONS
    );

    const translationPromises = outputLocalesList.map((targetLocale) =>
      limit(async () => {
        appLogger(
          `Preparing translation for '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' dictionary from ${getLocaleName(
            sourceLocale,
            Locales.ENGLISH
          )} (${sourceLocale}) to ${getLocaleName(targetLocale, Locales.ENGLISH)} (${targetLocale})`,
          {
            level: 'info',
          }
        );

        const presetOutputContent = getLocalisedContent(
          mainDictionaryToProcess as unknown as ContentNode,
          targetLocale,
          { dictionaryKey, keyPath: [] }
        );

        try {
          const translationResult = await getAiAPI(
            undefined,
            configuration
          ).translateJSON(
            {
              entryFileContent: sourceLocaleContent.content, // Should be JSON, ensure getLocalisedContent provides this.
              presetOutputContent: presetOutputContent.content, // Should be JSON
              dictionaryDescription: mainDictionaryToProcess.description,
              entryLocale: sourceLocale,
              outputLocale: targetLocale,
              mode,
              aiOptions: options.aiOptions,
            },
            {
              ...(oAuth2AccessToken && {
                headers: {
                  Authorization: `Bearer ${oAuth2AccessToken}`,
                },
              }),
            }
          );

          if (!translationResult.data?.fileContent) {
            appLogger(
              `No content result found for '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' to ${targetLocale}`,
              {
                level: 'error',
              }
            );
            return null;
          }

          const processedPerLocaleDictionary = processPerLocaleDictionary({
            ...mainDictionaryToProcess,
            content: translationResult.data?.fileContent,
            locale: targetLocale,
          });

          return processedPerLocaleDictionary;
        } catch (error) {
          appLogger(
            `Error filling '${ANSIColors.GREY}${dictionaryKey}${ANSIColors.RESET}' to ${targetLocale}:` +
              error,
            {
              level: 'error',
            }
          );
          return null;
        }
      })
    );

    // Wait for all translations to complete
    const translationResults = await Promise.all(translationPromises);

    // Filter out null results and add to result array
    translationResults.forEach((translationResult) => {
      if (translationResult) {
        result.push(translationResult);
      }
    });

    const dictionaryToMerge =
      mode === 'review'
        ? [...result, mainDictionaryToProcess] // Mode review: generated content will override the base one
        : [mainDictionaryToProcess, ...result]; // Mode complete: base content will override the generated one

    const mergedResults = mergeDictionaries(dictionaryToMerge);

    let formattedDict = targetUnmergedDictionary;

    if (formattedDict.locale) {
      const presetOutputContent = getLocalisedContent(
        mainDictionaryToProcess as unknown as ContentNode,
        formattedDict.locale,
        { dictionaryKey, keyPath: [] }
      );

      formattedDict = {
        ...formattedDict,
        content: presetOutputContent.content,
      };
    }

    const reducedResult = reduceDictionaryContent(mergedResults, formattedDict);

    if (formattedDict.autoFill) {
      await autoFill(
        mergedResults,
        targetUnmergedDictionary,
        formattedDict.autoFill,
        outputLocalesList,
        [sourceLocale],
        configuration
      );
    } else {
      await writeContentDeclaration(
        { ...formattedDict, content: reducedResult.content },
        configuration,
        formattedDict.filePath
      );
    }
  }
};
