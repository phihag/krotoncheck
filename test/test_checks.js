'use strict';

var assert = require('assert');
var async = require('async');
var fs = require('fs');
var path = require('path');

var check = require('../src/check');
var data_access = require('../src/data_access');
var utils = require('../src/utils');


const CHECKS_DIR = path.join(__dirname, 'expected');
const TEST_SEASON = {};


function setup_test(callback) {
	data_access.load_data(path.join(__dirname, 'testdata'), data_access.ALL_TASKS, function(err, data) {
		if (err) return callback(err);
		data_access.enrich(TEST_SEASON, data);
		callback(err, data);
	});
}

setup_test(function(err, data) {
	if (err) throw err;

	describe('checks', function() {
		async.each(check.CHECK_NAMES, function(check_name, cb) {
			var expected_fn = path.join(CHECKS_DIR, check_name + '.json');
			fs.readFile(expected_fn, {encoding: 'utf8'}, function(err, expected_json) {
				if (err) return cb(err);
				var expected = JSON.parse(expected_json);

				it(check_name, function(done) {
					var check_func = check.CHECKS_BY_NAME[check_name];
					var results = Array.from(check_func(TEST_SEASON, data));
					assert.deepStrictEqual(results, expected);
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
