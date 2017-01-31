'use strict';

var assert = require('assert');

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
    'matchcomments',
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

function enrich(season) {
	const data = season.data;

	const vrls_by_clubs = new Map();
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

	for (const p of data.buli_players) {
		p.is_buli = true;
	}
	for (const tm of data.buli_teammatches) {
		tm.is_buli = true;
	}
	for (const t of data.buli_teams) {
		t.is_buli = true;
	}

	const club_by_id = new Map();
	for (let c of data.clubs) {
		club_by_id.set(c.code, c);
	}

	const player_by_id = new Map();
	for (const p of data.players) {
		player_by_id.set(p.spielerid, p);
	}
	const buli_player_by_id = new Map();
	for (const p of data.buli_players) {
		buli_player_by_id.set(p.spielerid, p);
	}

	const team_by_id = new Map();
	for (const t of data.teams) {
		team_by_id.set(t.code, t);
	}
	const buli_team_by_id = new Map();
	for (const t of data.buli_teams) {
		buli_team_by_id.set(t.code, t);
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
	for (const tm of data.teammatches) {
		teammatch_by_id.set(tm.matchid, tm);
	}
	const buli_teammatch_by_id = new Map();
	for (const tm of data.buli_teammatches) {
		buli_teammatch_by_id.set(tm.matchid, tm);
	}

	for (const tm of data.teammatches) {
		tm.ts = utils.parse_date(tm.spieldatum);
	}

	const playermatches_by_teammatchid = new Map();
	for (const pm of data.playermatches) {
		let pms = playermatches_by_teammatchid.get(pm.teammatchid);
		if (! pms) {
			pms = [];
			playermatches_by_teammatchid.set(pm.teammatchid, pms);
		}
		pms.push(pm);
	}

	const matches_by_player = new Map();
	function _add_player(pcode, pm) {
		if (!pcode) return;
		let all_matches = matches_by_player.get(pcode);
		if (!all_matches) {
			all_matches = {
				hr: [],
				rr: [],
			};
			matches_by_player.set(pcode, all_matches);
		}
		const round_matches = all_matches[pm.is_hr ? 'hr' : 'rr'];
		round_matches.push(pm);
	}
	const all_pms = [];
	for (const pm of data.playermatches) {
		const tm = teammatch_by_id.get(pm.teammatchid);
		if (!tm) {
			continue; // Cancelled team and therefore teammatch
		}
		pm.tm = tm;
		pm.is_hr = (tm.runde === 'H');
		all_pms.push(pm);
	}
	for (const pm of data.buli_playermatches) {
		const tm = buli_teammatch_by_id.get(pm.teammatchid);
		if (!tm) {
			continue; // Cancelled team and therefore teammatch
		}
		pm.is_buli = true;
		pm.tm = tm;
		pm.is_hr = (tm.runde === 'H');
		all_pms.push(pm);
	}

	all_pms.sort(function(pm1, pm2) {
		return pm1.tm.ts - pm2.tm.ts;
	});
	for (const pm of all_pms) {
		_add_player(pm.team1spieler1spielerid, pm);
		_add_player(pm.team1spieler2spielerid, pm);
		_add_player(pm.team2spieler1spielerid, pm);
		_add_player(pm.team2spieler2spielerid, pm);
	}
	data.matches_by_player = matches_by_player;

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

	const matchcomments_by_tmid = new Map();
	for (let line of data.matchcomments) {
		let mcs = matchcomments_by_tmid.get(line.matchid);
		if (!mcs) {
			mcs = [];
			matchcomments_by_tmid.set(line.matchid, mcs);
		}
		mcs.push(line);
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

	if (data.spielgemeinschaften) {
		const sg_pairs = new Set();
		for (const sg_line of data.spielgemeinschaften) {
			sg_pairs.add(sg_line.TVnr + '_' + sg_line.NTVnr);
		}
		data.in_sg = function(clubcode1, clubcode2) {
			return sg_pairs.has(clubcode1 + '_' + clubcode2) || sg_pairs.has(clubcode2 + '_' + clubcode1);
		};
	}

	data.get_player = function(player_id, include_buli) {
		let res = player_by_id.get(player_id);
		if (!res && include_buli) {
			res = buli_player_by_id.get(player_id);
		}
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
	data.get_team = function(team_id, include_buli) {
		let res = team_by_id.get(team_id);
		if (!res && include_buli) {
			res = buli_team_by_id.get(team_id);
		}
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
	data.try_get_vrl_entry = function(club_id, vrl_type, player_id, allow_no_club) {
		let club_vrls = vrls_by_clubs.get(club_id);
		if (!club_vrls) {
			if (allow_no_club) {
				return null;
			}
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
		if (/^00-BL1|00-B2N|00-B2S$/.test(staffelcode)) {
			return 'Bundesliga';
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
	data.get_club_region = function(clubcode) {
		const teams = data.get_teams_by_club(clubcode);

		let max_team = null;
		let max_num = Number.POSITIVE_INFINITY;
		for (const t of teams) {
			let team_score = team2num(t);

			if (data.get_region(t.eventname) === 'NRW') {
				team_score += 100000;
			}

			if (team_score < max_num) {
				max_team = t;
				max_num = team_score;
			}
		}

		return data.get_region(max_team.eventname);
	};
	data.get_region = function(eventname) {
		if (['O19-RL', 'O19-OL'].includes(eventname)) {
			return 'NRW';
		}
		const m = /^[A-Z0-9]+-([A-Z0-9]+)-/.exec(eventname);
		if (m) {
			return m[1];
		}
		return 'Sonstiges';
	};
	data.get_player_matches = function(pcode, is_hr) {
		const res = matches_by_player.get(pcode);
		if (!res) {
			return [];
		}
		return res[is_hr ? 'hr' : 'rr'];
	};
	data.get_stb_note = function(tm_id, textfilter) {
		const comments = matchcomments_by_tmid.get(tm_id);
		if (!comments) {
			return null;
		}

		for (const c of comments) {
			if (c['Comment type'] !== 'Wettkampfkommentar') {
				continue;
			}

			if (textfilter(c.nachricht)) {
				return c;
			}
		}

		return null;
	};
	data.get_comment = function(tm_id, textfilter) {
		const comments = matchcomments_by_tmid.get(tm_id);
		if (!comments) {
			return null;
		}

		for (const c of comments) {
			if (c['Comment type'] !== 'Spielkommentar') {
				continue;
			}

			if (textfilter(c.nachricht)) {
				return c;
			}
		}

		return null;
	};
	data.vrl_name = function(vrl_id) {
		const name = {
			9: 'Hinrunde Herren O19',
			10: 'Hinrunde Damen O19',
			11: 'Rückrunde Herren O19',
			12: 'Rückrunde Damen O19',
			14: 'Hinrunde Mädchen U19',
			16: 'Rückrunde Mädchen U19',
			17: 'Hinrunde Jungen+Mini U19',
			18: 'Rückrunde Jungen+Mini U19',
		}[vrl_id];
		if (!name) {
			throw new Error('Unknown VRL ' + JSON.stringify(vrl_id));
		}
		return `VRL ${vrl_id}[${name}]`;
	};
}

function team2num(team) {
	const m = /^([JSM]?)([0-9]+)$/.exec(team.number);
	if (!m) {
		throw new Error('Cannot parse number ' + team.number);
	}
	return ({
		'': 0,
		'J': 1000,
		'S': 2000,
		'M': 3000,
	}[m[1]] + parseInt(m[2]));
}

function teamid2clubid(team_id) {
	const m = /^(01-[0-9]+)-[MSJ]?[0-9]+$/.exec(team_id);
	if (!m) {
		throw new Error('Cannot parse team id ' + team_id);
	}
	return m[1];
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
	ALL_TASKS,
	parse_bool,
	parse_int,
	o19_is_regular,
	teamid2clubid,
};
