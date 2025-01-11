import unusedImports from 'eslint-plugin-unused-imports';
import preferArrow from 'eslint-plugin-prefer-arrow';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ['**/*.{js,jsx,mjs,cjs,d.ts}'],
    },
    {
        plugins: {
            'unused-imports': unusedImports,
            'prefer-arrow': preferArrow,
        },

        rules: {
            'no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_.*',
                    args: 'after-used',
                    argsIgnorePattern: '^_.*',
                },
            ],

            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': 'off',

            'prefer-arrow/prefer-arrow-functions': [
                'warn',
                {
                    disallowPrototype: true,
                    singleReturnOnly: false,
                    classPropertiesAllowed: false,
                },
            ],
        },
    },
    ...compat
        .extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended')
        .map(config => ({
            ...config,
            files: ['**/*.ts'],
        })),
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
];
