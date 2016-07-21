'use strict';

var async = require('async');

var downloads = require('./downloads');

// Yields all problems
function* check(season, data) {

}

// Runs a new check and stores the results in the database
// cb gets called with err, if any
function recheck(db, season_key, callback, store=false) {
	async.waterfall([function(cb) {
		db.fetch_all([{
			queryFunc: '_findOne',
			collection: 'seasons',
			query: {key: season_key},
		}], cb);
	}, function(season, cb) {
		downloads.load_season_data(season, function(err, data) {
			cb(err, season, data);
		});
	}, function(season, data, cb) {
		var problems = Array.from(check(season, data));
		console.log('problems found: ', problems);
		// TODO actually save this in the season if store
		cb(null, problems);
	}], callback);
}


module.exports = {
	recheck,
};