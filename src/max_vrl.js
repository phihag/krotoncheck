'use strict';

const async = require('async');

const loader = require('./loader');


function store(db, season, callback) {
	loader.load_season_table(season, 'clubranking', (err, cr_table) => {
		if (err) return callback(err);

		db.max_vrls.find({
			season_key: season.key,
		}, (err, mvs) => {
			if (err) return callback(err);



		});
		callback();
	});
}

module.exports = {
	store,
};
