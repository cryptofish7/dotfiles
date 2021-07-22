syntax on          " Enable syntax highlighting 
filetype indent on " Enable indenting for files
set backspace=indent,eol,start " Allow backspacing over indentation
set nocompatible   " Use VIM settings rather than Vi settings
set expandtab      " Use spaces instead of tab
set softtabstop=2  " Indent by 2 spaces when hitting tab
set shiftwidth=2   " Indent by 4 spaces when auto-indenting
set tabstop=2      " Show existing tab with 4 spaces width
set autoindent     " Enable auto indenting
set number         " Enable line numbers
set nobackup       " Disable backup
set laststatus=2   " Show status line
set statusline=%F%m%r%h%w%=(%{&ff}/%Y)\ (line\ %l\/%L,\ col\ %c)”
set wildmenu       " Display command line's tab complete options as a menu
set directory=$HOME/.vim/swp// " Store swp files in its own folder
set undodir=$HOME/.vim/undodir " Store undo files in its own folder
set showcmd        " Show cmd in bottom right screen
set cursorline     " Highlight current line
set cursorcolumn   " Highlight current column
set hlsearch       " Highlight searches

" Set screen width and textwrap
highlight ColorColumn ctermbg=gray
set colorcolumn=120
autocmd BufNewFile,BufRead * setlocal formatoptions=croqtn textwidth=80  wrapmargin=80 linebreak
autocmd FileType * set formatoptions=croqtn
" autocmd BufNewFile,BufRead * setlocal formatoptions=croqtn textwidth=0 wrapmargin=0 wrap linebreak

call plug#begin('~/.vim/plugged')

Plug 'scrooloose/nerdtree'
Plug 'morhetz/gruvbox'
Plug 'tpope/vim-commentary'
Plug '/usr/local/opt/fzf'
Plug 'junegunn/fzf.vim'
Plug 'mindriot101/vim-yapf'
Plug 'alvan/vim-closetag'
Plug 'jiangmiao/auto-pairs'
Plug 'pangloss/vim-javascript'
Plug 'leafgarland/typescript-vim'
Plug 'MaxMEllon/vim-jsx-pretty'
" Plug 'mxw/vim-jsx'
Plug 'peitalin/vim-jsx-typescript'
Plug 'neoclide/coc.nvim', {'branch': 'release'}
Plug 'Yggdroot/indentLine'
Plug 'sainnhe/gruvbox-material'
Plug 'lervag/vimtex'
Plug 'sirver/ultisnips'
Plug 'mbbill/undotree'

call plug#end()

" Vim-plug keybindings
nnoremap <localleader><localleader>i :PlugInstall<CR>
nnoremap <localleader><localleader>c :PlugClean<CR>

" Undotree toggle keybinding
nnoremap <C-m> :UndotreeToggle<CR>
nnoremap <C-a> g-
nnoremap <C-q> g+

" indent line ruler settings
let g:indentLine_enabled = 1
let g:indentLine_char = '┊'
let g:indentLine_concealcursor = ""
let g:indentLine_fileTypeExclude = ['json', 'md', 'tex']

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
  \   <q-args>, {'options': ['--layout=reverse', '--info=inline', '--preview', '~/.vim/plugged/fzf.vim/bin/preview.sh {}']}, 
  \   <bang>0)
command! -bang -nargs=* Rg
  \ call fzf#vim#grep(
  \   'rg --column --line-number --no-heading --color=always --smart-case -- '.shellescape(<q-args>), 1,
  \   fzf#vim#with_preview(), <bang>0)
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
  \ 'coc-tsserver'
  \ ]

" Haskell Vim settings
let g:haskell_indent_disable = 1

" Python provider settings
let g:python_host_prog = "/usr/bin/python"
let g:python3_hot_prog = "/usr/bin/python3"

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

" " Ultisnips settings
let g:UltiSnipsExpandTrigger = '<Ctrl>'
let g:UltiSnipsJumpForwardTrigger = '<Ctrl>'
let g:UltiSnipsJumpBackwardTrigger = '<S-Tab>'

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

" move cursor left/right in insert mode
inoremap <C-y> <C-o>h
inoremap <C-u> <C-o>l

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

