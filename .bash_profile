alias ll='ls -hartl'
alias g='grep -i'
alias get='curl -OL'
alias tmux="TERM=screen-256color-bce tmux"
alias vim='nvim'
alias python='python3'
alias pip='pip3'

eval "$(/opt/homebrew/bin/brew shellenv)"
eval `ssh-agent -s`

source ~/.git-prompt.sh
PS1='[\W$(__git_ps1 " (%s)")]\$ '
export PROMPT_COMMAND='echo -ne "\033]0;${PWD/#$HOME/~}\007"'
export PATH=~/.npm-global/bin:$PATH
export FZF_DEFAULT_COMMAND='rg --files --no-ignore-vcs --hidden'
[ -f /usr/local/etc/bash_completion ] && . /usr/local/etc/bash_completion || {
    # if not found in /usr/local/etc, try the brew --prefix location
    [ -f "$(brew --prefix)/etc/bash_completion.d/git-completion.bash" ] && \
        . $(brew --prefix)/etc/bash_completion.d/git-completion.bash
}

export PATH="$HOME/.poetry/bin:$PATH"
export N_PREFIX=$HOME/.n
export PATH="$N_PREFIX/bin:$PATH"

# Created by `pipx` on 2022-03-16 01:27:07
export PATH="$PATH:/Users/cryptofish/.local/bin"

# Created by `pipx` on 2022-03-16 01:27:07
export PATH="$PATH:/Users/cryptofish/Library/Python/3.8/bin"

export PYENV_ROOT="$HOME/.pyenv"
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
export PATH="$HOME/.cargo/env:$PATH"
