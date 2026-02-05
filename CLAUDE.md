# Dotfiles

Personal macOS dev environment: Neovim + Tmux + Ghostty + Zsh.

## Repo Structure

| Path | What it configures |
|------|--------------------|
| `zsh/.zshrc` | Shell: aliases, prompt, PATH, fzf |
| `config/nvim/init.lua` | Neovim: LSP, Treesitter, Telescope, formatting (Kickstart-based, single-file) |
| `config/tmux/tmux.conf` | Tmux: `C-x` prefix, vim pane nav, copy-mode |
| `config/ghostty/config` | Ghostty: Dark+ theme, JetBrains Mono, tmux-style splits |
| `config/gh/` | GitHub CLI |
| `config/git/ignore` | Global gitignore |
| `config/karabiner/` | Razer Naga mouse remapping |
| `config/claude/settings.json` | Claude Code user-level settings (status line, plugins) |
| `config/claude/skills/` | Claude Code user-level skills (symlinked to `~/.claude/skills/`) |
| `config/claude/agents/` | Claude Code user-level agents (symlinked to `~/.claude/agents/`) |
| `setup.sh` | Symlinks everything into place |

## How Symlinks Work

`setup.sh` links configs to their expected locations:
- `zsh/.zshrc` -> `~/.zshrc`
- `config/*` -> `~/.config/*`
- `config/claude/settings.json` -> `~/.claude/settings.json`
- `config/claude/skills/` -> `~/.claude/skills/`
- `config/claude/agents/` -> `~/.claude/agents/`

When editing configs, edit the files in this repo — the symlinks mean changes take effect immediately (after sourcing/reloading where needed). Don't flag symlinked content as duplication.

## Testing Changes

- **Zsh**: `source ~/.zshrc`
- **Tmux**: `tmux source-file ~/.config/tmux/tmux.conf`
- **Neovim**: Restart nvim (`:q` and reopen)
- **Ghostty**: Restart Ghostty (auto-reloads on config change for most settings)

## Rules

- Always read the actual config file before answering questions about it. Never guess at keybindings, options, or defaults.
- When unsure about tool-specific behavior (Ghostty flags, tmux options, etc.), look up docs or `--help` output first.
- Keep configs minimal. Don't add comments explaining obvious settings.
- Neovim config is a single `init.lua` — don't split it into multiple files.
