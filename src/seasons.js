'use strict';

var downloads = require('./downloads');
var render = require('./render');
var check = require('./check');
var utils = require('./utils');


function add_handler(req, res, next) {
	var m = /.*\?id=([A-Za-z0-9-]{36})$/.exec(req.body.url);
	if (!m) {
		return next(new Error('cannot find tournament ID'));
	}
	var tournament_id = m[1];
	var name = req.body.name;
	var season_key = req.body.season_key;
	if (!season_key || (! /^[a-z0-9]+$/.test(season_key))) {
		return next(new Error('invalid season key'));
	}

	req.app.db.seasons.insert({
		key: season_key,
		tournament_id: tournament_id,
		name: name,
	}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + season_key);
	});
}

function add_dialog_handler(req, res, next) {
	render(req, res, next, 'seasons_add_dialog', {});
}

function show_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}, {
		queryFunc: 'findOne',
		collection: 'problems',
		query: {key: req.params.season_key},
	}], function(season, problems_struct) {
		var downloads_inprogress = downloads.inprogress_by_season(season.key);

		render(req, res, next, 'season_show', {
			season: season,
			downloads_inprogress: downloads_inprogress,
			problems: problems_struct ? problems_struct.found : [],
		});
	});
}

function colorize_problem(problem) {
	const tm = problem.teammatch;
	problem.color = tm ? (tm.ergebnisbestaetigt_user ? 'red' : 'yellow') : 'black';
	const m = /^[A-Z0-9]+-([A-Z0-9]+)-/.exec(tm.eventname);
	problem.region = m ? m[1] : 'Sonstige Region';
}

function color_render(problems_struct) {
	const problems = problems_struct ? problems_struct.found : [];

	problems.forEach(colorize_problem);

	const by_color = {};
	for (const problem of problems) {
		let col = by_color[problem.color];
		if (! col) {
			col = {
				color: problem.color,
				regions_map: {},
			};
			by_color[problem.color] = col;
		}

		let reg = col.regions_map[problem.region];
		if (! reg) {
			reg = {
				name: problem.region,
				teammatches_map: {},
			};
			col.regions_map[problem.region] = reg;
		}

		const tm = problem.teammatch;
		if (!tm.matchid) {
			throw new Error('Missing matchid');
		}
		let by_tm = reg.teammatches_map[tm.matchid];
		if (!by_tm) {
			by_tm = {
				teammatch: tm,
				turnier_url: problem.turnier_url,
				teammatch_url: problem.teammatch_url,
				teammatch_id: problem.teammatch_id,
				problems: [],
			};
			reg.teammatches_map[tm.matchid] = by_tm;
		}
		by_tm.problems.push(problem);
	}

	const color_list = [];
	for (const color_key in by_color) {
		const col = by_color[color_key];
		let keys = Object.keys(col.regions_map);
		keys.sort();
		col.regions = [];
		for (const k of keys) {
			const region = col.regions_map[k];
			region.teammatches = [];

			let tm_keys = Object.keys(region.teammatches_map);
			tm_keys.sort();
			for (const tmk of tm_keys) {
				const tm = region.teammatches_map[tmk];
				region.teammatches.push(tm);
			}

			col.regions.push(region);
		}

		color_list.push(col);
	}

	console.log(color_list[0].regions[0].teammatches[0].problems);
	return color_list;
}

function show_problems_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}, {
		queryFunc: 'findOne',
		collection: 'problems',
		query: {key: req.params.season_key},
	}], function(season, problems_struct) {
		const colors = color_render(problems_struct);
		render(req, res, next, 'season_problems_show', {
			season: season,
			colors: colors,
		});
	});
}

function recheck_handler(req, res, next) {
	check.recheck(req.app.db, req.params.season_key, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	}, true);
}

function check_handler(req, res, next) {
	check.recheck(req.app.db, req.params.season_key, function(err, problems) {
		if (err) return next(err);
		utils.render_json(res, problems);
	}, false);
}


module.exports = {
	add_handler,
	add_dialog_handler,
	show_handler,
	recheck_handler,
	check_handler,
	show_problems_handler,
};
