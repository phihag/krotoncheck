'use strict';

const assert = require('assert');

const utils = require('./utils.js');
const data_utils = require('./data_utils.js');
const downloads = require('./downloads.js');


const COLOR_ORDER = ['black', 'lightgray', 'red', 'yellow', 'violet', 'green'];

function enrich(season, found) {
	const data = season.data;

	found.forEach(function(p) {
		if ((p.type === 'vrl') || (p.type === 'fixed')) {
			const club = data.get_club(p.clubcode);
			p.club_name = club.name;
			p.club_email = data.club_emails.get(p.clubcode);
			if (p.vrl_typeid) {
				p.vrl_name = data.vrl_name(p.vrl_typeid);
				p.header = '(' + club.code + ') ' + club.name + ' ' + data.vrl_name(p.vrl_typeid);
			}
			if (p.type === 'fixed') {
				p.turnier_url = downloads.BASE_URL + 'sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
				p.turnier_vrl_url = downloads.BASE_URL + 'sport/clubranking.aspx?id=' + season.tournament_id + '&cid=' + club.XTPID;
				p.teammatch = data.get_teammatch(p.teammatch_id);
				p.region = 'Festgespielt';
			} else {
				assert(p.type === 'vrl');
				assert(p.vrl_typeid);
				p.turnier_url = downloads.BASE_URL + 'sport/clubranking.aspx?id=' + season.tournament_id + '&cid=' + club.XTPID + '&rid=' + p.vrl_typeid;
				p.region = 'VRL ' + data.get_club_region(p.clubcode);
			}
		} else if (p.teammatch_id) {
			if (p.type === 'latenote') {
				p.tournament_id = season.tournament_id;
			}
			p.teammatch = data.get_teammatch(p.teammatch_id);
			p.teammatch_url = downloads.BASE_URL + 'sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
			p.turnier_url = p.teammatch_url;
			if (p.teammatch2_id) {
				p.turnier2_url = downloads.BASE_URL + 'sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch2_id;
			}
			if (!p.stb) {
				p.stb = data.get_stb(p.teammatch);
			}
			p.region = data.get_region(p.teammatch.eventname);
		}
		if (p.match_id) {
			p.match = data.get_match(p.match_id);
			p.match_name = data_utils.match_name(p.match);
		}
		p.id = problem_id(p);
	});
	return found;
}

function store(db, season, {found, buli_umpires}, cb) {
	const calc_timestamp = Date.now();
	assert(Array.isArray(found));
	db.problems.update({key: season.key}, {key: season.key, found, buli_umpires}, {upsert: true}, (err, found_stored) => {
		if (err) return cb(err);
		db.seasons.update({key: season.key}, {$set: {calc_timestamp}}, {}, (err) => cb(err, found_stored));
	});
}

function problem_id(p) {
	return utils.sha512(p.message);
}

function prepare_render(season, problems) {
	if (!Array.isArray(problems)) {
		return;
	}
	const ignore = season.ignore ? season.ignore : [];

	for (const p of problems) {
		p.ignored = ignore.includes(p.id);
	}

	problems.sort((f1, f2) => {
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

		if (f1.teammatch && f2.teammatch) {
			if (f1.teammatch.ergebnisbestaetigt_datum && !f2.teammatch.ergebnisbestaetigt_datum) {
				return -1;
			}
			if (!f1.teammatch.ergebnisbestaetigt_datum && f2.teammatch.ergebnisbestaetigt_datum) {
				return 1;
			}

			if (f1.stb && f2.stb) {
				const stb1_name = f1.stb.firstname + ' ' + f1.stb.lastname;
				const stb2_name = f2.stb.firstname + ' ' + f2.stb.lastname;
				const stb_cmp = utils.cmp(stb1_name, stb2_name);
				if (stb_cmp !== 0) {
					return stb_cmp;
				}
			}
			if (!f1.stb && f2.stb) {
				return 1;
			}
			if (f1.stb && !f2.stb) {
				return -1;
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
	} else if (problem.type === 'latenote') {
		problem.color = 'violet';
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
	const problems = problems_struct ? (problems_struct.found ? problems_struct.found : []) : [];

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
				groups: [],
			};
			col.regions_map[problem.region] = reg;
		}

		let by_group;
		if (problem.type === 'vrl') {
			by_group = reg.groups_map[problem.turnier_url];
			if (! by_group) {
				by_group = {
					header: problem.header,
					turnier_url: problem.turnier_url,
					problems: [],
				};
				reg.groups_map[problem.turnier_url] = by_group;
				reg.groups.push(by_group);
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
				reg.groups.push(by_group);
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
				reg.groups.push(by_group);
			}
		} else if (problem.type === 'latenote') {
			assert(problem.stb);
			const stb_name = problem.stb.firstname + ' ' + problem.stb.lastname;
			const key = stb_name;
			by_group = reg.groups_map[key];
			if (!by_group) {
				by_group = {
					header: stb_name,
					problems: [],
					header_stb: problem.stb,
				};
				reg.groups_map[key] = by_group;
				reg.groups.push(by_group);
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
				reg.groups.push(by_group);
			}
		}
		
		by_group.problems.push(problem);
	}

	// Craft email info
	for (const region of utils.values(by_color)) {
		for (const groups of utils.values(region.regions_map)) {
			for (const g of utils.values(groups.groups_map)) {
				if (g.header_stb) {
					g.header_email = g.header_stb.email;
					g.header_mail_subject = encodeURIComponent(
						(g.problems.length === 1) ?
						data_utils.tm_str(g.problems[0].teammatch) :
						'Unbearbeitete Spiele'
					);
					g.header_mail_body = encodeURIComponent(
						'Hallo ' + g.header_stb.firstname + ',\n\n' +
						(
							(g.problems.length > 1) ?
							'bei den folgenden Spielen fehlt noch eine Bestätigung von Dir:' :
							'beim folgenden Spiel fehlt noch eine Bestätigung von Dir:'
						) +
						'\n\n' +
						g.problems.map(p => {
							const tm = p.teammatch;
							return (
								data_utils.tm_str(tm) +
								' (' + utils.weekday_destr(utils.parse_date(tm.spieldatum)) + ', ' + tm.spieldatum + ')\n' +
								p.teammatch_url
							);
						}).join('\n\n') +
						'\n\n' +
						'Alle Deine Spiele findest Du übrigens unter'
						` ${downloads.BASE_URL}/sport/membermatches.aspx?id=${g.problems[0].tournament_id}\n\n` +
						'Viele Grüße\n'
				);
				}

				if (!g.stb || !g.teammatch) {
					const ptype = g.problems[0].type;
					const club_email = g.problems[0].club_email;
					if (! ['vrl'].includes(ptype) && club_email) {
						continue;
					}

					// VRL-Problem, craft email to club
					g.header_email = club_email;
					g.header_mail_subject = encodeURIComponent('VRL-Report ' + g.header);
					g.header_mail_body = encodeURIComponent(
						'Hallo ' + g.problems[0].club_name + ',\n\n' +
						'in euer ' + g.problems[0].vrl_name + ' ' +
						'auf ' + g.turnier_url + ' ' +
						((g.problems.length === 1) ?
							'gibt es noch ein Problem:' :
							'gibt es ' + g.problems.length + ' Probleme:'
						) +
						'\n\n' +
						g.problems.map(p => {
							return (
								p.message
							);
						}).join('\n\n') +
						'\n\n' +
						'Bitte beenden Sie nach Abschluss Ihrer Bearbeitung – wenn Sie also nichts mehr ändern möchten - die Vereinsrangliste mit dem Button „Vereinsrangliste schließen“.\n' +
						'Dies erleichtert den Bezirken die Arbeit, da dann die inhaltliche Prüfung beginnen kann.\n' +
						'Sollten Sie die VRL irrtümlich innerhalb er Abgabefrist geschlossen haben, können wir die Bearbeitung wieder frei schalten.\n\n' +
						'Viele Grüße,\n' +
						'Miles'
					);
					continue;
				}

				const tm = g.teammatch;
				const match_name = data_utils.tm_str(tm);
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
			const REGIONS_ORDER = ['VRL N1', 'VRL N2', 'VRL S1', 'VRL S2', 'NRW', 'N1', 'N2', 'S1', 'S2', 'Sonstiges'];
			const idx1 = REGIONS_ORDER.indexOf(k1);
			const idx2 = REGIONS_ORDER.indexOf(k2);
			return idx1 - idx2;
		});
		col.regions = [];
		for (const k of keys) {
			const region = col.regions_map[k];
			col.regions.push(region);
		}

		color_list.push(col);
	}

	color_list.sort((c1, c2) => {
		const idx1 = COLOR_ORDER.indexOf(c1.color);
		const idx2 = COLOR_ORDER.indexOf(c2.color);
		return idx1 - idx2;
	});

	return color_list;
}


module.exports = {
	color_render,
	enrich,
	store,
	prepare_render,
};