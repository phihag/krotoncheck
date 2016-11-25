'use strict';

var assert = require('assert');
var async = require('async');
var atomic_write = require('atomic-write');
var Baby = require('babyparse');
var fs = require('fs');
var path = require('path');

var utils = require('./utils');


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
    'users',
];


function parse_bool(val) {
	if ((val === 'true') || (val === 'True')) {
		return true;
	} else if ((val === 'false') || (val === 'False')) {
		return false;
	} else {
		throw new Error('Invalid boolean value ' + JSON.stringify(val));
	}
}

function enrich(season, data) {
	let vrls_by_clubs = new Map();
	for (let cr of data.clubranking) {
		cr.typeid = parse_int(cr.typeid);
		for (const date_key of ['fixed_from', 'startdate', 'enddate']) {
			if (cr[date_key]) {
				const ts = utils.parse_date(cr[date_key]);
				assert(typeof ts == 'number');
				cr['parsed_' + date_key] = ts;
			}
		}

		let club_vrls = vrls_by_clubs.get(cr.clubcode);
		if (!club_vrls) {
			club_vrls = new Map();
			club_vrls.clubname = cr.clubname;
			vrls_by_clubs.set(cr.clubcode, club_vrls);
		}
		const vrl_type = cr.typeid;
		let line_vrl = club_vrls.get(vrl_type);
		if (!line_vrl) {
			line_vrl = new Map();
			club_vrls.set(vrl_type, line_vrl);
			line_vrl.entries = [];
		}
		line_vrl.set(cr.memberid, cr);
		line_vrl.entries.push(cr);
	}

	const club_by_id = new Map();
	for (let c of data.clubs) {
		club_by_id.set(c.code, c);
	}

	var player_by_id = new Map();
	for (let p of data.players) {
		player_by_id.set(p.spielerid, p);
	}

	const team_by_id = new Map();
	for (let t of data.teams) {
		team_by_id.set(t.code, t);
	}

	const teams_by_club = new Map();
	for (const t of data.teams) {
		const club = t.clubcode;
		let teams = teams_by_club.get(club);
		if (!teams) {
			teams = [];
			teams_by_club.set(club, teams);
		}
		teams.push(t);
	}

	const teammatch_by_id = new Map();
	for (let tm of data.teammatches) {
		teammatch_by_id.set(tm.matchid, tm);
	}

	const playermatches_by_teammatchid = new Map();
	for (let pm of data.playermatches) {
		let pms = playermatches_by_teammatchid.get(pm.teammatchid);
		if (! pms) {
			pms = [];
			playermatches_by_teammatchid.set(pm.teammatchid, pms);
		}
		pms.push(pm);
	}

	const stbs_by_league_code = new Map();
	for (const line of data.users) {
		if (line.rolename === 'Staffelbetreuer') {
			stbs_by_league_code.set(line.roledata, line);
		}
	}

	const match_fields_map = new Map();
	for (const line of data.matchfields) {
		const tm_id = line.MatchID;
		let tm_matchfields = match_fields_map.get(tm_id);
		if (!tm_matchfields) {
			tm_matchfields = new Map();
			match_fields_map.set(tm_id, tm_matchfields);
		}
		tm_matchfields.set(line.MatchField, line.ValueText);
	}

	data.active_teammatches = [];
	let active_teammatch_ids = new Set();
	for (let tm of data.teammatches) {
		for (let bool_key of [
				'flag_ok_gegen_team1',
				'flag_ok_gegen_team2',
				'flag_umwertung_gegen_team1',
				'flag_umwertung_gegen_team2',
				'flag_umwertung_gegen_team1_beide',
				'flag_umwertung_gegen_team2_beide',
				'flag_umwertung_gegen_beide',
				'hrt',
				]) {
			tm[bool_key] = parse_bool(tm[bool_key]);
		}

		let t1 = team_by_id.get(tm.team1id);
		if (!t1) {
			throw new Error('Team1 (ID: ' + tm.team1id + ')  in teammatch ' + tm.matchid + ' is missing');
		}
		let t2 = team_by_id.get(tm.team2id);
		if (!t2) {
			throw new Error('Team2 (ID: ' + tm.team2id + ')  in teammatch ' + tm.matchid + ' is missing');
		}
		let ohne_kampf = tm.flag_ok_gegen_team1 || tm.flag_ok_gegen_team2;

		if (! (t1.Status || t2.Status || ohne_kampf)) {
			data.active_teammatches.push(tm);
			active_teammatch_ids.add(tm.matchid);
		}
	}

	data.active_playermatches = [];
	data.played_playermatches = [];
	var playermatch_by_id = new Map();
	for (let pm of data.playermatches) {
		for (let int_key of [
				'matchtypeno',
				'winner',
				'setcount',
				'set1team1',
				'set1team2',
				'set2team1',
				'set2team2',
				'set3team1',
				'set3team2']) {
			pm[int_key] = parse_int(pm[int_key]);
		}
		for (let bool_key of ['flag_keinspiel_keinespieler', 'flag_keinspiel_keinspieler_team1', 'flag_keinspiel_keinspieler_team2', 'flag_aufgabe_team1', 'flag_aufgabe_team2', 'flag_umwertung_gegen_team1', 'flag_umwertung_gegen_team2']) {
			pm[bool_key] = parse_bool(pm[bool_key]);
		}

		playermatch_by_id.set(pm.matchid, pm);

		if (!active_teammatch_ids.has(pm.teammatchid)) {
			continue;
		}

		data.active_playermatches.push(pm);

		let not_played = pm.flag_keinspiel_keinespieler || pm.flag_keinspiel_keinspieler_team1 || pm.flag_keinspiel_keinspieler_team2;
		if (! not_played) {
			data.played_playermatches.push(pm);
		}
	}

	data.get_player = function(player_id) {
		var res = player_by_id.get(player_id);
		if (!res) {
			throw new Error('Konnte Spieler ' + JSON.stringify(player_id) + ' nicht finden');
		}
		return res;
	};
	data.get_teammatch = function(teammatch_id) {
		var res = teammatch_by_id.get(teammatch_id);
		if (!res) {
			throw new Error('Konnte Wettkampf ' + JSON.stringify(teammatch_id) + ' nicht finden');
		}
		return res;
	};
	data.get_match = function(match_id) {
		var res = playermatch_by_id.get(match_id);
		if (!res) {
			throw new Error('Konnte Spiel ' + JSON.stringify(match_id) + ' nicht finden');
		}
		return res;
	};
	data.get_playermatches_by_teammatch_id = function(teammatch_id) {
		var res = playermatches_by_teammatchid.get(teammatch_id);
		if (!res) {
			throw new Error('Konnte Spiele von Wettkampf ' + JSON.stringify(teammatch_id) + ' nicht finden');
		}
		return res;
	};
	data.try_get_team = function(team_id) {
		return team_by_id.get(team_id);
	};
	data.get_team = function(team_id) {
		let res = team_by_id.get(team_id);
		if (!res) {
			throw new Error('Kann Team ' + team_id + ' nicht finden');
		}
		return res;
	};
	data.get_club = function(club_id) {
		let res = club_by_id.get(club_id);
		if (!res) {
			throw new Error('Kann Club ' + club_id + ' nicht finden');
		}
		return res;
	};
	data.get_vrl_entry = function(club_id, vrl_type, player_id) {
		let club_vrls = vrls_by_clubs.get(club_id);
		if (!club_vrls) {
			throw new Error('Kann VRLs von Verein ' + club_id + ' nicht finden');
		}
		let res = club_vrls.get(vrl_type);
		if (!res) {
			throw new Error('Verein ' + club_id + ' hat keine VRL ' + vrl_type);
		}
		return res.get(player_id);
	};
	data.try_get_vrl_entry = function(club_id, vrl_type, player_id) {
		let club_vrls = vrls_by_clubs.get(club_id);
		if (!club_vrls) {
			throw new Error('Kann VRLs von Verein ' + club_id + ' nicht finden');
		}
		let res = club_vrls.get(vrl_type);
		if (!res) {
			return res;
		}
		return res.get(player_id);
	};
	data.player_name = function(p) {
		return p.vorname + ' ' + p.name;
	};
	data.player_str = function(p) {
		return p.vorname + ' ' + p.name + ' (' + p.spielerid + ')';
	};
	data.match_name = function(pm) {
		var res = pm.disziplin;
		if (pm.matchtypeno) {
			res = pm.matchtypeno + '. ' + res;
		}
		return res;
	};
	data.league_type = function(staffelcode) {
		if (/^01-[0-9]+$/.test(staffelcode)) {
			return 'O19';
		}
		if (/^01-[JS][0-9]+$/.test(staffelcode)) {
			return 'U19';
		}
		if (/^01-M[0-9]+$/.test(staffelcode)) {
			return 'Mini';
		}
		throw new Error('Unknown league code ' + JSON.stringify(staffelcode));
	};
	data.get_stb = function(tm) {
		// Careful: May not be present for old leagues
		const res = stbs_by_league_code.get(tm.staffelcode);
		return res;
	};
	data.get_matchfield = function(tm, label) {
		const tm_matchfields = match_fields_map.get(tm.matchid);
		if (!tm_matchfields) {
			return null;
		}
		return tm_matchfields.get(label);
	};
	data.get_teams_by_club = function(club_code) {
		const res = teams_by_club.get(club_code);
		if (!res) {
			throw new Error('Unknown club code ' + JSON.stringify(club_code));
		}
		return res;
	};
	data.all_vrlinfos = function*() {
		for (const [clubcode, club_vrls] of vrls_by_clubs.entries()) {
			const clubname = club_vrls.clubname;
			for (const [typeid, mem_map] of club_vrls.entries()) {
				yield {
					clubcode,
					clubname,
					typeid,
					entries: mem_map.entries,
				};
			}
		}
	};
	data.get_vrl_entries = function(clubcode, typeid) {
		const vrls = vrls_by_clubs.get(clubcode);
		if (!vrls) {
			throw new Error('Cannot find VRLs of club ' + JSON.stringify(clubcode));
		}
		const vrl_map = vrls.get(typeid);
		if (!vrl_map) {
			return vrl_map;
		}
		return vrl_map.entries;
	};
}

function load_data(dirname, tasks, callback) {
	let data = {};
	async.each(tasks, function(task_name, cb) {
		var csv_fn = path.join(dirname, task_name + '.csv');
		parse_csv(csv_fn, function(err, lines) {
			if (err) return cb(err);

			data[task_name] = lines;
			cb(err);
		});
	}, err => callback(err, data));
}

function load_data_cached(dirname, tasks, callback) {
	var json_fn = path.join(dirname, 'cachev1.json');
	fs.readFile(json_fn, {encoding: 'utf8'}, function(err, fcontents) {
		if (err) {
			load_data(dirname, tasks, function(err, data) {
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

function parse_int(s) {
	let res = parseInt(s, 10);
	if (isNaN(s)) {
		throw new Error('Failed to parse integer from ' + JSON.stringify(s));
	}
	return res;
}

function o19_is_regular(p) {
	// Nichtstammspieler
	if (p.vkz1 === 'N') {
		return false;
	}
	// Jugendspieler
	if ((p.vkz1 === 'J1') || (p.vkz1 === 'S1') || (p.vkz1 === 'M1')) {
		return false;
	}
	return true;
}

module.exports = {
	enrich,
	load_data_cached,
	load_data,
	ALL_TASKS,
	parse_bool,
	parse_int,
	o19_is_regular,
};
