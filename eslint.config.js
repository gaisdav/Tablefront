import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'local-docs']),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // Type-aware rules (no-floating-promises, no-unnecessary-condition, ...) need the TS program.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  {
    // Project conventions from the spec, enforced by the linter instead of by review.
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // `as` is only allowed at a validated boundary, with an inline disable that states why.
      // `as const` is not a cast, so it stays allowed.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression:not([typeAnnotation.typeName.name="const"])',
          message:
            'Avoid `as` casts. At a validated boundary, disable this rule on the line with a reason.',
        },
        {
          selector: 'TSTypeAssertion',
          message: 'Avoid `<T>value` assertions. Use a validated boundary with a reason instead.',
        },
      ],
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
    },
  },

  {
    // The spec allows `fetch` only inside the API layer.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through the modules in src/api.' },
      ],
    },
  },

  {
    // Config files live outside the app tsconfig, so they get no type-aware linting.
    files: ['*.config.{js,ts}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  prettier,
])
