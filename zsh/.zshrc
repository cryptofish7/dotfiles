# ------------------------------
# Aliases
# ------------------------------
alias ll='ls -hartl'
alias g='grep -i'
alias get='curl -OL'
alias python='python3'
alias pip='pip3'
alias vim='nvim'

# ------------------------------
# Homebrew (Apple Silicon)
# ------------------------------
eval "$(/opt/homebrew/bin/brew shellenv)"

# ------------------------------
# Git Prompt
# ------------------------------
autoload -Uz vcs_info
zstyle ':vcs_info:git:*' formats ' (%b)'
precmd() {
  vcs_info
  print -Pn "\e]0;%~\a"  # Set terminal title
}

setopt PROMPT_SUBST
PROMPT='[$([[ "$PWD" == "$HOME" ]] && echo "~" || basename "$PWD")${vcs_info_msg_0_}]$ '

# ------------------------------
# PATH
# ------------------------------
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.n/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# ------------------------------
# FZF (use ripgrep for file listing)
# ------------------------------
export FZF_DEFAULT_COMMAND='rg --files --no-ignore-vcs --hidden'
