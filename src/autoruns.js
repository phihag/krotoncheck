'use strict';

const assert = require('assert');
const async = require('async');
const cron = require('cron');

const downloads = require('./downloads');
const kc_email = require('./kc_email');
const problems = require('./problems');
const render = require('./render');

function run(config, db, ar_id) {
	async.waterfall([
		function(cb) {
			db.autoruns.findOne({_id: ar_id}, (err, ar) => {
				if (err) return cb(err);
				if (!ar) return cb(new Error('Cannot find autorun ' + ar_id));
				cb(err, ar);
			});
		},
		function(ar, cb) {
			db.seasons.findOne({key: ar.season_key}, (err, season) => {
				if (err) return cb(err);
				if (!season) return cb(new Error('Cannot find season ' + ar.season_key));
				cb(err, ar, season);
			});
		},
		function(ar, season, cb) {
			const fake_app = {config, db};
			downloads.download_job(
				fake_app, season, () => {},
				(err, dl, found) => cb(err, ar, season, dl, found));
		},
		function(ar, season, dl, found, cb) {
			assert(Array.isArray(found));
			problems.prepare_render(season, found);
			const problems_struct = {found};
			const message_bottom = 'Automatisch verschickte E-Mail. Job-ID: ' + ar.name + ', schedule ' + ar.schedule;

			kc_email.craft_emails(
				season, ar.receivers, problems_struct,
				null, message_bottom,
				ar.add_receivers,
				(err, crafted) => cb(err, ar, season, dl, found, crafted)
			);
		}, function(ar, season, dl, found, crafted, cb) {
			kc_email.sendall(
				config, crafted,
				err => cb(err, ar, season, dl, found, crafted)
			);
		},
		function(ar, season, dl, found, crafted, cb) {
			db.autoruns.update({_id: ar_id}, {$set: {last_success: Date.now()}}, {}, (err) => cb(err));
		},
	], function(err) {
		if (err) {
			console.error('Autorun ' + ar_id + ' failed: ' + err.message + ' ' + err.stack + ' (' + err + ')');
			return;
		}
	});
}

const jobs = new Map();
function setup(config, db, ar, cb) {
	const job = new cron.CronJob({
		cronTime: ar.schedule,
		onTick: (function() {
			run(config, db, ar._id);
		}),
		start: false,
		timeZone: 'Europe/Berlin',
	});
	jobs.set(ar._id, job);
	job.start();
	cb();
}

function unsetup(ar_id, cb) {
	const job = jobs.get(ar_id);
	if (!job) {
		cb(new Error('Could not find autorun ' + ar_id));
		return;
	}
	job.stop();
	jobs.delete(ar_id);
	cb();
}

function init(config, db, callback) {
	db.autoruns.find({}, (err, ars) => {
		if (err) return callback(err);

		async.each(ars, (ar, cb) => setup(config, db, ar, cb), callback);
	});
}

function create_handler(req, res, next) {
	const season_key = req.params.season_key;
	if (!season_key) {
		return next(new Error('Missing field season_key'));
	}
	const schedule = req.body.schedule;
	if (!schedule) {
		return next(new Error('Missing field schedule'));
	}
	const name = req.body.name;
	if (!name) {
		return next(new Error('Missing field name'));
	}

	const arun = {
		_id: req.app.db.autoruns.autonum(),
		season_key,
		schedule,
		name,
		receivers: [],
	};

	req.app.db.autoruns.insert(arun, function(err) {
		if (err) return next(err);
		setup(req.app.config, req.app.db, arun, function(err) {
			if (err) return next(err);

			res.redirect(req.app.root_path + 's/' + encodeURIComponent(season_key) + '/#autorun_' + arun._id);
		});
	});
}

function delete_handler(req, res, next) {
	const season_key = req.params.season_key;
	if (!season_key) {
		return next(new Error('Missing field season_key'));
	}
	const ar_id = req.params.autorun_id;
	if (!ar_id) {
		return next(new Error('Missing field autorun_id'));
	}

	async.waterfall([
		cb => unsetup(ar_id, cb),
		function(cb) {
			req.app.db.autoruns.remove({_id: ar_id}, {}, cb);
		},
	], function(err) {
		if (err) next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(season_key));
	});
}

function edit_handler(req, res, next) {
	const season_key = req.params.season_key;
	if (!season_key) {
		return next(new Error('Missing field season_key'));
	}
	const ar_id = req.params.autorun_id;
	if (!ar_id) {
		return next(new Error('Missing field autorun_id'));
	}

	const add_receivers = {
		all_stbs: !! req.body.all_stbs,
		all_bws: !! req.body.all_bws,
	};

	async.waterfall([
		(cb) => {
			req.app.db.autoruns.update({_id: ar_id}, {$set: {
				add_receivers,
			}}, cb);
		},
	], (err) => {
		if (err) next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(season_key));
	});
}

function receiver_add_handler(req, res, next) {
	if (!req.body.email) {
		return next(new Error('Missing field email'));
	}
	const ar_id = req.params.autorun_id;
	if (!ar_id) {
		return next(new Error('Missing field autorun_id'));
	}
	const receiver = {
		email: req.body.email,
		region_filter: req.body.region_filter,
		stb_filter: req.body.stb_filter,
	};
	req.app.db.autoruns.update({_id: ar_id}, {$addToSet: {receivers: receiver}}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/#autorun_' + ar_id);
	});
}

function receiver_delete_handler(req, res, next) {
	const ar_id = req.params.autorun_id;
	if (!ar_id) {
		return next(new Error('Missing field autorun_id'));
	}
	if (!req.body.receiver_json) {
		return next(new Error('Missing receiver definition'));
	}
	const receiver = JSON.parse(req.body.receiver_json);

	req.app.db.autoruns.update({_id: ar_id}, {$pull: {receivers: receiver}}, {}, function(err) {
		if (err) return next(err);
		res.redirect(req.app.root_path + 's/' + encodeURIComponent(req.params.season_key) + '/#autorun_' + ar_id);
	});
}

function preview_handler(req, res, next) {
	const ar_id = req.params.autorun_id;
	if (!ar_id) {
		return next(new Error('Missing field autorun_id'));
	}

	const db = req.app.db;
	async.waterfall([
		(cb) => {
			db.autoruns.findOne({_id: ar_id}, (err, ar) => {
				if (err) return cb(err);
				if (!ar) return cb(new Error('Cannot find autorun ' + ar_id));
				cb(err, ar);
			});
		},
		(ar, cb) => {
			req.app.db.fetch_all([{
				queryFunc: '_findOne',
				collection: 'seasons',
				query: {key: ar.season_key},
			}, {
				queryFunc: 'findOne',
				collection: 'problems',
				query: {key: ar.season_key},
			}], (err, season, problems_struct) => cb(err, ar, season, problems_struct));
		},
		(ar, season, problems_struct, cb) => {
			const found = problems_struct.found;
			assert(Array.isArray(found));
			problems.prepare_render(season, problems_struct.found);

			const message_bottom = 'Automatisch verschickte E-Mail. Job-ID: ' + ar.name + ', schedule ' + ar.schedule;
			kc_email.craft_emails(
				season, ar.receivers, problems_struct,
				null, message_bottom,
				ar.add_receivers,
				(err, rendered) => cb(err, ar, season, found, rendered)
			);
		},
	], (err, ar, season, found, rendered) => {
		if (err) return next(err);

		render(req, res, next, 'email_previews', {
			rendered,
			season,
			rendered_json: JSON.stringify(rendered),
		});
	});
}


module.exports = {
	init,
	create_handler,
	delete_handler,
	edit_handler,
	receiver_add_handler,
	receiver_delete_handler,
	preview_handler,
};