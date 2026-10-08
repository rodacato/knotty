# Scripts

Tools that run from the terminal, outside the app. Each folder has its own README.

| Folder | Command | What it is for | Calls a provider |
|---|---|---|---|
| [compare/](compare/README.md) | `npm run compare`, `compare:*` | Grades the expert on the bench's fixed cases and on the hard questions | Yes, except `replay`, `promote` and `hard -- --list` |
| [autonomy/](autonomy/README.md) | `npm run autonomy` | How much of what a person asks the chat reads without the expert | Only with `--ask` |
| [probe/](probe/README.md) | `npm run probe` | Checks a reference ficha against what the engine makes of it, and adopts candidates | No |
| [brand/](brand/README.md) | `./scripts/brand/generate.sh` | Rebuilds the icons, the favicon and the share image | No |

What calls a provider costs tokens and is run by hand, never in CI. When to reach for each one: [docs/workflows.md](../docs/workflows.md).
