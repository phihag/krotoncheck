'use strict';

var crypto = require('crypto');
var fs = require('fs');
var http = require('http');
var timezone = require('timezone');


function gen_token() {
	return crypto.randomBytes(32).toString('hex');
}

// filter on any iterable
function* filter(func, iterable) {
    for (let el of iterable) {
        if (func(el)) {
            yield el;
        }
    }
}

// Like filter, but return an array
function filterr(func, iterable) {
    return Array.from(filter(func, iterable));
}

function map_obj(keys, func) {
    var res = {};
    for (let k of keys) {
        res[k] = func(k);
    }
    return res;
}

function sort_by(ar, key) {
    ar.sort(function(v1, v2) {
        if (v1[key] < v2[key]) {
            return -1;
        } else if (v1[key] > v2[key]) {
            return 1;
        } else {
            return 0;
        }
    });
}

function today_iso8601() {
    var now = new Date();
    return format_iso8601(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function format_iso8601(year, month, day) {
    return year + '-' + pad(month, 2) + '-' + pad(day, 2);
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function multilineRegExp(regs, options) {
    return new RegExp(regs.map(
        function(reg){ return reg.source; }
    ).join(''), options);
}

function sha512(bytes) {
    var h = crypto.createHash('sha512');
    h.update(bytes, 'binary');
    return h.digest('hex');
}

function match_all(pattern, input) {
    var res = [];
    var match;
    while ((match = pattern.exec(input))) {
        res.push(match);
    }
    return res;
}

function values(obj) {
    var res = [];
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            res.push(obj[key]);
        }
    }
    return res;
}

function make_key(name) {
    return (
        name.toLowerCase().
        replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe').replace('ß', 'ss').
        replace(/[^a-z.0-9_.]/g, ''));
}

function cmp(a, b) {
    if (a < b) {
        return -1;
    } else if (a == b) {
        return 0;
    } else {
        return -1;
    }
}

function natcmp(as, bs){
    var a, b, a1, b1, i= 0, n, L;
    var rx = /(\.\d+)|(\d+(\.\d+)?)|([^\d.]+)|(\.\D+)|(\.$)/g;
    if (as=== bs) {
        return 0;
    }
    a = as.toLowerCase().match(rx);
    b = bs.toLowerCase().match(rx);
    L = a.length;
    while (i<L){
        if (!b[i]) {
            return 1;
        }
        a1 = a[i];
        b1 = b[i++];
        if (a1 !== b1){
            n = a1-b1;
            if (!isNaN(n)) {
                return n;
            }
        return a1>b1? 1:-1;
        }
    }
    return b[i] ? -1:0;
}

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

function render_json(res, data) {
    res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    });
    res.send(JSON.stringify(data));
}

function update(obj, new_info) {
    for (var k in new_info) {
        obj[k] = new_info[k];
    }
}

// Callback gets called with (error, response, body as string)
function download_page(url, cb) {
    http.get(url, function(res) {
        res.setEncoding('utf8'); // TODO read actual page encoding
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            cb(null, res, body);
        });
    }).on('error', function(e) {
        cb(e, null, null);
    });
}

function ensure_dir(dirname, cb) {
    fs.exists(dirname, function(exists) {
        if (exists) {
            return cb();
        }

        fs.mkdir(dirname, cb);
    });
}

const TZ_ID = 'Europe/Berlin';
var german_tz = timezone(require('timezone/' + TZ_ID));
function weekday(ts) {
    return parseInt(german_tz(ts, '%w'));
}

function parse_date(dstr) {
    const m = /^([0-9]{1,2})\.([0-9]{1,2})\.([0-9]{4})(?: ([0-9]{2}:[0-9]{2}:[0-9]{2}))?$/.exec(dstr);
    if (!m) {
        throw new Error('Cannot parse date ' + dstr);
    }
    const time_str = m[4] ? m[4] : '00:00:00';
    return german_tz(m[3] + '-' + pad(m[2], 2) + '-' + pad(m[1], 2) + ' ' + time_str, TZ_ID);
}

function next_day(ts) {
    return german_tz(ts, TZ_ID, '+1 day');
}

function monday_1200(ts) {
    const monday_str = german_tz(ts, TZ_ID, '+1 monday', '%Y-%m-%d 12:00:00');
    return german_tz(monday_str, TZ_ID);
}

function ts2str(ts) {
    return german_tz(ts, TZ_ID, '%Y-%m-%d %H:%M:%S');
}

function ts2dstr(ts) {
    return german_tz(ts, TZ_ID, '%d.%m.%Y');
}

function zip(...items) {
    return items[0].map((_, idx) => items.map(ar => ar[idx]));
}

function uniq(ar) {
    const res = [];
    for (const v of ar) {
        if (!res.includes(v)) {
            res.push(v);
        }
    }
    return res;
}

module.exports = {
    cmp,
    download_page,
    ensure_dir,
    escapeRegExp,
    filter,
    filterr,
    format_iso8601,
    gen_token,
    make_key,
    map_obj,
    match_all,
    monday_1200,
    multilineRegExp,
    natcmp,
    next_day,
    pad,
    parse_date,
    render_json,
    sha512,
    sort_by,
    today_iso8601,
    ts2dstr,
    ts2str,
    uniq,
    update,
    values,
    weekday,
    zip,
};
