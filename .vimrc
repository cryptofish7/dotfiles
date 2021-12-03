syntax on          " Enable syntax highlighting 
filetype indent on " Enable indenting for files
set backspace=indent,eol,start " Allow backspacing over indentation
set nocompatible   " Use VIM settings rather than Vi settings
set expandtab      " Use spaces instead of tab
set autoindent     " Enable auto indenting
set number         " Enable line numbers
set nobackup       " Disable backup
set laststatus=2   " Show status line
set statusline=%F%m%r%h%w%=(%{&ff}/%Y)\ (line\ %l\/%L,\ col\ %c)”
set wildmenu       " Display command line's tab complete options as a menu
set showcmd        " Show cmd in bottom right screen
set cursorline     " Highlight current line
set cursorcolumn   " Highlight current column
set hlsearch       " Highlight searches
set noswapfile     " Avoid swap files

" By default, the indent is 2 spaces
set softtabstop=2  " Indent by 2 spaces when hitting tab
set shiftwidth=2   " Indent by 2 spaces when auto-indenting
set tabstop=2      " Show existing tab with 2 spaces width

" For solidity, 4 spaces
autocmd Filetype solidity setlocal ts=4 sw=4 sts=4


" Set screen width and textwrap
highlight ColorColumn ctermbg=gray
set colorcolumn=80
" autocmd BufNewFile,BufRead * setlocal formatoptions=croqtn textwidth=120 wrapmargin=120 linebreak
autocmd FileType * set formatoptions=croqtn
" autocmd BufNewFile,BufRead * setlocal formatoptions=croqtn textwidth=0 wrapmargin=0 wrap linebreak

call plug#begin('~/.vim/plugged')

Plug 'scrooloose/nerdtree'
Plug 'tpope/vim-commentary'
Plug 'junegunn/fzf'
Plug 'junegunn/fzf.vim'
Plug 'alvan/vim-closetag'
Plug 'pangloss/vim-javascript'
Plug 'leafgarland/typescript-vim'
Plug 'MaxMEllon/vim-jsx-pretty'
" Plug 'peitalin/vim-jsx-typescript'
Plug 'neoclide/coc.nvim', {'branch': 'release'}
Plug 'Yggdroot/indentLine'
Plug 'sainnhe/gruvbox-material'
Plug 'lervag/vimtex'
" Plug 'sirver/ultisnips'
Plug 'mbbill/undotree'
Plug 'tomlion/vim-solidity'
Plug 'jiangmiao/auto-pairs'
Plug 'svermeulen/vim-easyclip'
Plug 'jparise/vim-graphql'

call plug#end()

" Vim-plug keybindings
nnoremap <localleader><localleader>i :PlugInstall<CR>
nnoremap <localleader><localleader>c :PlugClean<CR>

" Undotree toggle keybinding
nnoremap <C-n> :UndotreeToggle<CR>
nnoremap <C-a> g-
nnoremap <C-q> g+

" theme and terminal colour scheme settings
let g:gruvbox_contrast_dark='dark'
let g:gruvbox_material_background = 'soft'
set background=dark
colorscheme gruvbox-material

" NERDTree settings
function! NERDTreeToggleInCurDir()
    " If NERDTree is open in the current buffer
    if (exists("t:NERDTreeBufName") && bufwinnr(t:NERDTreeBufName) != -1)
        exe ":NERDTreeClose"
    else
        if (expand("%:t") != '')
            exe ":NERDTreeFind"
        else
            exe ":NERDTreeToggle"
        endif
    endif
endfunction
let NERDTreeShowHidden=1
let NERDTreeQuitOnOpen=1
map <C-x> :call NERDTreeToggleInCurDir()<CR>

" fzf and ripgrep settings
set rtp+=/usr/local/opt/fzf
let g:fzf_action = {
    \ 'ctrl-t': 'tab split',
    \ 'ctrl-i': 'split',
    \ 'ctrl-s': 'vsplit'
    \ }
command! -bang -nargs=? -complete=dir Files
  \ call fzf#vim#files(
  \   <q-args>, fzf#vim#with_preview({'options': ['--layout=reverse', '--info=inline']}), 
  \   <bang>0)
command! -bang -nargs=* Rg
  \ call fzf#vim#grep(
  \   'rg --column --line-number --no-heading --color=always --smart-case -- '.shellescape(<q-args>), 1,
  \   fzf#vim#with_preview({'options': '--delimiter : --nth 4..'}, 'up:60%'), <bang>0)
function! s:find_git_root()
    return system('git rev-parse --show-toplevel 2> /dev/null')[:-2]
endfunction
command! ProjectFiles execute 'Files' s:find_git_root()
command! ProjectRg execute 'cd '.system('git rev-parse --show-toplevel') 'Rg'
nnoremap <C-p> :Files<CR>
nnoremap <S-f> :Rg<CR>

" closing tag settings
let g:closetag_filenames = '*.html,*.xhtml,*.phtml,*.jsx,*.tsx,*.js'
let g:closetag_xhtml_filenames = '*.xhtml'
let g:closetag_filetypes = 'html,xhtml,phtml,jsx,tsx,javascript'
let g:closetag_xhtml_filetypes = 'xhtml'

" coc settings
let g:coc_global_extensions = [
  \ 'coc-tsserver',
  \ 'coc-eslint',
  \ 'coc-prettier',
  \ 'coc-highlight',
  \ 'coc-python',
  \ 'coc-json',
  \ 'coc-css',
  \ 'coc-html'
  \ ]

" Python provider settings
let g:python_host_prog = "/usr/bin/python"
let g:python3_host_prog = "/usr/local/bin/python3"

" Vimtex settings
let g:tex_flavor='latex'
let g:vimtex_view_method='skim'
let g:vimtex_quickfix_mode=0

" Live update to Skim
let g:vimtex_view_general_viewer
        \ = '/Applications/Skim.app/Contents/SharedSupport/displayline'
let g:vimtex_view_general_options = '-r @line @pdf @tex'

" This adds a callback hook that updates Skim after compilation
let g:vimtex_compiler_callback_hooks = ['UpdateSkim']

function! UpdateSkim(status)
    if !a:status | return | endif

    let l:out = b:vimtex.out()
    let l:tex = expand('%:p')
    let l:cmd = [g:vimtex_view_general_viewer, '-r']

    if !empty(system('pgrep Skim'))
        call extend(l:cmd, ['-g'])
    endif

    if has('nvim')
        call jobstart(l:cmd + [line('.'), l:out, l:tex])
    elseif has('job')
        call job_start(l:cmd + [line('.'), l:out, l:tex])
    else
        call system(join(l:cmd + [line('.'), shellescape(l:out), shellescape(l:tex)], ' '))
    endif
endfunction

"  Ultisnips settings
let g:UltiSnipsExpandTrigger = '<Ctrl>'
let g:UltiSnipsJumpForwardTrigger = '<Ctrl>'
let g:UltiSnipsJumpBackwardTrigger = '<S-Tab>'

" Easyclip settings
let g:EasyClipPreserveCursorPositionAfterYank = 1

" map leader
let mapleader = "\<Space>"
let maplocalleader = "\\"

" tab management 
noremap <TAB> <C-W>w
noremap <S-TAB> <C-W>h
noremap gr gT

" autoclose matching quotes, braces and parentheses
inoremap {<CR> {<CR>}<ESC>O
inoremap {;<CR> {<CR>};<ESC>O
inoremap (<CR> (<CR>)<ESC>O
inoremap (;<CR> (<CR>);<ESC>O
inoremap jj  <Esc>
inoremap <Esc> <Nop>

" autocompletion popup window bindings
inoremap <silent><expr> <TAB>
	  \ pumvisible() ? coc#_select_confirm() :
	  \ coc#expandableOrJumpable() ?
	  \ "\<C-r>=coc#rpc#request('doKeymap', ['snippets-expand-jump',''])\<CR>" :
	  \ <SID>check_back_space() ? "\<TAB>" :
	  \ coc#refresh()

	function! s:check_back_space() abort
	  let col = col('.') - 1
	  return !col || getline('.')[col - 1]  =~# '\s'
	endfunction

let g:coc_snippet_next = '<tab>'

" Visual bindings
vmap <Space>y "+y
vmap <Space>p "+p
vmap <Leader>y "+y
vmap <Leader>d "+d
nmap <Leader>p "+p
nmap <Leader>P "+P
vmap <Leader>p "+p
vmap <Leader>P "+P

" miscellaneous bindings
nnoremap <leader>f :call Yapf()<CR>
nnoremap <leader><leader> :nohlsearch<CR>
nnoremap <S-j> <Nop>
nnoremap <S-j> :<Up>

