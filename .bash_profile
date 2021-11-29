alias ll='ls -hartl'
alias g='grep -i'
alias get='curl -OL'
alias tmux="TERM=screen-256color-bce tmux"
alias vim='nvim'
alias python='python3'
alias pip='pip3'

eval "$(/opt/homebrew/bin/brew shellenv)"

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
