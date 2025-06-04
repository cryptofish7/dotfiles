# ------------------------------
# Aliases
# ------------------------------
alias ll='ls -hartl'
alias g='grep -i'
alias get='curl -OL'
alias tmux='TERM=screen-256color-bce tmux'
alias python='python3'
alias pip='pip3'
alias vim='nvim'

# ------------------------------
# Homebrew (Apple Silicon)
# ------------------------------
eval "$(/opt/homebrew/bin/brew shellenv)"

# ------------------------------
# Git Prompt (optional)
# ------------------------------
[[ -f ~/.git-prompt.sh ]] && source ~/.git-prompt.sh
autoload -Uz vcs_info
precmd() {
  vcs_info
  print -Pn "\e]0;%~\a"  # Set terminal title
}

setopt PROMPT_SUBST
PROMPT='[$([[ "$PWD" == "$HOME" ]] && echo "~" || basename "$PWD")${vcs_info_msg_0_}]$ '


# ------------------------------
# Terminal window title
# ------------------------------
precmd() { print -Pn "\e]0;%~\a" }

# ------------------------------
# PATH customizations
# ------------------------------
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.n/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# ------------------------------
# FZF config (use ripgrep for file listing)
# ------------------------------
export FZF_DEFAULT_COMMAND='rg --files --no-ignore-vcs --hidden'

# ------------------------------
# Optional: SSH agent (if not using macOS keychain)
# ------------------------------
# eval "$(ssh-agent -s)"
