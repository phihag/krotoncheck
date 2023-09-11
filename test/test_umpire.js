'use strict';

const assert = require('assert').strict;

const { parse_names } = require('../src/umpire_mail');


describe('umpire parsing', function() {
	it('parse_names', function() {
		assert.deepStrictEqual(parse_names('Albert Aal / Benjamin Bosch'), ['Albert Aal', 'Benjamin Bosch']);
		assert.deepStrictEqual(parse_names('Albert Aal Benjamin Bosch'), ['Albert Aal', 'Benjamin Bosch']);
	});
});
