'use strict';

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');
const request = require('request');
const url = require('url');

const utils = require('./utils');
const data_access = require('./data_access');

const BASE_URL = 'https://www.turnier.de/';
const INPROGRESS_ROOT = path.join(path.dirname(__dirname), 'data/download_inprogress/');
const DATA_ROOT = path.join(path.dirname(__dirname), 'data/download_data/');
const HTTP_HEADERS = {
	'User-Agent': 'krotoncheck (phihag@phihag.de)',
};


var dl_counter = 0;
var current_downloads = new Map();


function calc_url(task_name, season) {
	let tournament_id = season.tournament_id;
	const m = /^buli_(.*)$/.exec(task_name);
	if (m) {
		assert(season.buli_tournament_id);
		tournament_id = season.buli_tournament_id;
		task_name = m[1];
	}

	switch(task_name) {
	case 'playermatches':
	case 'teammatches':
	case 'matchcomments':
	case 'matchlog':
		return (BASE_URL +
			'sport/admin/export' + task_name + '.aspx' +
			'?id=' + encodeURIComponent(tournament_id) + '&ft=1&sd=20000101000000&ed=20990101000000');
	case 'clubranking':
		return BASE_URL + 'sport/' + task_name + '_export.aspx?id=' + encodeURIComponent(tournament_id) + '&ft=1';
	case 'playerteam':
		return BASE_URL + 'sport/admin/export_' + task_name + '.aspx?id=' + encodeURIComponent(tournament_id) + '&ft=1';
	default:
		return BASE_URL + 'sport/admin/export' + task_name + '.aspx?id=' + encodeURIComponent(tournament_id) + '&ft=1';
	}
}

function calc_filename(download_dir, task_name) {
	return path.join(download_dir, task_name + '.csv');
}

function run_login(config, jar, cb) {
	var login_dialog_url = BASE_URL + 'member/login.aspx';

	request.get({
		url: login_dialog_url,
		jar: jar,
		headers: HTTP_HEADERS,
	}, function(err, _, html) {
		if (err) {
			return cb(err);
		}

		var m = /<form\s+method="post"\s+action="(\.\/login[^"]*)"([\s\S]*?)<\/form>/.exec(html);
		if (!m) {
			return cb(new Error('Cannot find login form'));
		}

		var [, login_path, form_html] = m;
		var input_vals = utils.match_all(/<input\s+(?:[a-z0-9-]+="[^"]*"\s+)*?name="([^"]+)"\s+(?:[a-z0-9-]+="[^"]*"\s+)*?value="([^"]*)"/g, form_html);
		var form_data = {};
		for (let iv of input_vals) {
			let [, key, value] = iv;
			form_data[key] = value;
		}
		form_data['ctl00$ctl00$ctl00$cphPage$cphPage$cphPage$pnlLogin$UserName'] = config('tournament_user');
		form_data['ctl00$ctl00$ctl00$cphPage$cphPage$cphPage$pnlLogin$Password'] = config('tournament_password');
		let login_url = url.resolve(login_dialog_url, login_path);

		request.post({
			url: login_url,
			form: form_data,
			jar: jar,
			headers: HTTP_HEADERS,
		}, function(err) {
			if (err) {
				return cb(err);
			}

			cb(null);
		});
	});
}

function download_file(req, fn, cb) {
	var encountered_error = false;
	function on_error(err) {
		if (encountered_error) {
			return;
		}
		encountered_error = true;
		cb(err);
	}

	req.on('error', on_error);
	const pipe = req.pipe(fs.createWriteStream(fn, {
		encoding: 'binary',
	}));
	pipe.on('error', on_error);
	pipe.on('finish', function() {
		if (!encountered_error) {
			cb();
		}
	});
}

// started_cb gets called once the download job, with (err, download) as an argument
// done_cb gets called once the download is finished, again with (err, download)
function download_season(config, season, started_cb, done_cb) {
	async.waterfall([function(cb) {
		utils.ensure_dir(INPROGRESS_ROOT, cb);
	}, function(cb) {
		utils.ensure_dir(DATA_ROOT, cb);
	}, function(cb) {
		var download_id = Date.now() + '-' + process.pid + '_' + dl_counter;
		dl_counter++;
		var download_dir = path.join(INPROGRESS_ROOT, download_id);
		utils.ensure_dir(download_dir, function(err) {
			const tasks = data_access.ALL_TASKS.slice();
			if (season.buli_tournament_id) {
				const buli_tasks = data_access.ALL_TASKS.map(t => 'buli_' + t);
				Array.prototype.push.apply(tasks, buli_tasks);
			}

			const dl = {
				id: download_id,
				status: 'started',
				started_timestamp: Date.now(),
				tasks: tasks,
				season_key: season.key,
			};
			cb(err, dl);
		});
	}], function(err, dl) {
		started_cb(err, dl);

		if (err) {
			return done_cb(err);
		}

		var jar = request.jar();
		run_login(config, jar, function() {
			var download_dir = path.join(INPROGRESS_ROOT, dl.id);
			async.each(dl.tasks, function(task_name, cb) {
				var fn = calc_filename(download_dir, task_name);
				var req = request({
					url: calc_url(task_name, season),
					jar: jar,
					headers: HTTP_HEADERS,
				});

				download_file(req, fn, cb);
			}, function(err) {
				if (err) {
					dl.done_timestamp = Date.now();
					dl.status = 'error';
					dl.error = err;
				}
				done_cb(err, dl);
			});
		});
	});
}

function start_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: req.params.season_key},
	}], function(season) {
		download_job(req.app, season, function(err, dl) {
			if (err) {
				utils.render_json({
					status: 'error',
					message: err.message,
				});

				return;
			}
			utils.render_json(res, {
				download: dl,
			});
		}, () => {});
	});
}

function download_job(app, season, cb_started, cb_finished)  {
	download_season(app.config, season, function(err, dl) {
		if (err) {
			cb_started(err, dl);
			return cb_finished(err, dl);
		}

		current_downloads.set(dl.id, dl);
		cb_started(err, dl);
	}, function(err, dl) {
		if (err) {
			dl.status = 'error';
			dl.done_timestamp = Date.now();
			dl.error = err;
			// TODO: clean up?
			cb_finished(err, dl);
			return;
		}

		fs.rename(path.join(INPROGRESS_ROOT, dl.id), path.join(DATA_ROOT, dl.id), function(err) {
			dl.done_timestamp = Date.now();
			if (err) {
				dl.status = 'error';
				dl.error = err;
				// TODO: clean up
				cb_finished(err, dl);
				return;
			}

			app.db.seasons.update({_id: season._id}, {
				$set: {newest_download: dl},
			}, function(err) {
				if (err) {
					// TODO: clean up in DATA_ROOT
					dl.status = 'error';
					dl.error = err;
					cb_finished(err, dl);
					return;
				}

				current_downloads.delete(dl.id);

				const check = require('./check');
				check.recheck(app.db, season.key, app.config('check_background'), function(err, found) {
					if (!err) {
						assert(Array.isArray(found));
					}

					cb_finished(err, dl, found);
				}, true);
			});
		});
	});
}

function inprogress_by_season(season_key) {
	return utils.filterr(
		cd => cd.season_key === season_key,
		current_downloads.values());
}


module.exports = {
	download_job,
	BASE_URL,
	DATA_ROOT,
	start_handler,
	inprogress_by_season,
};