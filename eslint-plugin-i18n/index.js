'use strict';

module.exports = {
  rules: {
    'only-english-or-code': require('./lib/rules/only-english-or-code'),
    'allowed-in-shadow-dom': require('./lib/rules/allowed-in-shadow-dom'),
  },
  rulesConfig: {
    'only-english-or-code': 1,
    'allowed-in-shadow-dom': 1,
  },
  configs: {
    recommended: {
      plugins: [
        'i18n',
      ],
      rules: {
        'i18n/only-english-or-code': 'warn',
        'i18n/allowed-in-shadow-dom': 'warn',
      },
    },
  },
};
