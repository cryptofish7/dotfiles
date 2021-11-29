# Other Installations

- Use bash as default:
```
chsh -s /bin/bash
```

- Install following brew packages:

```
brew install neovim
brew install tmux
brew install reattach-to-usernamespace
brew install fzf
brew install ripgrep
brew install python3
```

- Install nodejs
- Install vim-plug
- Setup `~/.config/nvim/init.vim` to point to `.vimrc`:

```
set runtimepath^=~/.vim runtimepath+=~/.vim/after
let &packpath=&runtimepath
source ~/.vimrc
```

# Setup
```
./dotfiles_out.sh
```
