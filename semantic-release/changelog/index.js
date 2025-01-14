import {readFile, writeFile} from 'fs/promises';
import {generateNotes} from '../commits.js';

/**
 * Called by semantic-release during the prepare step
 * @param {*} pluginConfig The semantic-release plugin config
 * @param {*} context The context provided by semantic-release
 */
export async function prepare(pluginConfig, {commits, nextRelease, logger}) {
  if (pluginConfig.skip) {
    logger.log('Skip changelog plugin due to skip = true');
    return;
  }

  let message = `## ${nextRelease.version}\n\n`;

  const containsDeps = generateNotes(commits, logger, parsedCommit => {
    if (parsedCommit.message.body) {
      message += `* (${parsedCommit.commit.author.name}) ${parsedCommit.message.subject}

  ${parsedCommit.message.body}
`;
    } else {
      message += `* (${parsedCommit.commit.author.name}) ${parsedCommit.message.subject}\n`;
    }
  });

  if (containsDeps) {
    message += '* Dependencies updated\n';
  }
  message += '\n'

  const readmeContent = (await readFile('./README.md')).toString();
  const changelogOldContent = (await readFile('./CHANGELOG_OLD.md')).toString();

  const changelogMarker = '## Changelog';
  const olderEntriesMarker = '### Older entries';

  const changelogIndex = readmeContent.indexOf(changelogMarker);
  const olderEntriesIndex = readmeContent.indexOf(olderEntriesMarker);

  if (changelogIndex === -1 || olderEntriesIndex === -1) {
    throw new Error('Required markers not found in README.md');
  }

  const beforeChangelog = readmeContent.slice(0, changelogIndex + changelogMarker.length);
  const changelogSection = readmeContent.slice(
    changelogIndex + changelogMarker.length,
    olderEntriesIndex
  );
  const afterOlderEntries = readmeContent.slice(olderEntriesIndex);

  // Extract complete entries based on headers (### markers)
  const versionEntries = changelogSection
    .split(/(?=^### )/m) // Split strictly at "### " headers
    .filter(entry => entry.includes('###'));

  logger.log(versionEntries);

  // Insert the new version at the beginning
  const recentEntries = [ message, ...versionEntries.slice(0, 6) ].join('');

  // Prepare the updated README.md
  const updatedReadme = `${beforeChangelog}\n\n${recentEntries}${afterOlderEntries}`;

  // Move older entries to CHANGELOG_OLD.md
  const outdatedEntries = versionEntries.slice(6).join('');
  const updatedChangelogOld = `${outdatedEntries}${changelogOldContent}`;

  // Write the updated files
  await writeFile('./README.md', updatedReadme, 'utf8');
  await writeFile('./CHANGELOG_OLD.md', updatedChangelogOld, 'utf8');
}
