import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import * as parserVue from 'vue-eslint-parser';

export default [
  {
    ignores: ['dist/**', '.wxt/**', '.output/**', 'node_modules/**', 'old_3.5/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: parserVue,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tseslint.parser,
      },
    },
  },
];
