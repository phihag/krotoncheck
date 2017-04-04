'use strict';

var assert = require('assert');

var data_utils = require('../src/data_utils');


describe('utils', function() {
	it('extract_names', function() {
		assert.deepStrictEqual(data_utils.extract_names(''), []);
		assert.deepStrictEqual(
			data_utils.extract_names('Katharina Diks (BV RW Wesel) / Benedikt Késtnär, Manuel Lappe (BC Phönix Hövelhof)'),
			['Katharina', 'Diks', 'Benedikt', 'Késtnär', 'Manuel', 'Lappe']);
	});
});
