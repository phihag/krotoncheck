'use strict';

var crypto = require('crypto');
var fs = require('fs');
var http = require('http');


function gen_token() {
	return crypto.randomBytes(32).toString('hex');
}

function size(obj) {
    var res = 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            res++;
        }
    }
    return res;
}

function filter_by(ar, key, value) {
    return ar.filter(function(v) {
        return v[key] === value;
    });
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

function ematch(pattern, input) {
    var m = pattern.exec(input);
    if (!m) {
        throw new Error('Could not find ' + pattern.source);
    }
    return m[1];
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


module.exports = {
    ematch: ematch,
    escapeRegExp: escapeRegExp,
    filter_by: filter_by,
    format_iso8601: format_iso8601,
    gen_token: gen_token,
    make_key: make_key,
    match_all: match_all,
    multilineRegExp: multilineRegExp,
    natcmp: natcmp,
    pad: pad,
    render_json: render_json,
    sha512: sha512,
    size: size,
    sort_by: sort_by,
    today_iso8601: today_iso8601,
    update: update,
    values: values,
};
