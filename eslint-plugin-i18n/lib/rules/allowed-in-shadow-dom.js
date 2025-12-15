
'use strict';

const define = require('../utils/define');

const message = 'Not Allowed In Shadow DOM';
const regex = /document\.querySelector|document\.getElementById|DomDocumentHelper\.getDocument\(\)\.querySelector|DomDocumentHelper\.getDocument\(\)\.getElementById/;

module.exports = define(message, regex);
