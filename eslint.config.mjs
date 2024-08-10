import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

export default [ {
    ignores: [ 'build/**/*', 'test/**/*' ],
    plugins: {
        '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.commonjs,
            Atomics: 'readonly',
            SharedArrayBuffer: 'readonly',
        },

        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: 'module',
    },

    rules: {
        quotes: [ 'warn', 'single' ],
        'array-bracket-spacing': [ 'warn', 'always' ],
        'space-before-blocks': [ 'warn', 'always' ],
        'arrow-body-style': [ 'warn', 'as-needed' ],
        'arrow-parens': [ 'warn', 'as-needed' ],

        'arrow-spacing': [ 'warn', {
            before: true,
            after: true,
        } ],
    },
} ];