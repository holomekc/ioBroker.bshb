import {readFile, writeFile} from 'fs/promises';
import {translateText} from './translate.js'
import {generateNotes} from '../commits.js';

function createNews(commits, logger) {
  let message = '';

  const containsDeps = generateNotes(commits, logger, parsedCommit => {
    if (parsedCommit.message.body) {
      message += `${parsedCommit.message.subject}\n${parsedCommit.message.body}\n`;
    } else {
      message += `${parsedCommit.message.subject}\n`;
    }
  });

  if (containsDeps) {
    message += 'Dependencies updated\n';
  }
  return message.slice(0, -1);
}

/**
 * Called by semantic-release during the prepare step
 * @param {*} pluginConfig The semantic-release plugin config
 * @param {*} context The context provided by semantic-release
 */
export async function prepare(pluginConfig, {commits, nextRelease, logger}) {
  if (pluginConfig.skip) {
    logger.log('Skip iobroker plugin due to skip = true');
    return;
  }

  // Read and parse the JSON file
  const ioPackageContent = await readFile('./io-package.json', 'utf8');
  const ioPackage = JSON.parse(ioPackageContent);

  // Update the version property
  ioPackage.common.version = nextRelease.version;

  const message = createNews(commits, logger);

  // Add the new news entry
  const newsTranslations = await translateText(message);

  ioPackage.common.news = ioPackage.common.news || {};
  ioPackage.common.news[nextRelease.version] = newsTranslations;

  // Keep only the 7 newest entries in news
  const sortedKeys = Object.keys(ioPackage.common.news).sort((a, b) => compareVersions(b, a)); // Newest first

  const limitedNews = {};
  for (let i = 0; i < Math.min(7, sortedKeys.length); i++) {
    const key = sortedKeys[i];
    limitedNews[key] = ioPackage.common.news[key];
  }
  ioPackage.common.news = limitedNews;

  // Convert back to JSON and write to the file
  const updatedPackage = JSON.stringify(ioPackage, null, 2); // Pretty-print with 2 spaces
  await writeFile('./io-package.json', updatedPackage, 'utf8');
}

// Utility function to compare semantic version numbers
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const part1 = v1Parts[i] || 0;
    const part2 = v2Parts[i] || 0;
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  return 0;
}
