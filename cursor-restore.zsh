#!/bin/zsh

# Cursor config paths
CURSOR_USER_DIR="$HOME/Library/Application Support/Cursor/User"
DOTFILES_DIR="$HOME/.config/cursor"

echo "📥 Restoring Cursor settings..."

# Ensure Cursor config directory exists
mkdir -p "$CURSOR_USER_DIR"

# Copy settings from dotfiles repo to Cursor's live config
cp "$DOTFILES_DIR/settings.json" "$CURSOR_USER_DIR/settings.json"
cp "$DOTFILES_DIR/keybindings.json" "$CURSOR_USER_DIR/keybindings.json"
cp -R "$DOTFILES_DIR/snippets" "$CURSOR_USER_DIR/snippets"

echo "✅ Copied files to Cursor config directory"

# Now delete local files in dotfiles repo so we can symlink to live ones
rm -f "$DOTFILES_DIR/settings.json"
rm -f "$DOTFILES_DIR/keybindings.json"
rm -rf "$DOTFILES_DIR/snippets"

# Symlink from Cursor → dotfiles
ln -s "$CURSOR_USER_DIR/settings.json" "$DOTFILES_DIR/settings.json"
ln -s "$CURSOR_USER_DIR/keybindings.json" "$DOTFILES_DIR/keybindings.json"
ln -s "$CURSOR_USER_DIR/snippets" "$DOTFILES_DIR/snippets"

echo "🔗 Symlinks created: dotfiles now point to live Cursor config"
