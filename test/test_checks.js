'use strict';

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');

const check = require('../src/check');
const data_access = require('../src/data_access');
const loader = require('../src/loader');
const utils = require('../src/utils');


const CHECKS_DIR = path.join(__dirname, 'expected');


function setup_test(callback) {
	const test_tasks = data_access.ALL_TASKS.slice();
	test_tasks.push.apply(test_tasks, ['buli_playermatches', 'buli_teammatches', 'buli_players', 'buli_teams']);

	loader.load_data(path.join(__dirname, 'testdata'), test_tasks, function(err, data) {
		if (err) return callback(err);
		const season = {
			key: 'testseason',
			data,
			check_now: 1489078800000,
		};
		data_access.enrich(season);
		callback(err, season);
	});
}

setup_test(function(err, season) {
	if (err) throw err;

	describe('checks', function() {
		async.each(check.CHECK_NAMES, function(check_name, cb) {
			var expected_fn = path.join(CHECKS_DIR, check_name + '.json');
			fs.readFile(expected_fn, {encoding: 'utf8'}, (err, expected_json) => {
				if (err) return cb(err);
				const expected = JSON.parse(expected_json);
				expected.sort(utils.cmp_key('message'));

				it(check_name, (done) => {
					const check_func = check.CHECKS_BY_NAME[check_name];
					const results = Array.from(check_func(season));
					results.sort(utils.cmp_key('message'));
					assert.deepStrictEqual(results, expected);
					done();
				});
				cb();
			});
		}, function(err) {
			if (err) {
				throw err;
			}
			run();
		});
	});
});
