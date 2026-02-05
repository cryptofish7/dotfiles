#!/bin/bash

DOTFILES="$HOME/dotfiles"

echo "Linking dotfiles..."

# Zsh
ln -sf "$DOTFILES/zsh/.zshrc" "$HOME/.zshrc"

# XDG configs (~/.config/)
mkdir -p "$HOME/.config"
ln -sf "$DOTFILES/config/nvim" "$HOME/.config/nvim"
ln -sf "$DOTFILES/config/tmux" "$HOME/.config/tmux"
ln -sf "$DOTFILES/config/ghostty" "$HOME/.config/ghostty"
ln -sf "$DOTFILES/config/gh" "$HOME/.config/gh"
ln -sf "$DOTFILES/config/git" "$HOME/.config/git"
ln -sf "$DOTFILES/config/karabiner" "$HOME/.config/karabiner"

# Claude Code
mkdir -p "$HOME/.claude"
ln -sf "$DOTFILES/config/claude/settings.json" "$HOME/.claude/settings.json"
ln -sfn "$DOTFILES/config/claude/skills" "$HOME/.claude/skills"
ln -sfn "$DOTFILES/config/claude/agents" "$HOME/.claude/agents"

echo "Done"
