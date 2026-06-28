/* ESLint flat config virá numa iteração futura; config clássica para o scaffold. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { node: true, es2022: true },
  ignorePatterns: ['dist/', 'node_modules/', 'src/database/migrations/'],
  rules: {},
};
