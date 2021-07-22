#!/bin/bash

cp ../.bash_profile .bash_profile
cp ../.git-prompt.sh .git-prompt.sh
cp ../.vimrc .vimrc
cp ../.tmux.conf .tmux.conf
git add .
git commit -m "Update dotfiles"
git push
