# My Dotfiles

My preferred setup is Neovim + Tmux + Ghostty + Zsh on macOS.

## Quick Start

```bash
git clone git@github.com:cryptofish7/dotfiles.git ~/dotfiles
cd ~/dotfiles
./setup.sh
```

## Prerequisites

Install via Homebrew:

```bash
brew install neovim tmux fzf ripgrep gh
brew install --cask ghostty font-jetbrains-mono-nerd-font
```

## What's Included

| Path | Purpose |
|------|---------|
| `zsh/.zshrc` | Shell config with aliases, fzf, custom prompt |
| `config/nvim/` | Neovim - LSP, Treesitter, Telescope, formatting |
| `config/tmux/` | Terminal multiplexer (Ctrl-X prefix, vim keys) |
| `config/ghostty/` | Terminal emulator (Atom One Dark, JetBrains Mono) |
| `config/gh/` | GitHub CLI preferences |
| `config/git/` | Global gitignore |
| `config/karabiner/` | Razer Naga mouse remapping for WoW |
| `config/claude/` | Claude Code settings (status line) |

## Supported Languages

Neovim LSP: Go, Python, Rust, TypeScript/JavaScript, Lua, Solidity, C/C++, JSON, Markdown.
