'use strict';

const downloads = require('./downloads');
const render = require('./render');
const check = require('./check');
const utils = require('./utils');
const problems = require('./problems');
const kc_email = require('./kc_email');


function add_handler(req, res, next) {
	let m = /.*\?id=([A-Za-z0-9-]{36})$/.exec(req.body.url);
	if (!m) {
		m = /^([A-Za-z0-9-]{36})$/.exec(req.body.url);
	}
	if (!m) {
		return next(new Error('cannot find tournament ID'));
	}
	const tournament_id = m[1];
	const name = req.body.name;
	const season_key = req.body.season_key;
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

function calc_receivers_display(receivers) {
	if (!receivers) return [];
	const res = receivers.map(r => {
		return {
			email: r.email,
			stb_filter: r.stb_filter,
			region_filter: r.region_filter,
			receiver_json: JSON.stringify(r),
		};
	});
	res.sort(utils.cmp_key('email'));
	return res;
}

function show_handler(req, res, next) {
	const season_key = req.params.season_key;
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: season_key},
	}, {
		queryFunc: 'findOne',
		collection: 'problems',
		query: {key: season_key},
	}, {
		queryFunc: 'find',
		collection: 'autoruns',
		query: {season_key: season_key},
	}], function(season, problems_struct, autoruns) {
		const downloads_inprogress = downloads.inprogress_by_season(season.key);
		downloads_inprogress.forEach(downloads.annotate);
		if (problems_struct) {
			problems.prepare_render(season, problems_struct.found);
		}

		const display_receivers = calc_receivers_display(season.receivers);
		for (const ar of autoruns) {
			ar.display_receivers = calc_receivers_display(ar.receivers);
		}

		render(req, res, next, 'season_show', {
			display_receivers: display_receivers,
			season,
			autoruns,
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

function receiver_add_handler(req, res, next) {
	if (!req.body.email) {
		return next(new Error('Missing field email'));
	}
	const receiver = {
		email: req.body.email,
		region_filter: req.body.region_filter,
		stb_filter: req.body.stb_filter,
	};
	req.app.db.seasons.update({key: req.params.season_key},	{$addToSet: {receivers: receiver}}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	});
}

function receiver_delete_handler(req, res, next) {
	if (!req.body.receiver_json) {
		return next(new Error('Missing receiver definition'));
	}
	const receiver = JSON.parse(req.body.receiver_json);
	req.app.db.seasons.update({key: req.params.season_key},	{$pull: {receivers: receiver}}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
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

function change_handler(req, res, next) {
	const fields = {};
	for (const field_name of [
			'vrldate_o19_hr',
			'vrldate_u19_hr',
			'vrldate_o19_rr',
			'vrldate_u19_rr',
			'lastdate_olrl',
			'lastdate_o19',
			'lastdate_u19',
			'sg_csv',
			'lastdate_hr',
			'tournament_id',
			'buli_tournament_id',
			'qualifying_youth_groups',
			'bws',
			]) {
		fields[field_name] = req.body[field_name];
	}

	req.app.db.seasons.update({key: req.params.season_key},	{$set: fields}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	});
}

function recheck_handler(req, res, next) {
	check.recheck(req.app.db, req.params.season_key, req.app.config('check_background'), function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/');
	}, true);
}

function check_handler(req, res, next) {
	check.recheck(req.app.db, req.params.season_key, req.app.config('check_background'), function(err, problems) {
		if (err) return next(err);
		utils.render_json(res, problems);
	}, false);
}

function email_preview(req, res, next) {
	const message = req.body.message;

	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}, {
		queryFunc: 'findOne',
		collection: 'problems',
		query: {key: req.params.season_key},
	}], function(season, problems_struct) {
		problems.prepare_render(season, problems_struct.found);

		kc_email.craft_emails(season, season.receivers, problems_struct, message, null, null, function(err, rendered) {
			if (err) return next(err);

			render(req, res, next, 'email_previews', {
				rendered,
				rendered_json: JSON.stringify(rendered),
				message,
				season,
				enable_sendnow_form: true,
			});
		});
	});
}

function email_send(req, res, next) {
	const message = req.body.message;

	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}, {
		queryFunc: 'findOne',
		collection: 'problems',
		query: {key: req.params.season_key},
	}], function(season, problems_struct) {
		problems.prepare_render(season, problems_struct.found);

		kc_email.craft_emails(season, season.receivers, problems_struct, message, null, null, function(err, crafted) {
			if (err) return next(err);

			kc_email.sendall(req.app.config, crafted, (err, errors) => {
				if (err) {
					return next(err);
				}
				if (errors.length > 0) {
					return next(err);
				}

				render(req, res, next, 'email_sent', {
					season,
				});
			});
		});
	});
}


module.exports = {
	add_dialog_handler,
	add_handler,
	change_handler,
	check_handler,
	email_preview,
	email_send,
	ignore_handler,
	recheck_handler,
	receiver_add_handler,
	receiver_delete_handler,
	show_handler,
	show_problems_handler,
	unignore_handler,
};
