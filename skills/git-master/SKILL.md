---
name: git-master
description: "MUST USE whenever a task needs a commit or git-history investigation. Covers atomic commits, staging, commit-message style, rebase, squash, fixup/autosquash, blame, bisect, reflog, git log -S/-G, and questions like who wrote this or when was this added. Do not use for ordinary code edits unless the user asks for git work."
---

# Git Master

Use this skill when the user asks you to operate on Git history or answer a Git-history question. Be exact, conservative, and evidence-led. Read the repository state before you infer anything.

## Mode Gate

Classify the request first:

- `COMMIT`: stage and commit local changes.
- `REBASE`: rebase, squash, fixup, autosquash, reorder, split, or otherwise rewrite branch history.
- `HISTORY`: answer when, where, who, why, or which commit changed something.
- `STATUS`: inspect branch, diff, or working-tree state without changing it.

Do not commit, rebase, push, force-push, reset, stash-pop, or delete anything unless the user explicitly asked for that operation. If the request is only investigative, report findings and stop.

## Ground Truth

Gather independent facts in parallel when the tools allow it:

```bash
git status --short
git diff --stat
git diff --staged --stat
git branch --show-current
git log -30 --oneline
git log -30 --pretty=format:%s
git rev-parse --abbrev-ref @{upstream}
git merge-base HEAD origin/main
git merge-base HEAD origin/master
```

Missing upstream or missing `main`/`master` is normal. Fall back to the best available branch or report the missing fact. Never treat a failed lookup as proof.

## PR Body Evidence Attachments

When a PR body needs screenshots or terminal PNGs, use GitHub user attachments (`https://github.com/user-attachments/assets/...`) from the authenticated web attachment flow; never commit temporary images, never use GitHub Releases for PR evidence, and never use external image hosts. Do not log browser cookies, CSRF tokens, S3 form fields, or upload headers.

## PR Readiness Gate

Run this before opening a PR or calling a branch "ready for review". Each item is a command whose output you read, not a belief. Field reports on Gemini 4 Argon (2026-10) describe PRs that ignored failing CI and lint, ignored review-bot comments, duplicated an already-open PR, skipped the repo's own skill files, and turned a ~30-line fix into ~1,200 lines; this gate exists to catch exactly those.

1. **Repo conventions read**: list the `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `CONTRIBUTING*` / matching `skills/*/SKILL.md` you read. If none were read this session, read them now.
2. **Local CI parity**: run the repo's lint, typecheck, and test commands as defined in its CI workflow (`.github/workflows/*`) or package scripts. A red command blocks the gate.
3. **Duplicate work**: `gh pr list --state open --search "<key terms>"` and `gh pr list --state open --author @me`. If an open PR covers the same change, stop and report it.
4. **Existing feedback**: on an existing PR, `gh pr view <n> --comments` and `gh pr checks <n>`; every review-bot and human comment is either addressed in the diff or answered.
5. **Proportionality**: `git diff --stat <base>...HEAD`. When the diff is more than ~3× the size the request implies, list what is outside the request and remove it or ask before keeping it.

Report the five results in ≤10 lines. Any failing item means the PR is not ready.

## Commit Mode

Commit only the user's requested changes. Preserve unrelated dirty work.

1. Detect message style from recent history. Use the dominant local pattern, language, and casing. Do not default to Conventional Commits unless the repo uses them.
2. Inspect the full diff, not only filenames. Separate unrelated user edits from the requested commit.
3. Build atomic groups by behavior, module, and revertability. Keep implementation and its direct tests together.
4. Prefer multiple commits for unrelated concerns. A single commit is acceptable only when the changed files form one indivisible behavior or the user explicitly asks for one commit.
5. Stage by path or hunk so each commit contains only its atomic group.
6. Before each commit, verify `git diff --staged --stat` and enough staged diff to prove the group is right.
7. Commit with the detected style. After each commit, verify `git log -1 --oneline`.

Grouping rules:

- Split different features, modules, generated artifacts, config, docs, and test-only changes unless they are inseparable.
- Keep generated files with the source change that produced them when omitting them would leave the repo inconsistent.
- Never hide failing or unrelated changes inside a broad commit.

Final report: list commit hashes, messages, and any remaining uncommitted files.

## Rebase Mode

History rewriting is a shared-impact operation.

- Never rebase or rewrite `main`, `master`, `dev`, release branches, or a protected branch unless the user explicitly named that exact operation.
- If commits may already be pushed, ask before force-pushing. Use `--force-with-lease`, never plain `--force`.
- If the worktree is dirty, preserve it intentionally before rebasing. Do not stash-pop over conflicts without checking what changed.
- For fixups, prefer `git commit --fixup=<hash>` followed by `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <base>`.
- For conflicts, read the conflicting files and resolve by intent. Do not choose ours/theirs blindly.
- If a rebase goes wrong, use `git rebase --abort` first. Use reflog only after explaining the recovery path.

After rewriting, run the relevant tests or at least the project's cheapest smoke check, then show the new branch log from base to HEAD.

## History Mode

Choose the Git tool by the question:

- `git log -S "text"`: when the count of an exact string changed.
- `git log -G "regex"`: when diffs touched lines matching a pattern.
- `git blame -L start,end -- file`: who last changed specific lines.
- `git log --follow -- file`: history across renames for one file.
- `git show <hash>`: inspect the commit that appears relevant.
- `git bisect`: find the first bad commit when there is a deterministic pass/fail command and known good/bad bounds.
- `git reflog`: recover or explain recent local history movement.

Always cite the exact command evidence in the answer: commit hash, subject, file path, and line or diff context when relevant. If the evidence is ambiguous, say what remains unproven.

## Safety Checks

Before any write to Git history:

- Current branch is known.
- Dirty work is accounted for.
- Upstream/pushed status is known or explicitly unknown.
- The operation matches the user's request.
- Recovery path is known (`rebase --abort`, reflog hash, or untouched worktree).

Before finishing:

- Run the most relevant verification available for the changed behavior or history operation.
- Report commands that passed and any command you could not run.
- Leave the worktree state explicit.
