import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueTsConfig from '@vue/eslint-config-typescript';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueTsConfig(),
  prettier,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
];
