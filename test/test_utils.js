'use strict';

var assert = require('assert');

var utils = require('../src/utils');


describe('utils', function() {
	it('parse_date', function() {
		assert.strictEqual(utils.parse_date('11.11.2016 17:48:13'), 1478882893000);
		assert.strictEqual(utils.parse_date('14.11.2016 12:00:00'), 1479121200000);
		assert.strictEqual(utils.parse_date('14.11.2016 00:00:00'), 1479078000000);
		assert.strictEqual(utils.parse_date('14.11.2016'), 1479078000000);
	});

	it('next_day', function() {
		assert.strictEqual(utils.next_day(1478882893000), 1478969293000);
	});

	it('weekday', function() {
		assert.strictEqual(utils.weekday(1478882893000), 5);
		assert.strictEqual(utils.weekday(1479121200000), 1);
	});

	it('monday_1200', function() {
		assert.strictEqual(utils.monday_1200(utils.parse_date('11.11.2016 17:48:13')), 1479121200000);
		assert.strictEqual(utils.monday_1200(utils.parse_date('12.11.2016 12:01:02')), 1479121200000);
		assert.strictEqual(utils.monday_1200(utils.parse_date('13.11.2016 23:59:59')), 1479121200000);
		assert.strictEqual(utils.monday_1200(utils.parse_date('14.11.2016 23:59:59')), 1479121200000 + 7 * 24 * 3600000);
	});

	it('zip', function() {
		assert.deepStrictEqual(
			utils.zip([1, 2, 3], [4, 5, 6]),
			[[1, 4], [2, 5], [3, 6]]
		);
	});

	it('uniq', function() {
		assert.deepStrictEqual(
			utils.uniq([1, 2, 3, 1, 1, 1, 4, 5, 6, '1', 1, 4]),
			[1, 2, 3, 4, 5, 6, '1']
		);
	});

	it('cmp', function() {
		assert(utils.cmp('Horst Rosenstock', 'Anja Pliester') > 0);
		assert(utils.cmp('Horst Rosenstock', 'Horst Rosenstock') === 0);
		assert(utils.cmp('Anja Pliester', 'Horst Rosenstock') < 0);
	});

	it('find_last', function() {
		assert.deepStrictEqual(utils.find_last([1, 2, 4, -1, 4, 98, 77, 32], i => (i % 2) === 1), 77);
		assert.deepStrictEqual(utils.find_last([14, 2, 4, 44, 4, 98, 772, 32], i => (i % 2) === 1), undefined);
	});

	it('format_duration', function() {
		assert.deepStrictEqual(utils.format_duration(97200000), '1 Tag 3 Stunden');
		assert.deepStrictEqual(utils.format_duration(212400000), '2 Tage 11 Stunden');
		assert.deepStrictEqual(utils.format_duration(4200000), '1 Stunde 10 Minuten');
		assert.deepStrictEqual(utils.format_duration(55380000), '15 Stunden 23 Minuten');
	});

});
