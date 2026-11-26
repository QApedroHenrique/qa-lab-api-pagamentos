/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/matchers.js'],
  testTimeout: 20000,
  verbose: true,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports/jest',
        filename: 'index.html',
        pageTitle: 'Relatório de testes — API de Pagamentos (QA Lab)',
        expand: true,
        inlineSource: true,
      },
    ],
  ],
};
