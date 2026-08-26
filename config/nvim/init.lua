--[[

=====================================================================
==================== READ THIS BEFORE CONTINUING ====================
=====================================================================

Kickstart.nvim is *not* a distribution.

Kickstart.nvim is a template for your own configuration.
  The goal is that you can read every line of code, top-to-bottom, understand
  what your configuration is doing, and modify it to suit your needs.

  Once you've done that, you should start exploring, configuring and tinkering to
  explore Neovim!

  If you don't know anything about Lua, I recommend taking some time to read through
  a guide. One possible example:
  - https://learnxinyminutes.com/docs/lua/


  And then you can explore or search through `:help lua-guide`
  - https://neovim.io/doc/user/lua-guide.html


Kickstart Guide:

I have left several `:help X` comments throughout the init.lua
You should run that command and read that help section for more information.

In addition, I have some `NOTE:` items throughout the file.
These are for you, the reader to help understand what is happening. Feel free to delete
them once you know what you're doing, but they should serve as a guide for when you
are first encountering a few different constructs in your nvim config.

I hope you enjoy your Neovim journey,
- TJ

P.S. You can delete this when you're done too. It's your config now :)
--]]
-- Set <space> as the leader key
-- See `:help mapleader`
--  NOTE: Must happen before plugins are required (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = '\\'

-- Disable netrw so we can use nvim-tree
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Install package manager
--    https://github.com/folke/lazy.nvim
--    `:help lazy.nvim.txt` for more info
local lazypath = vim.fn.stdpath 'data' .. '/lazy/lazy.nvim'
if not vim.loop.fs_stat(lazypath) then
    vim.fn.system {
        'git',
        'clone',
        '--filter=blob:none',
        'https://github.com/folke/lazy.nvim.git',
        '--branch=stable', -- latest stable release
        lazypath,
    }
end
vim.opt.rtp:prepend(lazypath)

-- NOTE: Here is where you install your plugins.
--  You can configure plugins using the `config` key.
--
--  You can also configure plugins after the setup call,
--    as they will be available in your neovim runtime.
require('lazy').setup({
    -- NOTE: First, some plugins that don't require any configuration

    -- Detect tabstop and shiftwidth automatically
    'tpope/vim-sleuth',

    -- Undo history
    'mbbill/undotree',

    -- NOTE: This is where your plugins related to LSP can be installed.
    --  The configuration is done below. Search for lspconfig to find it below.
    {
        -- LSP Configuration & Plugins
        'neovim/nvim-lspconfig',
        dependencies = {
            -- Automatically install LSPs to stdpath for neovim
            -- NOTE: mason moved orgs; these were williamboman/*
            'mason-org/mason.nvim',
            'mason-org/mason-lspconfig.nvim',

            -- Useful status updates for LSP
            -- NOTE: `opts = {}` is the same as calling `require('fidget').setup({})`
            { 'j-hui/fidget.nvim', opts = {} },
        },
    },

    {
        -- Lua LS support for the Neovim API. Replaces neodev.nvim, which is EOL.
        'folke/lazydev.nvim',
        ft = 'lua',
        opts = {
            library = {
                { path = '${3rd}/luv/library', words = { 'vim%.uv' } },
            },
        },
    },

    {
        -- Autocompletion
        'hrsh7th/nvim-cmp',
        dependencies = {
            -- Snippet Engine & its associated nvim-cmp source
            'L3MON4D3/LuaSnip',
            'saadparwaiz1/cmp_luasnip',

            -- Adds LSP completion capabilities
            'hrsh7th/cmp-nvim-lsp',

            -- Adds a number of user-friendly snippets
            'rafamadriz/friendly-snippets',
        },
    },

    -- -- Useful plugin to show you pending keybinds.
    -- { 'folke/which-key.nvim', opts = {} },
    {
        -- Adds git related signs to the gutter, as well as utilities for managing changes
        'lewis6991/gitsigns.nvim',
        opts = {
            -- See `:help gitsigns.txt`
            signs = {
                add = { text = '+' },
                change = { text = '~' },
                delete = { text = '_' },
                topdelete = { text = '‾' },
                changedelete = { text = '~' },
            },
            on_attach = function(bufnr)
                vim.keymap.set(
                    'n',
                    '<leader>hp',
                    require('gitsigns').preview_hunk,
                    { buffer = bufnr, desc = 'Preview git hunk' }
                )

                -- don't override the built-in and fugitive keymaps
                local gs = package.loaded.gitsigns
                vim.keymap.set({ 'n', 'v' }, ']c', function()
                    if vim.wo.diff then
                        return ']c'
                    end
                    vim.schedule(function()
                        gs.next_hunk()
                    end)
                    return '<Ignore>'
                end, {
                    expr = true,
                    buffer = bufnr,
                    desc = 'Jump to next hunk',
                })
                vim.keymap.set({ 'n', 'v' }, '[c', function()
                    if vim.wo.diff then
                        return '[c'
                    end
                    vim.schedule(function()
                        gs.prev_hunk()
                    end)
                    return '<Ignore>'
                end, {
                    expr = true,
                    buffer = bufnr,
                    desc = 'Jump to previous hunk',
                })
            end,
        },
    },

    {
        -- Theme inspired by Atom
        'navarasu/onedark.nvim',
        priority = 1000,
        config = function()
            vim.cmd.colorscheme 'onedark'
        end,
    },

    {
        -- Set lualine as statusline
        'nvim-lualine/lualine.nvim',
        -- See `:help lualine.txt`
        opts = {
            options = {
                icons_enabled = false,
                theme = 'onedark',
                component_separators = '|',
                section_separators = '',
            },
        },
    },

    {
        -- Add indentation guides even on blank lines
        'lukas-reineke/indent-blankline.nvim',
        -- Enable `lukas-reineke/indent-blankline.nvim`
        -- See `:help ibl`
        main = 'ibl',
        opts = {},
    },

    -- "gc" to comment visual regions/lines
    { 'numToStr/Comment.nvim', opts = {} },

    -- Fuzzy Finder (files, lsp, etc)
    {
        'nvim-telescope/telescope.nvim',
        branch = '0.1.x',
        dependencies = {
            'nvim-lua/plenary.nvim',
            -- Fuzzy Finder Algorithm which requires local dependencies to be built.
            -- Only load if `make` is available. Make sure you have the system
            -- requirements installed.
            {
                'nvim-telescope/telescope-fzf-native.nvim',
                -- NOTE: If you are having trouble with this installation,
                --       refer to the README for telescope-fzf-native for more instructions.
                build = 'make',
                cond = function()
                    return vim.fn.executable 'make' == 1
                end,
            },
        },
    },

    -- Autocomplete HTML tags
    { 'windwp/nvim-ts-autotag', opts = {} },

    {
        -- Highlight, edit, and navigate code
        -- NOTE: the `main` branch is a full rewrite -- it ships parsers and
        -- queries but enables nothing by itself. Everything is turned on in
        -- the Treesitter section further down. It cannot be lazy-loaded, and
        -- parsers must be kept in step with the plugin via `:TSUpdate`.
        'nvim-treesitter/nvim-treesitter',
        branch = 'main',
        lazy = false,
        build = ':TSUpdate',
        dependencies = {
            { 'nvim-treesitter/nvim-treesitter-textobjects', branch = 'main' },
        },
        init = function()
            -- These built-in ftplugins map ]m/[m/]]/[[ buffer-locally, which
            -- would shadow the global textobject motions set up below.
            vim.g.no_python_maps = true
            vim.g.no_rust_maps = true
            vim.g.no_go_maps = true
            vim.g.no_vim_maps = true
        end,
    },

    -- Autocomplete close parentheses
    { 'windwp/nvim-autopairs', event = 'InsertEnter', opts = {} },

    -- NOTE: Next Step on Your Neovim Journey: Add/Configure additional "plugins" for kickstart
    --       These are some example plugins that I've included in the kickstart repository.
    --       Uncomment any of the lines below to enable them.
    -- require 'kickstart.plugins.autoformat',
    -- require 'kickstart.plugins.debug',

    -- NOTE: The import below can automatically add your own plugins, configuration, etc from `lua/custom/plugins/*.lua`
    --    You can use this folder to prevent any conflicts with this init.lua if you're interested in keeping
    --    up-to-date with whatever is in the kickstart repo.
    --    Uncomment the following line and add your plugins to `lua/custom/plugins/*.lua` to get going.
    --
    --    For additional information see: https://github.com/folke/lazy.nvim#-structuring-your-plugins
    -- { import = 'custom.plugins' },
    {
        -- File explorer
        'nvim-tree/nvim-tree.lua',
        version = '*',
        lazy = false,
        dependencies = {
            'nvim-tree/nvim-web-devicons',
        },
    },

    -- Formatter
    {
        'stevearc/conform.nvim',
        event = { 'BufWritePre' },
        cmd = { 'ConformInfo' },
        opts = {
            formatters_by_ft = {
                javascript = { 'prettierd', 'eslint_d' },
                typescript = { 'prettierd', 'eslint_d' },
                javascriptreact = { 'prettierd', 'eslint_d' },
                typescriptreact = { 'prettierd', 'eslint_d' },
                json = { 'prettierd' },
                html = { 'prettierd' },
                css = { 'prettierd' },
                markdown = { 'prettierd' },
                solidity = { 'prettierd' },
                lua = { 'stylua' },
                go = { 'gofmt' },
                rust = { 'rustfmt' },
                sh = { 'shfmt' },
                bash = { 'shfmt' },
                zsh = { 'shfmt' },
            },
            format_on_save = {
                timeout_ms = 500,
                lsp_fallback = true,
            },
            formatters = {
                shfmt = {
                    prepend_args = { '-i', '4', '-ci', '-sr' },
                },
            },
        },
    },

    -- Linter
    {
        'mfussenegger/nvim-lint',
        event = { 'BufReadPre', 'BufNewFile' },
        config = function()
            local lint = require('lint')
            lint.linters_by_ft = {
                javascript = { 'eslint_d' },
                typescript = { 'eslint_d' },
                javascriptreact = { 'eslint_d' },
                typescriptreact = { 'eslint_d' },
                sh = { 'shellcheck' },
                bash = { 'shellcheck' },
                lua = { 'luacheck' },
            }
            vim.api.nvim_create_autocmd({ 'BufWritePost', 'BufEnter' }, {
                callback = function()
                    lint.try_lint()
                end,
            })
        end,
    },
}, {
    -- Newer lazy.nvim installs luarocks (via hererocks) for plugins that ship a
    -- rockspec. Telescope ships one, but its only dependency is plenary, which
    -- is already managed as a plugin -- so skip the toolchain.
    rocks = { enabled = false },
})

-- [[ Setting options ]]
-- See `:help vim.o`
-- NOTE: You can change these options as you wish!

-- Tabs to 4 spaces
vim.o.tabstop = 4
vim.o.shiftwidth = 4
vim.o.softtabstop = 4
vim.o.expandtab = true

-- Set highlight on search
vim.o.hlsearch = true

-- Make line numbers default
vim.wo.number = true

-- Enable mouse mode
vim.o.mouse = 'a'

-- Sync clipboard between OS and Neovim.
--  Remove this option if you want your OS clipboard to remain independent.
--  See `:help 'clipboard'`
vim.o.clipboard = 'unnamedplus'

-- Enable break indent
vim.o.breakindent = true

-- Save undo history
vim.o.undofile = false

-- Case-insensitive searching UNLESS \C or capital in search
vim.o.ignorecase = false
vim.o.smartcase = false

-- Keep signcolumn on by default
vim.wo.signcolumn = 'yes'

-- Decrease update time
vim.o.updatetime = 250
vim.o.timeoutlen = 300

-- Set completeopt to have a better completion experience
vim.o.completeopt = 'menuone,noselect'

-- NOTE: You should make sure your terminal supports this
vim.o.termguicolors = true

-- [[ Lazy Keymaps ]]

-- Keymaps to install and clean plugins
vim.keymap.set('n', '<localleader>i', ':Lazy install<CR>')
vim.keymap.set('n', '<localleader>c', ':Lazy clean')

-- [[ Basic Keymaps ]]

-- Keymaps for better default experience
-- See `:help vim.keymap.set()`
vim.keymap.set({ 'n', 'v' }, '<Space>', '<Nop>', { silent = true })

-- Remap for dealing with word wrap
vim.keymap.set('n', 'k', "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })
vim.keymap.set('n', 'j', "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })

-- Remap exit insert mode
vim.keymap.set('i', 'jj', '<Esc>')
vim.keymap.set('i', '<Esc>', '<Nop>')

-- Keymaps for window navigation
vim.keymap.set('n', '<TAB>', '<C-W>w')
vim.keymap.set('n', '<S-TAB>', '<C-W>h')

-- Keymaps for tab navigation
vim.keymap.set('n', 'gr', 'gT')

-- Keymap to remove highlighted search matches
vim.keymap.set('n', '<leader><leader>', ':nohlsearch<CR>')

-- Remove annoying keymaps
vim.keymap.set('n', '<S-j>', '<Nop>')
vim.keymap.set('n', 'q:', '<Nop>')

-- [[ Highlight on yank ]]
-- See `:help vim.highlight.on_yank()`
local highlight_group = vim.api.nvim_create_augroup('YankHighlight', { clear = true })
vim.api.nvim_create_autocmd('TextYankPost', {
    callback = function()
        vim.highlight.on_yank()
    end,
    group = highlight_group,
    pattern = '*',
})

-- [[ Configure Telescope ]]
-- See `:help telescope` and `:help telescope.setup()`
require('telescope').setup {
    defaults = {
        mappings = {
            i = {
                ['<C-u>'] = false,
                ['<C-d>'] = false,
            },
        },
    },
    pickers = {
        find_files = {
            hidden = true,
            file_ignore_patterns = { '.git/' },
        },
    },
}

-- Enable telescope fzf native, if installed
pcall(require('telescope').load_extension, 'fzf')

-- See `:help telescope.builtin`
vim.keymap.set('n', '<leader>/', function()
    -- You can pass additional configuration to telescope to change theme, layout, etc.
    require('telescope.builtin').current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
        winblend = 10,
        previewer = false,
    })
end, { desc = '[/] Fuzzily search in current buffer' })

vim.keymap.set('n', '<C-p>', require('telescope.builtin').find_files, { desc = '[S]earch [F]iles' })
vim.keymap.set('n', '<leader>h', require('telescope.builtin').help_tags, { desc = '[S]earch [H]elp' })
vim.keymap.set('n', '<S-f>', require('telescope.builtin').live_grep, { desc = '[S]earch by [G]rep' })
vim.keymap.set('n', '<leader>e', require('telescope.builtin').diagnostics, { desc = '[S]earch [D]iagnostics' })

-- [[ Configure Treesitter ]]
-- See `:help nvim-treesitter`
local ts_ensure_installed = {
    'c',
    'cpp',
    'go',
    'lua',
    'python',
    'rust',
    'tsx',
    'javascript',
    'typescript',
    'vimdoc',
    'vim',
    'bash',
}

local nvim_treesitter = require 'nvim-treesitter'

-- No-op for parsers that are already present; runs asynchronously.
nvim_treesitter.install(ts_ensure_installed)

local function ts_attach(buf, lang)
    vim.treesitter.start(buf, lang)
    -- Treesitter indentation is still marked experimental upstream.
    vim.bo[buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
end

-- On `main`, highlighting and indentation are per-buffer opt-ins, and there is
-- no `auto_install` -- so do both here.
local ts_available
vim.api.nvim_create_autocmd('FileType', {
    group = vim.api.nvim_create_augroup('user-treesitter', { clear = true }),
    callback = function(ev)
        local lang = vim.treesitter.language.get_lang(ev.match)
        if not lang then
            return
        end

        if vim.treesitter.language.add(lang) then
            ts_attach(ev.buf, lang)
            return
        end

        -- Stand-in for the old `auto_install`: fetch the parser once, then
        -- attach if the buffer is still around when it lands.
        ts_available = ts_available or nvim_treesitter.get_available()
        if not vim.tbl_contains(ts_available, lang) then
            return
        end

        nvim_treesitter.install({ lang }):await(function(err)
            if err then
                return
            end
            vim.schedule(function()
                if vim.api.nvim_buf_is_valid(ev.buf) then
                    ts_attach(ev.buf, lang)
                end
            end)
        end)
    end,
})

-- Incremental selection is now built into Neovim as visual-mode `an`/`in`
-- (`:help treesitter-incremental-selection`). Keep the old keys pointed at it.
-- Note: the old `<C-s>` scope_incremental has no equivalent; repeat `<C-space>`.
vim.keymap.set('n', '<c-space>', 'van', { remap = true, desc = 'Select node' })
vim.keymap.set('x', '<c-space>', 'an', { remap = true, desc = 'Select parent node' })
vim.keymap.set('x', '<M-space>', 'in', { remap = true, desc = 'Select child node' })

-- [[ Configure Treesitter textobjects ]]
require('nvim-treesitter-textobjects').setup {
    select = {
        lookahead = true, -- Automatically jump forward to textobj, similar to targets.vim
    },
    move = {
        set_jumps = true, -- whether to set jumps in the jumplist
    },
}

-- `main` no longer registers keymaps for us; capture groups come from textobjects.scm.
local ts_select = require 'nvim-treesitter-textobjects.select'
local ts_move = require 'nvim-treesitter-textobjects.move'
local ts_swap = require 'nvim-treesitter-textobjects.swap'

for lhs, capture in pairs {
    ['aa'] = '@parameter.outer',
    ['ia'] = '@parameter.inner',
    ['af'] = '@function.outer',
    ['if'] = '@function.inner',
    ['ac'] = '@class.outer',
    ['ic'] = '@class.inner',
} do
    vim.keymap.set({ 'x', 'o' }, lhs, function()
        ts_select.select_textobject(capture, 'textobjects')
    end, { desc = 'Select ' .. capture })
end

for lhs, move in pairs {
    [']m'] = { 'goto_next_start', '@function.outer' },
    [']]'] = { 'goto_next_start', '@class.outer' },
    [']M'] = { 'goto_next_end', '@function.outer' },
    [']['] = { 'goto_next_end', '@class.outer' },
    ['[m'] = { 'goto_previous_start', '@function.outer' },
    ['[['] = { 'goto_previous_start', '@class.outer' },
    ['[M'] = { 'goto_previous_end', '@function.outer' },
    ['[]'] = { 'goto_previous_end', '@class.outer' },
} do
    local fn, capture = move[1], move[2]
    vim.keymap.set({ 'n', 'x', 'o' }, lhs, function()
        ts_move[fn](capture, 'textobjects')
    end, { desc = fn .. ' ' .. capture })
end

vim.keymap.set('n', '<leader>a', function()
    ts_swap.swap_next '@parameter.inner'
end, { desc = 'Swap next parameter' })
vim.keymap.set('n', '<leader>A', function()
    ts_swap.swap_previous '@parameter.inner'
end, { desc = 'Swap previous parameter' })

-- [[ Cut/delete behaviour ]]
-- Replaces vim-easyclip (unmaintained since 2019), reproducing the parts of it
-- that were actually live here. Its yank ring is not carried over: the keys
-- that drive it, <C-p> and <C-n>, are taken by Telescope and Undotree
-- elsewhere in this file, so it was already unreachable.

-- `m` cuts (easyclip's "move"), which is why plain `d` can throw text away.
-- NOTE: this shadows the mark key, exactly as easyclip did.
vim.keymap.set({ 'n', 'x' }, 'm', 'd', { desc = 'Cut' })
vim.keymap.set('n', 'mm', 'dd', { desc = 'Cut line' })

-- Deletes go to the black hole so they never clobber the last yank -- which
-- matters more here than it looks, because 'clipboard' is unnamedplus, so an
-- unredirected delete would overwrite the system clipboard.
-- As with easyclip, this means `"add` cannot delete into a named register.
for _, op in ipairs { 'd', 'c', 'x' } do
    vim.keymap.set({ 'n', 'x' }, op, '"_' .. op, { desc = 'Black-hole ' .. op })
end

-- Visual paste keeps the register, rather than swapping in what it replaced.
vim.keymap.set('x', 'p', 'P', { desc = 'Paste over selection' })
vim.keymap.set('x', 'P', 'P', { desc = 'Paste over selection' })

-- Yank without moving the cursor, as easyclip did.
local yank_cursor
vim.keymap.set({ 'n', 'x' }, 'y', function()
    yank_cursor = vim.api.nvim_win_get_cursor(0)
    return 'y'
end, { expr = true, desc = 'Yank (keeps cursor position)' })
vim.api.nvim_create_autocmd('TextYankPost', {
    group = vim.api.nvim_create_augroup('yank-keep-cursor', { clear = true }),
    callback = function()
        if yank_cursor then
            pcall(vim.api.nvim_win_set_cursor, 0, yank_cursor)
            yank_cursor = nil
        end
    end,
})

-- [[ Undotree configuration ]]
vim.keymap.set('n', '<C-n>', ':UndotreeToggle<CR>')
vim.keymap.set('n', 'g=', 'g+')

-- Diagnostic keymaps
vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous diagnostic message' })
vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next diagnostic message' })
vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Open floating diagnostic message' })
vim.keymap.set('n', '<leader>d', vim.diagnostic.setloclist, { desc = 'Open diagnostics list' })

-- [[ Configure LSP ]]
--  This function gets run when an LSP connects to a particular buffer.
local on_attach = function(client, bufnr)
    -- NOTE: Remember that lua is a real programming language, and as such it is possible
    -- to define small helper and utility functions so you don't have to repeat yourself
    -- many times.
    --
    -- In this case, we create a function that lets us more easily define mappings specific
    -- for LSP related items. It sets the mode, buffer and description for us each time.
    local nmap = function(keys, func, desc)
        if desc then
            desc = 'LSP: ' .. desc
        end

        vim.keymap.set('n', keys, func, { buffer = bufnr, desc = desc })
    end

    nmap('<leader>rn', vim.lsp.buf.rename, '[R]e[n]ame')
    nmap('<leader>ca', vim.lsp.buf.code_action, '[C]ode [A]ction')

    nmap('gd', require('telescope.builtin').lsp_definitions, '[G]oto [D]efinition')
    nmap('gf', require('telescope.builtin').lsp_references, '[G]oto Re[f]erences')
    nmap('gI', require('telescope.builtin').lsp_implementations, '[G]oto [I]mplementation')
    nmap('<leader>D', require('telescope.builtin').lsp_type_definitions, 'Type [D]efinition')
    nmap('<leader>ds', require('telescope.builtin').lsp_document_symbols, '[D]ocument [S]ymbols')
    nmap('<leader>ws', require('telescope.builtin').lsp_dynamic_workspace_symbols, '[W]orkspace [S]ymbols')

    -- See `:help K` for why this keymap
    nmap('K', vim.lsp.buf.hover, 'Hover Documentation')
    nmap('<C-k>', vim.lsp.buf.signature_help, 'Signature Documentation')

    -- Lesser used LSP functionality
    nmap('gD', vim.lsp.buf.declaration, '[G]oto [D]eclaration')
    nmap('<leader>wa', vim.lsp.buf.add_workspace_folder, '[W]orkspace [A]dd Folder')
    nmap('<leader>wr', vim.lsp.buf.remove_workspace_folder, '[W]orkspace [R]emove Folder')
    nmap('<leader>wl', function()
        print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
    end, '[W]orkspace [L]ist Folders')

    -- Create a command `:Format` local to the LSP buffer
    vim.api.nvim_buf_create_user_command(bufnr, 'LspFormat', function(_)
        vim.lsp.buf.format()
    end, { desc = 'Format current buffer with LSP' })

end

-- -- document existing key chains
-- require('which-key').register {
--   ['<leader>c'] = { name = '[C]ode', _ = 'which_key_ignore' },
--   ['<leader>d'] = { name = '[D]ocument', _ = 'which_key_ignore' },
--   ['<leader>g'] = { name = '[G]it', _ = 'which_key_ignore' },
--   ['<leader>h'] = { name = 'More git', _ = 'which_key_ignore' },
--   ['<leader>r'] = { name = '[R]ename', _ = 'which_key_ignore' },
--   ['<leader>s'] = { name = '[S]earch', _ = 'which_key_ignore' },
--   ['<leader>w'] = { name = '[W]orkspace', _ = 'which_key_ignore' },
-- }

-- Enable the following language servers
--  Feel free to add/remove any LSPs that you want here. They will automatically be installed.
--
--  Each entry is a `vim.lsp.Config` merged over the defaults nvim-lspconfig
--  ships in its `lsp/<name>.lua`, so overrides go under `settings`, and
--  `filetypes` overrides which buffers the server attaches to.
local servers = {
    -- clangd = {},
    gopls = {},
    pyright = {},
    rust_analyzer = {},
    ts_ls = {},
    -- html = { filetypes = { 'html', 'twig', 'hbs'} },
    eslint = {},
    jsonls = {},
    marksman = {},
    solidity = {},

    lua_ls = {
        settings = {
            Lua = {
                workspace = { checkThirdParty = false },
                telemetry = { enable = false },
            },
        },
    },
}

-- nvim-cmp supports additional completion capabilities, so broadcast that to servers
local capabilities = require('cmp_nvim_lsp').default_capabilities()

-- Applied to every server, under its own config.
vim.lsp.config('*', {
    capabilities = capabilities,
    on_attach = on_attach,
})

for server, config in pairs(servers) do
    vim.lsp.config(server, config)
end

require('mason').setup()

-- Installs anything missing, then enables each installed server for us --
-- `automatic_enable` defaults to true and calls vim.lsp.enable() on our behalf.
require('mason-lspconfig').setup {
    ensure_installed = vim.tbl_keys(servers),
}

-- [[ Configure nvim-cmp ]]
-- See `:help cmp`
local cmp = require 'cmp'
local luasnip = require 'luasnip'
require('luasnip.loaders.from_vscode').lazy_load()
luasnip.config.setup {}

local has_words_before = function()
    unpack = unpack or table.unpack
    local line, col = unpack(vim.api.nvim_win_get_cursor(0))
    return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match '%s' == nil
end

cmp.setup {
    snippet = {
        expand = function(args)
            luasnip.lsp_expand(args.body)
        end,
    },
    mapping = cmp.mapping.preset.insert {
        ['<C-n>'] = cmp.mapping.select_next_item(),
        ['<C-p>'] = cmp.mapping.select_prev_item(),
        ['<C-d>'] = cmp.mapping.scroll_docs(-4),
        ['<C-f>'] = cmp.mapping.scroll_docs(4),
        ['<C-Space>'] = cmp.mapping.complete {},
        -- ['<Tab>'] = cmp.mapping.confirm {},
        ['<Tab>'] = cmp.mapping(function(fallback)
            if cmp.visible() then
                cmp.confirm {}
            elseif luasnip.expand_or_jumpable() then
                luasnip.expand_or_jump()
            elseif has_words_before() then
                cmp.complete()
            else
                fallback()
            end
        end),
    },
    sources = {
        { name = 'nvim_lsp' },
        { name = 'luasnip' },
    },
}

-- [[ Configure nvim-tree ]]
-- See :help nvim-tree
local function my_on_attach(bufnr)
    local api = require 'nvim-tree.api'

    local function opts(desc)
        return { desc = 'nvim-tree: ' .. desc, buffer = bufnr, noremap = true, silent = true, nowait = true }
    end

    -- default mappings
    api.config.mappings.default_on_attach(bufnr)

    -- custom mappings
    vim.keymap.set('n', '?', api.tree.toggle_help, opts 'Help')
    vim.keymap.set('n', '<C-n>', api.node.open.horizontal, opts 'Open Horizontal Split')
    vim.keymap.set('n', '<C-x>', api.tree.close, opts 'Close')
    vim.keymap.set('n', 't', api.node.open.tab, opts 'Open: New Tab')
end

-- pass to setup along with your other options
require('nvim-tree').setup {
    sort_by = 'case_sensitive',
    view = {
        width = 20,
        adaptive_size = false,
    },
    update_focused_file = {
        enable = true,
    },
    renderer = {
        group_empty = true,
    },
    on_attach = my_on_attach,
    actions = {
        open_file = {
            quit_on_open = true,
        },
    },
    git = {
        enable = true,
    },
    filters = {
        git_ignored = false,
    },
}

vim.keymap.set('n', '<C-x>', ':NvimTreeToggle<CR>')

-- [[Configure nvim-lualine]]
require('lualine').setup {
    sections = {
        lualine_c = {
            {
                'filename',
                path = 1,
            },
        },
    },
}

