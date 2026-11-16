---
name: no-comments
description: "Delete narration, stale justifications and commented-out code in a diff with a comment-hating reviewer subagent, fix the workarounds it flags, and turn real constraints into checks. Use for /no-comments, 주석 정리, or before a PR."
---

# No comments

Comments go stale, nobody reads them, and an agent's comment is usually an excuse for a workaround. A rule the code must follow belongs in a type, a test or a lint, not in prose. This skill deletes the prose and fixes what it was excusing. Adapted from pstack (Lauren Tan, MIT), see the plugin NOTICE.

## Scope

Use the files or diff the user names. Otherwise use the current diff against the base branch (`main`), including the working tree.

## Steps

1. Spawn one reviewer with `invoke_subagent({ TypeName: "self", Role: "comment-sicko", Model: "inherit", Prompt })`. The prompt is the full text of [references/comment-sicko.md](references/comment-sicko.md) followed by the scope (file list or the diff command). The reviewer edits comments only and reports `MUST KILL` flags for code; it never writes application code.
2. Read its report and the diff. Reject edits to application code, edits outside the scope, deletions of protected comments (license headers, public API doc comments, rules set by a dependency, platform, vendor or protocol), and flags that treat intentional code as guilty. A `HOLD` that names an outside rule and where to check it stays in place and is reported open. Restore any comment stating an outside rule unless the report cites the page or source file that refutes it. After two rejected rounds, revert the rejected findings and continue with the accepted ones.
3. Fix trivial accepted flags directly: delete the dead path, drop the unused parameter, call the real API.
4. For a flag that needs a real fix, implement the smallest root-cause fix inside the scope and remove the workaround it named (see the `encode-lessons` skill). If the root cause is outside the scope, land the smallest in-scope fix and report the rest open. Never add a symptom guard.
5. Constraint comments (`do not remove`, `do not change wording`, `talk to X before changing`): keep the ones about things we cannot change. For the rest, offer the cheapest in-scope enforcement (type, runtime assertion, test, CI lint) and wait for the user's go before writing it; once encoded, delete the comment. Without approval, keep the comment and report the constraint as unenforced: deleting it would leave the knowledge nowhere.
6. Run the repo's checks (lint, typecheck, tests) and report: deletions, restored comments, `HOLD` comments, rounds, fixes, encodings offered and written, constraints left unenforced, other open work.
