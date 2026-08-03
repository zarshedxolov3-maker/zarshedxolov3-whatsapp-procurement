module.exports = {
  env: {
    node: true,
    es2022: true,
    'jest/globals': true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['jest'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    strict: ['error', 'global'],
  },
};
