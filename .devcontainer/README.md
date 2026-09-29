# Devcontainer

How credentials reach this container, what survives a rebuild, and what deploy tooling can do
from inside it. For getting the app running, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Host requirements

- **Docker** with Compose **2.24 or later** — the optional `env_file` entries need it.
- **VS Code** with the **Dev Containers** extension.
- **A GitHub token scoped to this repository** — optional, for `gh` inside the container: a
  fine-grained personal access token with only this repository selected and an expiry. The
  container never inherits the host's own `gh` login.
- **An SSH agent with your key loaded** — only for `git push` over SSH. `ssh-add -l` on the host
  should list it.

## What the container inherits

| Credential | How it arrives | Survives a rebuild? |
|---|---|---|
| `git push` / `git pull` over SSH | VS Code forwards the host's SSH agent (`SSH_AUTH_SOCK`) | Yes |
| `gh` CLI | Not inherited. You log it in from the host with the scoped token (First open, step 3) | **No** — log in again after a rebuild |
| `GITHUB_REPOSITORY`, `GITHUB_REPOSITORY_OWNER`, `GITHUB_ACTOR` | `initialize.sh` derives them from the `origin` remote | Yes |
| Git author name and email | VS Code copies the host's `~/.gitconfig` | Yes |
| AI coding agents (Claude Code, Codex…) | Not part of this devcontainer: install and log in the one you use, from the host or inside | Only if its home is kept outside the container layer |
| LLM provider keys for `npm run compare` | Not inherited: the repo's `.env`, which you write (see CONTRIBUTING.md) | Yes — it lives in the repo folder |

`initializeCommand` runs `initialize.sh` **on the host** before every start. It writes
`.devcontainer/.host.env` (mode 600, gitignored) with no credential in it, and always exits 0,
so a host without `git` still opens the container. Compose loads `.host.env` and then an optional
`local.env` as environment files; a variable set in `local.env` wins.

Environment files are read when the container is **created**. Reopening an existing container
keeps the old values; **Dev Containers: Rebuild Container** picks up new ones.

`node_modules` lives in a named volume, not in the repo folder: the container installs Linux
binaries (oxlint, Vite's bundler, Tailwind) that would break the host's copy, and the host's would
break the container's. Each side keeps its own.

## First open

1. On the host, optionally: `ssh-add` your key.
2. Open the folder in VS Code and run **Dev Containers: Reopen in Container**. `post-create.sh`
   runs `npm ci` on first creation.
3. For `gh`, on the host, from this folder, with the scoped token in `$TOKEN`:
   ```bash
   printf '%s\n' "$TOKEN" | docker exec -i -u vscode \
     "$(docker ps -q --filter label=devcontainer.local_folder="$PWD")" \
     gh auth login -h github.com --with-token
   ```
   The token goes through stdin, never an argument or an environment variable. A rebuild drops the
   login; run it again.
4. Check, in a container terminal:
   ```bash
   gh auth status          # logged in, after step 3
   env | grep ^GITHUB_     # the three derived values
   npm run dev             # port 5173, forwarded by VS Code
   ```

## Deploy tooling from the container

This repo has no deploy tooling: GitHub Actions builds and publishes it to GitHub Pages.

## Security model

- **The devcontainer's own files carry no credential.** `.host.env` holds only the three
  `GITHUB_*` values; nothing in `devcontainer.json` or Compose holds a token.
- **The token you log `gh` in with is the whole exposure.** `gh` stores it in plain text in
  `~/.config/gh/hosts.yml`, since the container has no keyring, and every process in the
  container can read it — extensions, AI agents, package install scripts. Scoped to this one
  repository and with an expiry, a leak reaches this repository for a limited time and nothing
  else: not your other repositories, not private ones, not your account.
- **Never pass it as `GH_TOKEN`** in `local.env` or the Compose environment: an environment
  variable beats the stored login, shows up in `docker inspect`, and survives in the container's
  configuration.
- **The same applies to `.env`.** The repo folder is mounted, so any key you put in `.env` for
  `npm run compare` is readable by every process in the container.
- **GitHub Projects owned by a user account are out of reach for fine-grained tokens.** If you
  work a board from here, use a separate classic token with only `project`, `read:org` and
  `read:discussion` for it, never a wider one.
- **On Windows**, `initializeCommand` runs under `cmd.exe`. With Git for Windows' `sh` on the
  `PATH` it behaves as above; without it the command falls through, no `.host.env` is written,
  and the `GITHUB_*` values have to go in `local.env`. Untested on Windows. Under WSL it is Linux.
- **In Codespaces**, Codespaces provides its own `GITHUB_TOKEN`; step 3 is not needed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `gh` asks you to log in | The container was rebuilt, or step 3 of First open never ran | Step 3, on the host |
| `gh` answers `Bad credentials`, or 403/404 on another repository | The token expired — or it is scoped to this repository, by design | A new token; another repository gets its own |
| `npm ci` fails with `EACCES` on `node_modules` | The volume is root-owned and the `chown` in `post-create.sh` did not run | `sudo chown vscode:vscode node_modules && npm ci` |
| `ssh-add -l` says it cannot connect to the agent, or SSH fails with `Permission denied (publickey)` | The agent is forwarded only to processes VS Code starts; `docker exec` and outside terminals have no `SSH_AUTH_SOCK`, and the host agent may hold no key | Use a VS Code terminal; on the host, `ssh-add` your key |
