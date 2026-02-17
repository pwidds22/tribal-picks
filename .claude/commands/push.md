---
name: push
description: Commit all changes and push to git (also updates _SESSION.md)
---

# Push Command

Update session notes, commit all changes, then push to the remote repository.

## Steps

1. Run `git status` to see what changed
2. Run `git diff --name-only` to list modified files
3. **Update `_SESSION.md`** with what was completed:
   - Add completed tasks to "Completed This Session"
   - List key files modified
   - Note any next steps if obvious
   - Keep it brief but informative for future sessions
4. Run `git add -A` to stage all changes (including _SESSION.md)
5. Create a commit with a descriptive message summarizing the changes
6. Run `git push` to push to the remote
7. Report the commit hash and push status

## Commit Message Guidelines

- Use imperative mood ("Add feature" not "Added feature")
- First line: brief summary (50 chars or less)
- Body: explain what and why (not how)
- Always include: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Example

```bash
git add -A
git commit -m "Add Elimination Bracket game type

- Implement bracket picker UI with drag-to-reorder
- Add scoring logic for position accuracy
- Lock picks at season premiere time

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```
