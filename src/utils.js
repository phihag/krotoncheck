'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');

const timezone = require('timezone');


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
	const res = {};
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
	const now = new Date();
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
	} else if (a > b) {
		return 1;
	} else {
		return 0;
	}
}

function cmp_key(key) {
	return function(o1, o2) {
		const v1 = o1[key];
		const v2 = o2[key];
		return cmp(v1, v2);
	};
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

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function weekday_destr(ts) {
	return WEEKDAYS[weekday(ts)];
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

function ts2destr(ts) {
	return german_tz(ts, TZ_ID, '%d.%m.%Y %H:%M:%S');
}

function ts2timestr(ts) {
	return german_tz(ts, TZ_ID, '%H:%M:%S');
}

function ts2dstr(ts) {
	return german_tz(ts, TZ_ID, '%d.%m.%Y');
}

function same_day(ts1, ts2) {
	return ts2dstr(ts1) === ts2dstr(ts2);
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

function setdefault(map, key, makedefault) {
	assert(map instanceof Map);
	let val = map.get(key);
	if (val === undefined) {
		val = makedefault(key);
		map.set(key, val);
	}
	return val;
}

function get(map, key, makedefault) {
	assert(map instanceof Map);
	const val = map.get(key);
	return (val === undefined) ? makedefault(key) : val;
}

function make_index(ar, index_func) {
	const res = new Map();
	for (const el of ar) {
		res.set(index_func(el), el);
	}
	return res;
}

function make_multi_index(ar, index_func) {
	const res = new Map();
	for (const el of ar) {
		const values = setdefault(res, index_func(el), () => []);
		values.push(el);
	}
	return res;
}

function find_last(ar, func) {
	let res = undefined;
	for (const el of ar) {
		if (func(el)) {
			res = el;
		}
	}
	return res;
}

function map2obj(map) {
	const res = {};
	for (const [k, v] of map.entries()) {
		res[k] = v;
	}
	return res;
}

function format_duration(duration_ms) {
	const total_secs = duration_ms / 1000;
	const total_mins = total_secs / 60;
	const mins = Math.floor(total_mins) % 60;
	const total_hours = total_mins / 60;
	const hours = Math.floor(total_hours) % 24;
	const total_days = total_hours / 24;
	const days = Math.floor(total_days);

	if (total_days >= 1) {
		return ((days === 1) ? '1 Tag' : (days + ' Tage')) + ' ' + hours + ' Stunden';
	} else {
		return ((hours === 1) ? '1 Stunde' : (hours + ' Stunden')) + ' ' + mins + ' Minuten';
	}
}

module.exports = {
	cmp,
	cmp_key,
	download_page,
	ensure_dir,
	escapeRegExp,
	filter,
	filterr,
	format_duration,
	format_iso8601,
	gen_token,
	get,
	make_key,
	make_index,
	make_multi_index,
	map2obj,
	map_obj,
	match_all,
	monday_1200,
	multilineRegExp,
	natcmp,
	next_day,
	pad,
	parse_date,
	render_json,
	same_day,
	setdefault,
	sha512,
	find_last,
	sort_by,
	today_iso8601,
	ts2destr,
	ts2dstr,
	ts2str,
	ts2timestr,
	uniq,
	update,
	values,
	weekday,
	weekday_destr,
	zip,
};
