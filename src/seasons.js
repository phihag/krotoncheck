'use strict';

var downloads = require('./downloads');
var render = require('./render');
var check = require('./check');
var utils = require('./utils');
var problems = require('./problems');


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
		if (problems_struct) {
			problems.prepare_render(season, problems_struct.found);
		}

		render(req, res, next, 'season_show', {
			season: season,
			downloads_inprogress: downloads_inprogress,
			problems: problems_struct ? problems_struct.found : [],
		});
	});
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
		if (problems_struct) {
			problems.prepare_render(season, problems_struct.found);
		}
		const colors = problems.color_render(problems_struct);
		render(req, res, next, 'season_problems_show', {
			season: season,
			colors: colors,
		});
	});
}

function ignore_handler(req, res, next) {
	req.app.db.seasons.update({key: req.params.season_key},	{$addToSet: {ignore: req.body.problem_id}}, {returnUpdatedDocs: true}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	});
}

function unignore_handler(req, res, next) {
	req.app.db.seasons.update({key: req.params.season_key},	{$pull: {ignore: req.body.problem_id}}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
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
	add_dialog_handler,
	add_handler,
	check_handler,
	ignore_handler,
	recheck_handler,
	show_handler,
	show_problems_handler,
	unignore_handler,
};
