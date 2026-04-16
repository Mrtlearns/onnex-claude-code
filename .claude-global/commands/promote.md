# /promote

Promote a POC to a full project with its own isolated GitLab repo.

## Instructions

1. Ask the user for the following if not already provided:
   - **POC path** (e.g. `D:\Code\projects\POC-sap-monitor`)
   - **New repo name** (e.g. `sap-monitor-v1`)
   - **Upgrade template?** — layer pro template over current POC? y/n
   - **Create GitLab repo?** y/n (requires GitLab access)

2. If upgrading template:
   - Copy pro template structure into POC folder
   - Do NOT overwrite existing work files
   - Only add missing template files (CLAUDE.md update, agents/, hooks/, etc.)
   - Report what was added vs skipped

3. If git not yet initialized in POC:
   ```bash
   cd [poc-path]
   git init
   git add .
   git commit -m "init: promoting POC to active project"
   ```

4. If creating GitLab repo:
   - Remind user to create repo at gitlab.botonomy.xyz first
   - Then:
   ```bash
   git remote add origin https://gitlab.botonomy.xyz/mrt/[repo-name].git
   git push -u origin main
   ```

5. Confirm completion with:
   - Final project path
   - GitLab repo URL
   - Template upgrade summary
   - Next step: run `/prime` in the promoted project

## Notes
- Promotion is non-destructive — existing POC work is always preserved
- Full git history from POC carries over to the new repo
- After promotion the project is fully isolated from the template
