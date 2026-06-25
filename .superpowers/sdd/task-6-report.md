# Task 6: Fix 2 critical issues in deploy/install.sh

## Changes Made

### Fix 1: Ctrl+D crash in `prompt()` function
**File:** `deploy/install.sh` (line 55)
**Issue:** Under `set -e`, pressing Ctrl+D causes `read -r answer < /dev/tty` to return exit code 1, crashing the subshell.
**Fix:** Added `|| true` to suppress the error:
```bash
read -r answer < /dev/tty || true
```

### Fix 2: Stale remote URL in `deploy_app()` update path
**File:** `deploy/install.sh` (line 237)
**Issue:** When updating an existing install (`[ -d "$INSTALL_DIR/.git" ]` is true), `git pull` always pulls from the old origin, ignoring a different repo source chosen by the user in `select_sources()`.
**Fix:** Added `git remote set-url origin "$REPO_URL"` before `git pull`:
```bash
cd "$INSTALL_DIR"
git remote set-url origin "$REPO_URL"
git pull origin main 2>/dev/null || \
    warn "更新失败，继续使用当前版本"
```

## Verification
- `bash -n deploy/install.sh` passes (no syntax errors).

## Commit
`fix(install): handle read EOF and remote URL in update path`
