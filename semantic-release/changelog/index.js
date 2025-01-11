import {CommitParser} from 'conventional-commits-parser';
import {readFile, writeFile} from 'fs/promises';

let verified = true;

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
    const parser = new CommitParser();

    let message = `## ${nextRelease.version}\n\n`;

    let containsDeps = false;

    commits.filter(({message}) => message.trim())
        .map(commit => ({
            commit: commit,
            message: parser.parse(commit.message)
        }))
        .filter(parsedCommit => {
            if (parsedCommit.message.type === 'chore' && parsedCommit.message.scope === 'deps') {
                containsDeps = true;
            }
            return parsedCommit.message.type === 'feat' || parsedCommit.message.type === 'fix';
        })
        .map(parsedCommit => {
            message += `* (${parsedCommit.commit.author.name}) ${parsedCommit.message.subject}`;
            return parsedCommit;
        });

    if (containsDeps) {
        message += '* Update dependencies';
    }

    message += '\n';

    const readmeContent = (await readFile('./README.md')).toString().trim();
    const changelogOldContent = (await readFile('./CHANGELOG_OLD.md')).toString().trim();

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

    // Keep only the "### Older entries" and everything after it in README.md
    const updatedReadme = `${beforeChangelog}\n\n${message}\n${afterOlderEntries.trim()}`;

    // Add the extracted changelog entries to the top of CHANGELOG_OLD.md
    const updatedChangelogOld = `${changelogSection.trim()}\n\n${changelogOldContent}`;

    // Write the updated README.md and CHANGELOG_OLD.md files
    await writeFile('./README.md', updatedReadme, 'utf8');
    await writeFile('./CHANGELOG_OLD.md', updatedChangelogOld, 'utf8');


    // Ignore the error. This is for testing purposes
    throw Error('test');
}
