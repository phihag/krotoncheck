'use strict';

var async = require('async');
var atomic_write = require('atomic-write');
var fs = require('fs');
var path = require('path');
var request = require('request');
var url = require('url');

var Baby = require('babyparse');

var utils = require('./utils');

const BASE_URL = 'http://www.turnier.de/';
const INPROGRESS_ROOT = path.join(path.dirname(__dirname), 'data/download_inprogress/');
const DATA_ROOT = path.join(path.dirname(__dirname), 'data/download_data/');
const HTTP_HEADERS = {
    'User-Agent': 'krotoncheck (phihag@phihag.de)',
};

const ALL_TASKS = [
    'players',
    'playermatches',
    'teammatches',
    'clubs',
    'playerteam',
    'locations',
    'clubranking',
    'matchfields',
    'teams',
];


var uniq_id = Date.now() + '-' + process.pid;
var dl_counter = 0;
var current_downloads = new Map();


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

// started_cb gets called once the download job, with (err, download) as an argument
// done_cb gets called once the download is finished, again with (err, download)
function download_season(config, season, started_cb, done_cb) {
    var tournament_id = season.tournament_id;

    async.waterfall([function(cb) {
        utils.ensure_dir(INPROGRESS_ROOT, cb);
    }, function(cb) {
        utils.ensure_dir(DATA_ROOT, cb);
    }, function(cb) {
        var download_id = uniq_id + '_' + dl_counter;
        dl_counter++;
        var download_dir = path.join(INPROGRESS_ROOT, download_id);
        utils.ensure_dir(download_dir, function(err) {
            var dl = {
                id: download_id,
                status: 'started',
                started_timestamp: Date.now(),
                tasks: ALL_TASKS,
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
                var req = request({
                    url: calc_url(task_name, tournament_id),
                    jar: jar,
                    headers: HTTP_HEADERS,
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
                var fn = calc_filename(download_dir, task_name);
                var pipe = req.pipe(fs.createWriteStream(fn, {
                    encoding: 'binary',
                }));
                pipe.on('error', on_error);
                pipe.on('finish', function() {
                    if (!encountered_error) {
                        cb();
                    }
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
        download_season(req.app.config, season, function(err, dl) {
            if (err) {
                dl = {
                    status: 'error',
                    message: err.message,
                };
            } else {
                current_downloads.set(dl.id, dl);
            }

            utils.render_json(res, {
                download: dl,
            });
        }, function(err, dl) {
            if (err) {
                dl.status = 'error';
                dl.done_timestamp = Date.now();
                dl.error = err;
                // TODO: clean up?
                return;
            }

            fs.rename(path.join(INPROGRESS_ROOT, dl.id), path.join(DATA_ROOT, dl.id), function(err) {
                dl.done_timestamp = Date.now();
                if (err) {
                    dl.status = 'error';
                    dl.error = err;
                    // TODO: clean up
                    return;
                }

                req.app.db.seasons.update({_id: season._id}, {
                    $set: {newest_download: dl},
                }, function(err) {
                    if (err) {
                        // TODO: clean up in DATA_ROOT
                        dl.status = 'error';
                        dl.error = err;
                        return;
                    }

                    current_downloads.delete(dl.id);

                    console.log('TODO: download done: ', dl);
                    console.log('TODO: should start analysis now');
                });
            });
        });
    });
}

function inprogress_by_season(season_key) {
    return utils.filterr(
        cd => cd.season_key === season_key,
        current_downloads.values());
}

function parse_csv(fn, cb) {
    // It seems crazily inefficient to read the file into memory,
    // but that seems to be the fastest way
    // See https://github.com/phihag/csv-speedtest for speed test
    fs.readFile(fn, {encoding: 'binary'}, function(err, fcontents) {
        if (err) return cb(err);
        fcontents = fcontents.trim();

        Baby.parse(fcontents, {
            header: true,
            complete: function(res) {
                if (res.errors.length > 0) {
                    return cb(new Error('Failed to parse ' + fn + ': ' + JSON.stringify(res.errors)));
                }
                var lines = res.data;
                cb(null, lines);
            },
        });
    });
}

function load_season_data(season, callback) {
    var dl = season.newest_download;
    if (!dl) {
        return callback(new Error('No downloads available'));
    }

    var dirname = path.join(DATA_ROOT, dl.id);

    var json_fn = path.join(dirname, 'cachev1.json');
    fs.readFile(json_fn, {encoding: 'utf8'}, function(err, fcontents) {
        if (err) {
            let data = {};
            async.each(dl.tasks, function(task_name, cb) {
                var csv_fn = path.join(dirname, task_name + '.csv');
                parse_csv(csv_fn, function(err, lines) {
                    if (err) return cb(err);
                    data[task_name] = lines;
                    cb(err);
                });
            }, function(err) {
                if (err) return callback(err);

                atomic_write.writeFile(json_fn, JSON.stringify(data), {encoding: 'utf8'}, function(err) {
                    callback(err, data);
                });
            });
        } else {
            let data = JSON.parse(fcontents);
            callback(null, data);
        }
    });
}

module.exports = {
    start_handler,
    inprogress_by_season,
    load_season_data,
};