# Task 1 Report: prompt() helper and select_sources()

## What was done

### Variable declarations (lines 17-19)
- Renamed `REPO` → `REPO_GITHUB` (GitHub URL)
- Renamed `REPO_MIRROR` → `REPO_GITEE` (Gitee URL)
- Added `REPO_URL=""` (set by `select_sources()` at runtime)

### New functions inserted after `SERVICE_NAME` (lines 24-94)
- **`prompt(env_var, message, default)`** — Interactive input helper.
  - Detects non-interactive mode (`! -t 0` or no `/dev/tty`).
  - In non-interactive mode: reads from the named environment variable; falls back to default if unset.
  - In interactive mode: prints prompt to `/dev/tty`, reads answer from `/dev/tty`.
  - Info messages ("[非交互] ...") go to stderr so `$(prompt ...)` captures only the single-line value.
- **`select_sources()`** — Interactive source selection.
  - Sets `REPO_URL` from user choice (GitHub vs Gitee).
  - Sets `NPM_REGISTRY` and `NPM_MIRROR_NODE` from user choice (official vs npmmirror).
  - Compatibility: `NPM_MIRROR` env var is checked first (old usage).

### `clone_repo()` updated (lines 119-133)
- `$REPO` → `$REPO_URL` (respects the user's source choice)
- `$REPO_MIRROR` → `$REPO_GITEE` (specific fallback)
- Added smart fallback: if primary is Gitee, fallback tries GitHub instead
- Updated log messages to be source-agnostic ("主源克隆失败，尝试备用源...")

### `deploy_app()` updated (line 203)
- `$REPO_MIRROR` → `$REPO_GITEE` in the git remote add fallback

## Self-review: brief compliance

| Requirement | Status |
|---|---|
| Split REPO into REPO_GITHUB, REPO_GITEE, REPO_URL | Done |
| Remove old REPO_MIRROR variable | Done |
| Insert prompt() after SERVICE_NAME, before download() | Done |
| Insert select_sources() immediately after prompt() | Done |
| prompt() outputs single line via stdout for `$(...)` capture | Done (info messages to stderr) |
| NPM_MIRROR env var backward compat | Done (checked in select_sources) |
| set -euo pipefail stays enabled | Not modified |
| curl | sudo bash single-command works | Variable names updated in all callers |

**Deviation from brief verbatim:** Brief's provided `prompt()` code had `echo "  [非交互] ..."` going to stdout, which would contaminate the `$(prompt ...)` captured value with multiple lines, breaking `select_sources()` (`case` would not match multi-line input). Fixed by redirecting info messages to `>&2`. This aligns with the brief's stated interface ("一行输出").

## Test results

```
$ bash -n deploy/install.sh
SYNTAX OK

$ prompt() default → [def] ✓
$ prompt() env var → [custom] ✓
$ select_sources() Gitee+mirror → REPO_URL=gitee, NPM_REGISTRY=npmmirror ✓
$ select_sources() GitHub+official → REPO_URL=github, NPM_REGISTRY=npmjs ✓
$ NPM_MIRROR compat → NPM_REGISTRY=npmmirror, NPM_MIRROR_NODE=true ✓
```

All tests pass with `2>/dev/null` suppressing error messages from script's root check.

## Concerns

- `select_sources()` is not yet wired into `main()`. The `REPO_URL` and `NPM_REGISTRY` globals are set but not used by the main flow (e.g. `install_node` still hardcodes nodesource). This is by design — later tasks will integrate them.
- The `prompt()` non-interactive check uses `[ ! -c /dev/tty ]` which may be overly strict in some CI environments where standard input is a pipe but `/dev/tty` exists. This matches the brief's provided code.
- Edge case: if `set -euo pipefail` is active and `read -r answer < /dev/tty` fails (e.g. EOF without newline), the script will exit. The brief's code does not handle this, so it's left as-is.
