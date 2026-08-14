import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'android', 'ios', 'scripts', 'dev-dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Só as regras clássicas de hooks (bugs reais, ex: dependency array
      // incompleta — foi exatamente esse tipo de bug que corrigimos hoje em
      // Play.tsx). O restante do "recommended" do react-hooks v7 traz regras
      // experimentais do React Compiler (purity, refs, immutability...) que
      // gerariam ~80 avisos de falso-positivo nesse código existente.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      // Débito técnico pré-existente grande — liga como aviso pra dar
      // visibilidade sem travar o build. Ir reduzindo aos poucos.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      // Só flagra valores "placeholder" nunca lidos antes de reatribuídos —
      // estilo, não bug (checado manualmente nas 3 ocorrências existentes).
      'no-useless-assignment': 'warn',
    },
  },
);
