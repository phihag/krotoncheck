'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const data_access = require('./data_access');
const loader = require('./loader');
const problems = require('./problems');
const utils = require('./utils');
const worker_utils = require('./worker_utils');


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
	db.fetch_all([{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: season_key},
	}], function(err, season) {
		if (err) {
			return callback(err);
		}

		const func = in_background ? bg_recheck : run_recheck;
		func(season, function(err, found) {
			if (err) {
				return callback(err);
			}

			if (store) {
				problems.store(db, season, found, function(err) {
					if (err) {
						return callback(err);
					}

					callback(null, found);
				});
			} else {
				callback(null, found);
			}
		});
	});
}

function bg_recheck(season, callback) {
	const worker_fn = path.join(__dirname, 'check_worker.js');

	worker_utils.in_background(worker_fn, season, function(err, res) {
		if (err) return callback(err);
		const found = res.found;
		assert(Array.isArray(found));
		callback(null, found);
	});
}

function run_recheck(season, callback) {
	loader.load_season_data(season, function(err) {
		if (err) return callback(err);

		data_access.enrich(season);

		let found = Array.from(check(season));

		// Strip out late notes when there are other messages about this match
		const problems_about = new Set();
		for (const p of found) {
			if (p.teammatch_id && (p.type !== 'latenote')) {
				problems_about.add(p.teammatch_id);
			}
		}
		found = found.filter(p => {
			if (p.type !== 'latenote') {
				return true;
			}
			assert(p.teammatch_id);
			return !problems_about.has(p.teammatch_id);
		});

		problems.enrich(season, found);

		callback(null, found);
	});
}

module.exports = {
	run_recheck,
	recheck,
	CHECKS,
	CHECKS_BY_NAME,
	CHECK_NAMES,
};