const fs = require('fs');
const f1 = 'node_modules/@semantic-release/github/lib/publish.js';

fs.readFile(f1, 'utf8', (err, _data) => {
  if (err) {
    return console.log(err);
  }

  const result = `export default async function publish(pluginConfig, context, { Octokit }) {
    console.log("Disable publish of @semantic-release/github plugin");
}`;

  fs.writeFile(f1, result, 'utf8', e => {
    if (e) return console.log(e);
  });
});
