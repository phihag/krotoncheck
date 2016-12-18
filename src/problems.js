'use strict';

const assert = require('assert');

const utils = require('./utils.js');


function enrich(season, found) {
	const data = season.data;

	found.forEach(function(p) {
		if ((p.type === 'vrl') || (p.type === 'fixed')) {
			const club = data.get_club(p.clubcode);
			p.club_name = club.name;
			if (p.vrl_typeid) {
				p.header = 'VRL ' + p.vrl_typeid + ' von (' + club.code + ') ' + club.name;
			}
			if (p.type === 'fixed') {
				p.turnier_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
				p.turnier_vrl_url = 'http://www.turnier.de/sport/clubranking.aspx?id=' + season.tournament_id + '&cid=' + club.XTPID;
				p.teammatch = data.get_teammatch(p.teammatch_id);
				p.region = 'Festgespielt';
			} else {
				assert(p.type === 'vrl');
				p.turnier_url = 'http://www.turnier.de/sport/clubranking.aspx?id=' + season.tournament_id + '&cid=' + club.XTPID;
				p.region = data.get_club_region(p.clubcode);
			}
		} else if (p.teammatch_id) {
			p.teammatch = data.get_teammatch(p.teammatch_id);
			p.teammatch_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
			p.turnier_url = p.teammatch_url;
			if (p.teammatch2_id) {
				p.turnier2_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch2_id;
			}
			p.stb = data.get_stb(p.teammatch);
			p.region = data.get_region(p.teammatch.eventname);
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

		if ((f1.type === 'fixed') && (f2.type !== 'fixed')) {
			return -1;
		}
		if ((f1.type !== 'fixed') && (f2.type === 'fixed')) {
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

		if (f1.teammatch && f2.teammatch) {
			if (f1.teammatch.ergebnisbestaetigt_datum && !f2.teammatch.ergebnisbestaetigt_datum) {
				return -1;
			}
			if (!f1.teammatch.ergebnisbestaetigt_datum && f2.teammatch.ergebnisbestaetigt_datum) {
				return 1;
			}
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
		problem.color = 'lightgray';
	} else if (problem.type === 'fixed') {
		problem.color = 'lightblue';
	} else {
		const tm = problem.teammatch;
		if (tm) {
			problem.color = tm.ergebnisbestaetigt_datum ? 'red' : 'yellow';
			// region already set in enrich (above)
		} else {
			problem.color = 'black';
			problem.region = problem.type;
		}
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
					header: ('(' + problem.clubcode + ') ' + problem.club_name),
					turnier_url: problem.turnier_url,
					problems: [],
				};
				reg.groups_map[problem.turnier_url] = by_group;
			}
		} else if (problem.type === 'fixed') {
			by_group = reg.groups_map[problem.clubcode];
			if (! by_group) {
				by_group = {
					header: ('(' + problem.clubcode + ') ' + problem.club_name),
					turnier_url: problem.turnier_vrl_url,
					problems: [],
				};
				reg.groups_map[problem.clubcode] = by_group;
			}
		} else if (problem.type === 'internal-error') {
			const key = 'Interne Fehler';
			by_group = reg.groups_map[key];
			if (! by_group) {
				by_group = {
					turnier_url: 'mailto:phihag@phihag.de?subject=Interner+Fehler+in+krotoncheck',
					problems: [],
				};
				reg.groups_map[key] = by_group;
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
				if (problem.stb) {
					by_group.stb = problem.stb;
				}
				reg.groups_map[tm.matchid] = by_group;
			}
		}
		
		by_group.problems.push(problem);
	}

	// Craft email info
	for (const region of utils.values(by_color)) {
		for (const groups of utils.values(region.regions_map)) {
			for (const g of utils.values(groups.groups_map)) {
				if (!g.stb || !g.teammatch) {
					continue;
				}

				const tm = g.teammatch;
				const match_name = tm.hrt ? (tm.team2name + ' - ' + tm.team1name) : (tm.team1name + ' - ' + tm.team2name);
				g.stb_mail_subject = encodeURIComponent(
					match_name
				);
				g.stb_mail_body = encodeURIComponent(
					'Hallo ' + g.stb.firstname + ',\n\n' +
					'beim Spiel ' + match_name + ' ' +
					((g.problems.length > 1) ? 'wurden ' + g.problems.length + ' mögliche' : 'wurde ein möglicher') +
					' Fehler gefunden:\n\n' +
					g.problems.map(p => {
						let res = '';
						if (p.match_name) {
							res += p.match_name + ': ';
						}
						res += p.message;
						if (p.turnier2_url) {
							res += ' (siehe auch ' + p.turnier2_url + ' )';
						}
						return res;
					}).join('\n') +
					'\n\n' +
					'Kannst Du unter\n' + g.turnier_url + '\nmal nachschauen?\n\n' +
					'Viele Grüße\n'
				);
			}
		}
	}

	const color_list = [];
	for (const color_key in by_color) {
		const col = by_color[color_key];
		let keys = Object.keys(col.regions_map);
		keys.sort(function(k1, k2) {
			const REGIONS_ORDER = ['NRW', 'N1', 'N2', 'S1', 'S2', 'Sonstiges'];
			const idx1 = REGIONS_ORDER.indexOf(k1);
			const idx2 = REGIONS_ORDER.indexOf(k2);
			return idx1 - idx2;
		});
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