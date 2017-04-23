'use strict';

const path = require('path');

const data_access = require('./data_access');
const loader = require('./loader');
const render = require('./render');
const worker_utils = require('./worker_utils');

function show_handler(req, res, next) {
	const season_key = req.params.season_key;
	const worker_fn = path.join(__dirname, 'bulifinals_worker.js');
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: season_key},
	}], function(season) {
		worker_utils.in_background(worker_fn, season, function(err, wr) {
			if (err) return next(err);
			render(req, res, next, 'bulifinals_show', {
				season,
				info: wr.info,
			});
		});
	});
}

function run_calc(season, cb) {
	loader.load_season_data(season, (err) => {
		if (err) return cb(err);

		data_access.enrich(season);

		const data = season.data;

		const buli_teamcodes = new Set();
		for (const team of data.buli_teams) {
			if (team.DrawID === '00-BL1-F') {
				buli_teamcodes.add(team.code);
			}
		}

/*
		const players_by_team = new Map(); // team code -> set of player codes
		for (const t of buli_teamcodes.keys()) {
			players_by_team.set(t, new Set());
		}

		/*

		// TODO?

		for (const tm of data.buli_teammatches) {
			console.error(tm);
		}
		// TODO find all tms in 1. Bundesliga
		// TODO filter out Langenfeld
		// TODO Calc player names
		// TODO handle backup players
*/
		const info = 'TODO';
		cb(null, info);
	});
}

module.exports = {
	show_handler,
	run_calc,
};
