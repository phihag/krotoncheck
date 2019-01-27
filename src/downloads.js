'use strict';

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');
const request = require('request');
const stripBomStream = require('strip-bom-stream');
const url = require('url');

const utils = require('./utils');
const data_access = require('./data_access');

const BASE_URL = 'https://www.turnier.de/';
const INPROGRESS_ROOT = path.join(path.dirname(__dirname), 'data/download_inprogress/');
const DATA_ROOT = path.join(path.dirname(__dirname), 'data/download_data/');
const HTTP_HEADERS = {
	'User-Agent': 'krotoncheck (phihag@phihag.de)',
};


let dl_counter = 0;
const current_downloads = new Map();


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
	case 'itemcomments':
	case 'matchcomments':
	case 'matchlog':
		return (BASE_URL +
			'sport/admin/export' + task_name + '.aspx' +
			'?id=' + encodeURIComponent(tournament_id) + '&ft=1&sd=20000101000000&ed=20990101000000');
	case 'clubranking':
		return BASE_URL + 'sport/' + task_name + '_export.aspx?id=' + encodeURIComponent(tournament_id) + '&ft=1&cid=0';
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
	const login_dialog_url = BASE_URL + 'user';

	request.get({
		url: login_dialog_url,
		jar: jar,
		headers: HTTP_HEADERS,
	}, function(err, _, html) {
		if (err) {
			return cb(err);
		}

		const m = /<form\s+(?:method="post"\s+)?action="(\/user[^"]*)"[^>]*>([\s\S]*?)<\/form>/.exec(html);
		if (!m) {
			return cb(new Error('Cannot find login form'));
		}

		const [, login_path, form_html] = m;

		const input_vals = utils.match_all(/<input\s+(?:[a-z0-9_-]+="[^"]*"\s+)*?name="([^"]+)"\s+(?:[a-z0-9_-]+="[^"]*"\s+)*?value="([^"]*)"/g, form_html);
		const form_data = {};
		for (let iv of input_vals) {
			let [, key, value] = iv;
			form_data[key] = value;
		}
		form_data['Login'] = config('tournament_user');
		form_data['Password'] = config('tournament_password');

		let login_url = url.resolve(login_dialog_url, login_path);
		request.post({
			url: login_url,
			form: form_data,
			jar: jar,
			headers: HTTP_HEADERS,
		}, function(err, response) {
			if (err) {
				return cb(err);
			}
			if (response.statusCode != 302) {
				return cb(new Error('Unexpected login status code ' + response.statusCode));
			}

			cb(null);
		});
	});
}

function download_file(req, fn, cb) {
	let encountered_error = false;
	function on_error(err) {
		if (encountered_error) {
			return;
		}
		encountered_error = true;
		cb(err);
	}

	req.on('error', on_error);
	const pipe = req.pipe(stripBomStream()).pipe(fs.createWriteStream(fn, {
		encoding: 'binary',
	}));
	pipe.on('error', on_error);
	pipe.on('finish', function() {
		if (!encountered_error) {
			cb();
		}
	});
}

function log_verbose(config, msg) {
	if (config('verbose', false)) {
		console.log(msg);
	}
}

function download_task(config, season, jar, download_dir, task_name, cb) {
	const fn = calc_filename(download_dir, task_name);
	log_verbose(config, 'Downloading ' + season.name + ' / ' + task_name);
	const req = request({
		url: calc_url(task_name, season),
		jar: jar,
		headers: HTTP_HEADERS,
	});

	download_file(req, fn, (err) => {
		if (err) return cb(err);

		fs.stat(fn, (err, stats) => {
			if (err) return cb(err);

			if (stats.size === 0) {
				log_verbose(config, 'Download ' + season.name + ' / ' + task_name + ' is empty');

				return cb(new Error('Download ' + task_name + ' is empty'));
			}

			log_verbose(config, 'Finished downloading ' + season.name + ' / ' + task_name);

			cb();
		});
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
		const download_id = utils.now_filestamp() + '_' + process.pid + '_' + dl_counter;
		dl_counter++;
		const download_dir = path.join(INPROGRESS_ROOT, download_id);
		utils.ensure_dir(download_dir, function(err) {
			const tasks = data_access.ALL_TASKS.slice();
			if (season.buli_tournament_id) {
				const all_buli_tasks = data_access.ALL_TASKS;
				const use_buli_tasks = all_buli_tasks.filter(t => t !== 'clubranking'); // Not needed at the moment
				const buli_tasks = use_buli_tasks.map(t => 'buli_' + t);
				Array.prototype.push.apply(tasks, buli_tasks);
			}

			const dl = {
				id: download_id,
				status: 'started',
				started_timestamp: Date.now(),
				tasks: tasks,
				tasks_outstanding: tasks.slice(),
				tasks_error: [],
				season_key: season.key,
			};
			cb(err, dl);
		});
	}], function(err, dl) {
		started_cb(err, dl);

		if (err) {
			return done_cb(err, dl);
		}

		const jar = request.jar();
		run_login(config, jar, (err) => {
			if (err) return done_cb(err, dl);

			const download_dir = path.join(INPROGRESS_ROOT, dl.id);
			async.each(dl.tasks, (task_name, cb) => {
				utils.retry(
					config('retries', 3),
					(icb) => download_task(config, season, jar, download_dir, task_name, icb),
					function(err) {
						if (err) {
							dl.tasks_error.push(task_name);
						}

						utils.remove(dl.tasks_outstanding, task_name);
						cb(err);
					});
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
		download_job(req.app, season, (err, dl) => {
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
	}, (err, dl) => {
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

function annotate(dl) {
	let res = '';
	if ((dl.status == 'error') && dl.error) {
		res += 'Download fehlgeschlagen: ' + dl.error.message;
	} else if (dl.tasks_outstanding.length > 0) {
		res += 'Läuft (' + (
			(dl.tasks_outstanding.length > 4) ?
			(dl.tasks_outstanding.length + ' Dateien ausstehend') :
			dl.tasks_outstanding.join(',')
		) + ')';
	}
	if (dl.tasks_error.length > 0) {
		res += (res ? ', ' : '') + 'Fehler: ' + (dl.tasks_error.join(','));
	}
	dl.tasks_str = res;
}

module.exports = {
	annotate,
	download_job,
	BASE_URL,
	DATA_ROOT,
	start_handler,
	inprogress_by_season,
};