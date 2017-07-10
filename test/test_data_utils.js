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

	it('parse_grouplist', function() {
		assert.deepStrictEqual(data_utils.parse_grouplist(''), []);
		assert.deepStrictEqual(
			data_utils.parse_grouplist('J01,J1,01-J12,S12,J12,123'),
			['J01', 'J1', '01-J12', 'S12', 'J12', '123']);
		assert.deepStrictEqual(
			data_utils.parse_grouplist(
				'Nord 1: S01, J01 # great!\n' +
				'\n # empty\n' +
				'\n' +
				'Nord 2: J26, S31, S32, S33, S34\n' +
				'Süd 1: J55, J56, S55\n' +
				'Süd 2: S76'),
			[
				'S01', 'J01',
				'J26', 'S31', 'S32', 'S33', 'S34',
				'J55', 'J56', 'S55',
				'S76',
			]);
	});
});
