'use strict';

var utils = require('./utils.js');


function enrich(data, season, found) {
	found.forEach(function(p) {
		if (p.teammatch_id) {
			p.teammatch = data.get_teammatch(p.teammatch_id);
			p.teammatch_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
			p.turnier_url = p.teammatch_url;
			if (p.teammatch2_id) {
				p.turnier2_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch2_id;
			}
			p.stb = data.get_stb(p.teammatch);
		} else if (p.type === 'vrl') {
			const club = data.get_club(p.clubcode);
			p.header = 'VRL ' + p.vrl_typeid + ' von (' + club.code + ') ' + club.name;
			p.turnier_url = 'http://www.turnier.de/sport/clubranking.aspx?id=' + season.tournament_id + '&cid=' + club.XTPID;
		}
		if (p.match_id) {
			p.match = data.get_match(p.match_id);
			p.match_name = data.match_name(p.match);
		}
		p.id = problem_id(p);
	});
	return found;
}

function store(db, season, found, cb) {
	db.problems.update({key: season.key}, {key: season.key, found: found}, {upsert: true}, cb);
}

function problem_id(p) {
	return utils.sha512(p.message);
}

function prepare_render(season, problems) {
	const ignore = season.ignore ? season.ignore : [];

	for (const p of problems) {
		p.ignored = ignore.includes(p.id);
	}

	problems.sort(function(f1, f2) {
		if (!f1.ignored && f2.ignored) {
			return -1;
		}
		if (f1.ignored && !f2.ignored) {
			return 1;
		}

		if (!f1.teammatch_id && f2.teammatch_id) {
			return -1;
		}
		if (f1.teammatch_id && !f2.teammatch_id) {
			return 1;
		}
		if (!f1.teammatch_id && !f2.teammatch_id) {
			return 0;
		}

		if (f1.teammatch.ergebnisbestaetigt_datum && !f2.teammatch.ergebnisbestaetigt_datum) {
			return -1;
		}
		if (!f1.teammatch.ergebnisbestaetigt_datum && f2.teammatch.ergebnisbestaetigt_datum) {
			return 1;
		}

		if (f1.turnier_url && !f2.turnier_url) {
			return 1;
		}
		if (!f1.turnier_url && f2.turnier_url) {
			return -1;
		}

		if (f1.turnier_url && f2.turnier_url) {
			const cmp = utils.natcmp(f1.turnier_url, f2.turnier_url);
			if (cmp !== 0) {
				return cmp;
			}
		}

		return utils.cmp(f1.message, f2.message);
	});
}

function colorize_problem(problem) {
	if (problem.type === 'vrl') {
		problem.region = 'VRL';
		problem.color = 'black';
	} else {
		const tm = problem.teammatch;
		problem.color = tm ? (tm.ergebnisbestaetigt_datum ? 'red' : 'yellow') : 'black';
		const m = /^[A-Z0-9]+-([A-Z0-9]+)-/.exec(tm.eventname);
		problem.region = m ? m[1] : 'Sonstige Region';
	}
	if (problem.ignored) {
		problem.color = 'green';
	}
}

function color_render(problems_struct) {
	const problems = problems_struct ? problems_struct.found : [];

	problems.forEach(colorize_problem);

	const by_color = {};
	for (const problem of problems) {
		let col = by_color[problem.color];
		if (! col) {
			col = {
				color: problem.color,
				regions_map: {},
			};
			by_color[problem.color] = col;
		}

		let reg = col.regions_map[problem.region];
		if (! reg) {
			reg = {
				name: problem.region,
				groups_map: {},
			};
			col.regions_map[problem.region] = reg;
		}

		let by_group;
		if (problem.type === 'vrl') {
			by_group = reg.groups_map[problem.turnier_url];
			if (! by_group) {
				by_group = {
					turnier_url: problem.turnier_url,
					problems: [],
				};
				reg.groups_map[problem.turnier_url] = by_group;
			}
		} else {
			const tm = problem.teammatch;
			if (!tm.matchid) {
				throw new Error('Missing matchid');
			}
			by_group = reg.groups_map[tm.matchid];

			if (!by_group) {
				by_group = {
					teammatch: tm,
					turnier_url: problem.turnier_url,
					teammatch_url: problem.teammatch_url,
					teammatch_id: problem.teammatch_id,
					problems: [],
				};
				reg.groups_map[tm.matchid] = by_group;
			}
		}
		
		by_group.problems.push(problem);
	}

	const color_list = [];
	for (const color_key in by_color) {
		const col = by_color[color_key];
		let keys = Object.keys(col.regions_map);
		keys.sort();
		col.regions = [];
		for (const k of keys) {
			const region = col.regions_map[k];
			region.groups = [];

			let tm_keys = Object.keys(region.groups_map);
			tm_keys.sort();
			for (const tmk of tm_keys) {
				const tm = region.groups_map[tmk];
				region.groups.push(tm);
			}

			col.regions.push(region);
		}

		color_list.push(col);
	}

	return color_list;
}


module.exports = {
	color_render,
	enrich,
	store,
	prepare_render,
};