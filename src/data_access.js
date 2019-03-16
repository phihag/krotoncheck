'use strict';

const assert = require('assert');

const utils = require('./utils');
const data_utils = require('./data_utils');
const umpire_mail = require('./umpire_mail');


const ALL_TASKS = [
    'clubranking',
    'clubs',
    'locations',
    'matchcomments',
//    'itemcomments',
    'matchfields',
    'matchlog',
    'playermatches',
    'players',
    'playerteam',
    'teammatches',
    'teams',
    'users',
];

function annotate(data) {
	for (let cr of data.clubranking) {
		cr.typeid = data_utils.parse_int(cr.typeid);
		for (const date_key of ['fixed_from', 'startdate', 'enddate']) {
			if (cr[date_key]) {
				const ts = utils.parse_date(cr[date_key]);
				assert(typeof ts == 'number');
				cr['parsed_' + date_key] = ts;
			}
		}
	}

	const has_buli = !! data.buli_players;
	if (has_buli) {
		for (const p of data.buli_players) {
			p.is_buli = true;
		}
		for (const tm of data.buli_teammatches) {
			tm.is_buli = true;
		}
		for (const t of data.buli_teams) {
			t.is_buli = true;
		}
	}

	for (const tm of data.teammatches) {
		for (const bool_key of [
				'flag_ok_gegen_team1',
				'flag_ok_gegen_team2',
				'flag_umwertung_gegen_team1',
				'flag_umwertung_gegen_team2',
				'flag_umwertung_gegen_team1_beide',
				'flag_umwertung_gegen_team2_beide',
				'flag_umwertung_gegen_beide',
				'hrt',
				]) {
			tm[bool_key] = data_utils.parse_bool(tm[bool_key]);
		}
	}
	for (const tm of data.teammatches) {
		tm.ts = utils.parse_date(tm.spieldatum);
	}
	if (has_buli) {
		for (const tm of data.buli_teammatches) {
			if (tm.spieldatum) {
				tm.ts = utils.parse_date(tm.spieldatum);
			}
		}
	}
	for (const pm of data.playermatches) {
		for (const int_key of [
				'matchtypeno',
				'winner',
				'setcount',
				'set1team1',
				'set1team2',
				'set2team1',
				'set2team2',
				'set3team1',
				'set3team2',
				'team1spielpunkte',
				'team2spielpunkte',
				'team1sets',
				'team2sets']) {
			pm[int_key] = data_utils.parse_int(pm[int_key]);
		}
		for (const bool_key of ['flag_keinspiel_keinespieler', 'flag_keinspiel_keinspieler_team1', 'flag_keinspiel_keinspieler_team2', 'flag_aufgabe_team1', 'flag_aufgabe_team2', 'flag_umwertung_gegen_team1', 'flag_umwertung_gegen_team2']) {
			pm[bool_key] = data_utils.parse_bool(pm[bool_key]);
		}
	}
}

function enrich(season) {
	const data = season.data;

	annotate(data);
	umpire_mail.annotate_umpire_index(season);

	const vrls_by_clubs = new Map();
	data.vrls_by_clubs = vrls_by_clubs;
	for (let cr of data.clubranking) {
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

	const buli_make_index = (d, func) => (d ? utils.make_index(d, func) : null);

	const club_by_id = utils.make_index(data.clubs, c => c.code);
	const player_by_id = utils.make_index(data.players, p => p.spielerid);
	const buli_player_by_id = buli_make_index(data.buli_players, p => p.spielerid);
	const team_by_id = utils.make_index(data.teams, t => t.code);
	const buli_team_by_id = buli_make_index(data.buli_teams, t => t.code);
	const teams_by_club = utils.make_multi_index(data.teams, t => t.clubcode);
	const teammatch_by_id = utils.make_index(data.teammatches, tm => tm.matchid);
	const buli_teammatch_by_id = buli_make_index(data.buli_teammatches, tm => tm.matchid);
	const matchlogs_by_teammatchid = utils.make_multi_index(data.matchlog, ml => ml.matchid);
	const playermatches_by_teammatchid = utils.make_multi_index(data.playermatches, pm => pm.teammatchid);
	const locations_by_id = utils.make_index(data.locations, loc => loc.code);

	const matches_by_player = new Map();
	function _add_player(pcode, pm) {
		if (!pcode) return;
		const all_matches = utils.setdefault(matches_by_player, pcode, () => {
			return {hr: [], rr: []};
		});
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
	if (data.buli_playermatches) {
		for (const pm of data.buli_playermatches) {
			const tm = buli_teammatch_by_id.get(pm.teammatchid);
			if (!tm) {
				continue; // Cancelled team and therefore teammatch
			}
			if (!tm.ts) {
				continue; // In the future, not yet scheduled
			}
			pm.is_buli = true;
			pm.tm = tm;
			pm.is_hr = (tm.runde === 'H');
			all_pms.push(pm);
		}
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

	const club_emails = new Map();
	for (const line of data.users) {
		if (line.rolename === 'Verein') {
			club_emails.set(line.externalcode, line.email);
		}
	}
	data.club_emails = club_emails;

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

	const matchcomments_by_tmid = utils.make_multi_index(data.matchcomments, line => line.matchid);

	data.active_teammatches = [];
	let active_teammatch_ids = new Set();
	for (let tm of data.teammatches) {
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

	const teammatch_by_team_id = new Map();
	for (const tm of data.teammatches) {
		for (let i = 1;i <= 2; i++) {
			const team_id = tm[`team${i}id`];
			if (team_id) {
				const tms = utils.setdefault(teammatch_by_team_id, team_id, () => []);
				tms.push(tm);
			}
		}
	}
	for (const tms of teammatch_by_team_id.values()) {
		tms.sort((tm1, tm2) => tm1.ts - tm2.ts);
	}

	data.active_playermatches = [];
	data.played_playermatches = [];
	const playermatch_by_id = new Map();
	for (let pm of data.playermatches) {
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
		if (!res && include_buli && buli_player_by_id) {
			res = buli_player_by_id.get(player_id);
		}
		if (!res) {
			throw new Error('Konnte Spieler ' + JSON.stringify(player_id) + ' nicht finden');
		}
		return res;
	};
	data.get_teammatch = function(teammatch_id) {
		const res = teammatch_by_id.get(teammatch_id);
		if (!res) {
			throw new Error('Konnte Wettkampf ' + JSON.stringify(teammatch_id) + ' nicht finden');
		}
		return res;
	};
	data.try_get_teammatch = function(teammatch_id) {
		return teammatch_by_id.get(teammatch_id);
	};
	data.get_teammatches_by_team_id = function(team_id) {
		const res = teammatch_by_team_id.get(team_id);
		if (!res) {
			return null;
		}
		return res;
	};
	data.get_all_team_teammatches = () => teammatch_by_team_id.entries();
	data.get_match = function(match_id) {
		const res = playermatch_by_id.get(match_id);
		if (!res) {
			throw new Error('Konnte Spiel ' + JSON.stringify(match_id) + ' nicht finden');
		}
		return res;
	};
	data.get_playermatches_by_teammatch_id = function(teammatch_id) {
		const res = playermatches_by_teammatchid.get(teammatch_id);
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
		if (!res && include_buli && buli_team_by_id) {
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
		return tm_matchfields.get(label) || tm_matchfields.get(label + ':');
	};
	data.get_resigned_field = (tm) => {
		return data.get_matchfield(tm, 'Spielaufgabe (Disziplin, Namen, Spielstand bei Aufgabe, Nichtantritt):');
	};
	data.get_teams_by_club = function(club_code) {
		const res = teams_by_club.get(club_code);
		if (!res) {
			throw new Error('Unknown club code ' + JSON.stringify(club_code));
		}
		return res;
	};
	data.try_get_teams_by_club = function(club_code) {
		return teams_by_club.get(club_code) || [];
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
		const teams = data.try_get_teams_by_club(clubcode);
		if (teams.length === 0) {
			return 'Unbekannte Region';
		}

		let max_team = null;
		let max_num = Number.POSITIVE_INFINITY;
		for (const t of teams) {
			let team_score = data_utils.team2num(t);

			const region = data.get_region(t.eventname);
			if (region === 'NRW') {
				team_score += 10000;
			} else if (region === 'Bundesliga') {
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
		if (['O19-RL', 'O19-OL', 'O19-GW-RL', 'O19-GW-OL'].includes(eventname)) {
			return 'NRW';
		}
		const m = /^[A-Z0-9]+-([A-Z0-9]+)-/.exec(eventname);
		if (m) {
			return m[1];
		}

		if (/^[12]\.\s*Bundesliga/.test(eventname)) {
			return 'Bundesliga';
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
	data.get_all_notes = function(tm_id) {
		return matchcomments_by_tmid.get(tm_id);
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
	data.get_comments = function(tm_id, textfilter) {
		const comments = matchcomments_by_tmid.get(tm_id);
		if (!comments) {
			return [];
		}
		return comments.filter(c => (
			(c['Comment type'] === 'Spielkommentar') &&
			(!textfilter || textfilter(c.nachricht))
		));
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
	data.get_matchlog = function(tm_id) {
		return utils.get(matchlogs_by_teammatchid, tm_id, () => []);
	};
	data.get_location = function(loc_id) {
		const res = locations_by_id.get(loc_id);
		if (!res) {
			throw new Error('Cannot find location ' + JSON.stringify(loc_id));
		}
		return res;
	};
}

module.exports = {
	enrich,
	ALL_TASKS,
};
