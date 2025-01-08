# Custom semantic-release plugin

ioBroker has some expectations regarding how an adapter repo should look like.
This sadly cannot allways be satisfied with the typical approaches of conventional-commits
and semantic release.

To overcome this some additional plugins are necessary so that we can create the

# changelog

- Uses conventional commits and updates the README.md and CHANGELOG_OLD.md
- Excludes the type and scope and only uses the subject as content
- chore(deps) commits subjects are not used but just "Update dependencies"

  This is applied only once
