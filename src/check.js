'use strict';

const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const data_access = require('./data_access');
const loader = require('./loader');
const problems = require('./problems');
const utils = require('./utils');


const CHECK_NAMES = fs.readdirSync(__dirname + '/checks').filter(fn => /\.js$/.test(fn)).map(fn => /^(.*)\.js$/.exec(fn)[1]);
const CHECKS_BY_NAME = utils.map_obj(CHECK_NAMES, cn => require('./checks/' + cn));
const CHECKS = utils.values(CHECKS_BY_NAME);


// Yields all problems
function* check(season) {
	if (!season.check_now) {
		season.check_now = Date.now();
	}

	for (const check_name of CHECK_NAMES) {
		const check = CHECKS_BY_NAME[check_name];
		try {
			yield* check(season);
		} catch(e) {
			console.error(e);
			yield {
				type: 'internal-error',
				header: 'Interner Fehler in Überprüfung ' + check_name,
				message: e.message + '\n' + e.stack,
			};
		}
	}
}

// Runs a new check and stores the results in the database
// cb gets called with err, if any
function recheck(db, season_key, in_background, callback, store=false) {
	loader.load_season(db, season_key, function(err, season) {
		if (err) return callback(err);

		const func = in_background ? bg_recheck : run_recheck;
		func(season, function(err, found) {
			if (store) {
				problems.store(db, season, found, function(err) {
					if (err) return callback(err);

					callback(null, found);
				});
			} else {
				callback(null, found);
			}
		});
	});
}

function bg_recheck(season, callback) {
	const season_json = JSON.stringify(season);

	// node.js IPC does not seem suitable to extremely large structures like season right now.
	// Therefore, run a child program.
	const worker_fn = path.join(__dirname, 'check_worker.js');

	const child = child_process.execFile('node', [worker_fn], {maxBuffer: 1024 * 1024 * 1024}, (err, stdout) => {
		if (err) return callback(err);

		const res = JSON.parse(stdout);
		if (res.error) {
			return callback(res.error);
		}
		const found = res.found;

		assert(Array.isArray(found));
		callback(null, found);
	});
	child.stdin.setEncoding('utf-8');
	child.stdin.write(season_json);
	child.stdin.end();
}

function run_recheck(season, callback) {
	data_access.enrich(season);

	var found = Array.from(check(season));
	problems.enrich(season, found);

	callback(null, found);
}

module.exports = {
	run_recheck,
	recheck,
	CHECKS,
	CHECKS_BY_NAME,
	CHECK_NAMES,
};