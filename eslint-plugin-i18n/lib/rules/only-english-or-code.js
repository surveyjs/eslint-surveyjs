
'use strict';

const define = require('../utils/define');

const message = 'non English or Code';
const regex = /[^\x00-\x7F]+/;

module.exports = define(message, regex);
