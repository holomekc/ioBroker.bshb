import {CommitParser} from 'conventional-commits-parser';

export function generateNotes(commits, logger, callback) {
  const parser = new CommitParser();

  let containsDeps = false;

  commits.filter(({message}) => message)
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
      callback(parsedCommit);
      return parsedCommit;
    });

  return containsDeps;
}
