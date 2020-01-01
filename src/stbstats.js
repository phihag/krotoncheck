'use strict';

const path = require('path');

const data_access = require('./data_access');
const data_utils = require('./data_utils');
const loader = require('./loader');
const render = require('./render');
const utils = require('./utils');
const worker_utils = require('./worker_utils');

function quantile(ar, q) {
	ar.sort(function(a, b) {
		return a - b;
	});

	const idx = q * (ar.length - 1);
	if (idx === Math.floor(idx)) {
		return ar[idx];
	} else {
		return (ar[Math.floor(idx)] + ar[Math.ceil(idx)]) / 2;
	}
}

function average(ar) {
	let sum = 0;
	for (const el of ar) {
		sum += el;
	}
	return sum / ar.length;
}

function show_handler(req, res, next) {
	const season_key = req.params.season_key;
	const region_filter = req.query.region || req.query.r;
	const show_emails = !! (req.query.show_emails || req.query.emails);
	const hide_regions = !! req.query.hide_regions;
	const worker_fn = path.join(__dirname, 'stbstats_worker.js');
	req.app.db.efetch_all(next, [{
		queryFunc: '_findOne',
		collection: 'seasons',
		query: {key: season_key},
	}], function(season) {
		const params = {
			season,
		};
		worker_utils.in_background(worker_fn, params, function(err, wr) {
			if (err) return next(err);

			// Filter stats
			for (const stats_key in wr) {
				let stats = wr[stats_key];

				if (region_filter) {
					stats = stats.filter(s => {
						return !s.regions_str || s.regions_str.includes(region_filter);
					});
				}

				if (hide_regions) {
					stats = stats.filter(s => !!s.regions_str);
				}

				wr[stats_key] = stats;
			}

			const stats_ar = [{
				stats: wr.all_stats,
			}, {
				xlabel: 'O19',
				stats: wr.o19_stats,
			}, {
				xlabel: 'U19',
				stats: wr.u19_stats,
			}];

			render(req, res, next, 'stbstats_show', {
				season,
				stats_ar,
				region_filter,
				show_emails,
				extended: (
					Object.prototype.hasOwnProperty.call(req.query, 'extended') ||
					Object.prototype.hasOwnProperty.call(req.query, 'e')),
			});
		});
	});
}

function calc_ms(data, tm, stb_name, now) {
	if (!tm.detailergebnis_eintragedatum) {
		return; // Not entered yet
	}

	if (/\([ABC]\)/.test(tm.detailergebnis_user) || (tm.detailergebnis_user === tm.ergebnisbestaetigt_user)) {
		return; // Entered by StB/admin
	}

	const entered = utils.parse_date(tm.detailergebnis_eintragedatum);
	const handled_ar = [];
	if (tm.ergebnisbestaetigt_datum) {
		handled_ar.push(utils.parse_date(tm.ergebnisbestaetigt_datum));
	}

	const notes = data.get_all_notes(tm.matchid);
	if (notes) {
		for (const note of notes) {
			if (note.benutzer !== stb_name) {
				continue;
			}
			const ts = utils.parse_date(note.zeitpunkt);
			if (ts < entered) {
				continue;
			}
			handled_ar.push(ts);
		}
	}

	if (handled_ar.length === 0) {
		return now - entered; // Not yet handled
	}

	const handled = Math.min.apply(null, handled_ar);
	if (entered > handled) {
		return;
	}

	return handled - entered;
}

function calc_stats(season, limit_age) {
	const data = season.data;

	const durations_by_stb = new Map();
	const regions_by_stb = new Map();
	const groups_by_stb = new Map();
	const emails_by_stb = new Map();
	const now = Date.now();
	for (const tm of data.teammatches) {
		if (limit_age) {
			const fine_type = data_utils.tm_league_type(tm);
			const league_type = (['U19', 'Mini'].includes(fine_type) ? 'U19' : 'O19');
			if (league_type !== limit_age) {
				continue;
			}
		}

		const stb = data.get_stb(tm);
		const stb_name = stb.firstname + ' ' + stb.lastname;

		emails_by_stb.set(stb_name, stb.email);

		const region = data.get_region(tm.eventname);
		const stb_regions = utils.setdefault(regions_by_stb, stb_name, () => new Set());
		stb_regions.add(region);

		const duration = calc_ms(data, tm, stb_name, now);
		if (duration === undefined) {
			continue;
		}

		let stb_durations = utils.setdefault(durations_by_stb, stb_name, () => []);
		stb_durations.push(duration);

		let region_durations = utils.setdefault(durations_by_stb, region, () => []);
		region_durations.push(duration);

		const group_id = tm.staffelcode;
		let stb_groups = utils.setdefault(groups_by_stb, stb_name, () => []);
		if (!stb_groups.includes(group_id)) {
			stb_groups.push(group_id);
		}
		let region_groups = utils.setdefault(groups_by_stb, region, () => []);
		if (!region_groups.includes(group_id)) {
			region_groups.push(group_id);
		}
	}

	const res = [];
	for (const [stb_name, durs] of durations_by_stb.entries()) {
		const stb_regions = regions_by_stb.get(stb_name) || [];
		const stb_groups = groups_by_stb.get(stb_name) || [];
		const regions_ar = Array.from(stb_regions);
		regions_ar.sort();
		const regions_str = regions_ar.join(',');
		res.push({
			stb_name,
			stb_email: emails_by_stb.get(stb_name),
			median: quantile(durs, 0.5),
			q95: quantile(durs, 0.95),
			avg: average(durs),
			count: durs.length,
			groups: stb_groups,
			group_count: stb_groups.length,
			regions_str,
		});
	}
	res.sort(utils.cmp_key('median'));
	return res;
}

function run_calc(params, cb) {
	const {season} = params;
	loader.load_season_data(season, (err) => {
		if (err) return cb(err);

		data_access.enrich(season);

		cb(null, {
			all_stats: calc_stats(season),
			o19_stats: calc_stats(season, 'O19'),
			u19_stats: calc_stats(season, 'U19'),
		});
	});
}

module.exports = {
	show_handler,
	run_calc,
};
