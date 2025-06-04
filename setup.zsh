#!/bin/zsh

echo "🔗 Linking dotfiles..."

# Zsh
ln -sf ".zshrc" "$HOME/.zshrc"

# Neovim
ln -sf "nvim" "$HOME/.config/nvim"

# iTerm2
ln -sf "iterm2" "$HOME/.config/iterm2"

echo "✅ Dotfiles synced"
