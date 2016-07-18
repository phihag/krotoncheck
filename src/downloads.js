'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var request = require('request');
var url = require('url');

var utils = require('./utils');

const BASE_URL = 'http://www.turnier.de/';
const DOWNLOADS_ROOT = path.join(path.dirname(__dirname), 'data/download_cache/');

const ALL_TASKS = [
    'players',
    'playermatches',
    'teammatches',
    'clubs',
    'playerteam',
    'locations',
    'clubranking',
    'matchfields',
];

function calc_url(task_name, tournament_id) {
    switch(task_name) {
    case 'playermatches':
    case 'teammatches':
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

        login_url = 'http://www.turnier.de/member/login.aspx?returnurl=%2fdefault.aspx';

        request.post({
            url: login_url,
            form: form_data,
            jar: jar,
        }, function(err) {
            if (err) {
                return cb(err);
            }

            cb(null);
        });
    });
}


// started_cb gets called once the download job, with (err, download) as an argument
// done_cb gets called once the download is finished, again with (err, download)
function download_season(config, db, season, started_cb, done_cb) {
    var tournament_id = season.tournament_id;

    async.waterfall([function(cb) {
        utils.ensure_dir(DOWNLOADS_ROOT, cb);
    }, function(cb) {
        db.downloads.insert({
            season_key: season.key,
            status: 'started',
            started_timestamp: Date.now(),
            tasks: ALL_TASKS,
            file_sizes: {},
            _id: db.downloads.autonum(),
        }, cb);
    }, function(dl, cb) {
        var download_dir = path.join(DOWNLOADS_ROOT, dl._id);
        utils.ensure_dir(download_dir, function(err) {
            cb(err, dl, download_dir);
        });
    }], function(err, dl, download_dir) {
        started_cb(err, dl);

        if (err) {
            return done_cb(err);
        }

        var jar = request.jar();
        run_login(config, jar, function() {
            async.each(ALL_TASKS, function(task_name, cb) {
                var req = request({
                    url: calc_url(task_name, tournament_id),
                    jar: jar,
                });

                var encountered_error = false;
                function on_error(err) {
                    if (encountered_error) {
                        return;
                    }
                    encountered_error = true;
                    cb(err);
                }

                req.on('error', on_error);
                var pipe = req.pipe(fs.createWriteStream(calc_filename(download_dir, task_name), {
                    encoding: 'binary',
                }));
                pipe.on('error', on_error);
                pipe.on('finish', function() {
                    if (!encountered_error) {
                        cb();
                    }
                });
            }, function(err) {
                var fields = (err ? {
                    status: 'error',
                    error_message: err.message,
                } : {
                    status: 'finished'
                });
                fields.done_timestamp = Date.now();

                db.downloads.update({_id: dl._id}, {$set: fields}, function(db_err) {
                    done_cb(err || db_err);
                });
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
        download_season(req.app.config, req.app.db, season, function(err, dl) {
            if (err) {
                dl = {
                    status: 'error',
                    message: err.message,
                };
            }

            utils.render_json(res, {
                download: dl,
            });
        }, function(err, dl) {
            console.log('TODO: download done: ', err, dl);
            console.log('TODO: should start analysis now');
        });
    });
}

module.exports = {
    start_handler: start_handler,
};