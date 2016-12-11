'use strict';

const fs = require('fs');

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
function recheck(db, season_key, callback, store=false) {
	loader.load_season(db, season_key, function(err, season) {
		if (err) return callback(err);

		var found = Array.from(check(season));
		problems.enrich(season, found);

		if (store) {
			problems.store(db, season, found, callback);
		} else {
			console.log('found problems', found);
			callback(null, found);
		}
	});
}


module.exports = {
	recheck,
	CHECKS,
	CHECKS_BY_NAME,
	CHECK_NAMES,
};