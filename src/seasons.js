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
	}], function(season) {
		var downloads_inprogress = downloads.inprogress_by_season(season.key);

		render(req, res, next, 'season_show', {
			season: season,
			downloads_inprogress: downloads_inprogress,
		});
	});
}

function recheck_handler(req, res, next) {
	check.recheck(req.app.db, req.params.season_key, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	});
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
};
