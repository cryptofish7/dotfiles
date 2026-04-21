#!/bin/bash

DOTFILES="$HOME/dotfiles"

echo "Linking dotfiles..."

# Zsh
ln -sf "$DOTFILES/zsh/.zshrc" "$HOME/.zshrc"

# XDG configs (~/.config/)
mkdir -p "$HOME/.config"
ln -sfn "$DOTFILES/config/nvim" "$HOME/.config/nvim"
ln -sfn "$DOTFILES/config/tmux" "$HOME/.config/tmux"
ln -sfn "$DOTFILES/config/ghostty" "$HOME/.config/ghostty"
ln -sfn "$DOTFILES/config/gh" "$HOME/.config/gh"
ln -sfn "$DOTFILES/config/git" "$HOME/.config/git"
ln -sfn "$DOTFILES/config/karabiner" "$HOME/.config/karabiner"

# Claude Code
mkdir -p "$HOME/.claude"
ln -sf "$DOTFILES/config/claude/settings.json" "$HOME/.claude/settings.json"
# Remove real dirs so ln -sfn can create symlinks
[ -d "$HOME/.claude/skills" ] && [ ! -L "$HOME/.claude/skills" ] && rm -rf "$HOME/.claude/skills"
[ -d "$HOME/.claude/agents" ] && [ ! -L "$HOME/.claude/agents" ] && rm -rf "$HOME/.claude/agents"
[ -d "$HOME/.claude/commands" ] && [ ! -L "$HOME/.claude/commands" ] && rm -rf "$HOME/.claude/commands"
ln -sfn "$DOTFILES/config/claude/skills" "$HOME/.claude/skills"
ln -sfn "$DOTFILES/config/claude/agents" "$HOME/.claude/agents"
ln -sfn "$DOTFILES/config/claude/commands" "$HOME/.claude/commands"

# Codex
mkdir -p "$HOME/.codex"
ln -sf "$DOTFILES/config/codex/config.toml" "$HOME/.codex/config.toml"
[ -d "$HOME/.codex/skills" ] && [ ! -L "$HOME/.codex/skills" ] && rm -rf "$HOME/.codex/skills"
[ -d "$HOME/.codex/agents" ] && [ ! -L "$HOME/.codex/agents" ] && rm -rf "$HOME/.codex/agents"
ln -sfn "$DOTFILES/config/codex/skills" "$HOME/.codex/skills"
ln -sfn "$DOTFILES/config/codex/agents" "$HOME/.codex/agents"

echo "Done"
