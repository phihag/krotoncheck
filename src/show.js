'use strict';

const render = require('./render');


function season_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}], function(season) {
		render(req, res, next, 'show_season', {
			season: season,
		});
	});
}

function player_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}], function(season) {
		render(req, res, next, 'show_player', {
			season: season,
		});
	});
}

module.exports = {
	player_handler,
	season_handler,
};
