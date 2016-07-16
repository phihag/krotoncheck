'use strict';

var render = require('./render');
var utils = require('./utils');


function add_handler(req, res, next) {
	var m = /.*\?id=([A-Za-z0-9-]{36})$/.exec(req.body.url);
	if (!m) {
		return next(new Error('cannot find tournament ID'));
	}
	var tournament_id = m[1];
	var name = req.body.name;
	var season_id = req.body.season_id;
	if (! /^([a-z0-9]+)$/.test(season_id)) {
		return next(new Error('invalid season id'));
	}
	
	req.app.db.seasons.insert({
		key: season_id,
		tournament_id: tournament_id,
		name: name,
	}, function(err) {
		if (err) {
			return next(err);
		}
		res.redirect(req.app.root_path + 's/' + season_id);
	});
}

function add_dialog_handler(req, res, next) {
	render(req, res, next, 'seasons_add_dialog', {
		script_files: ['season_add_client.js'],
	});
}

function show_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}], function(season) {
		render(req, res, next, 'season_show', {
			season: season,
		});
	});
}

module.exports = {
	add_handler,
	add_dialog_handler,
	show_handler,
};
