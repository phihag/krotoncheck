'use strict';

function parse_bool(val) {
	if (val === 'true') {
		return true;
	} else if (val === 'false') {
		return false;
	} else {
		throw new Error('Invalid boolean value ' + JSON.stringify(val));
	}
}

function enrich(season, data) {
	var player_by_id = new Map();
	for (let p of data.players) {
		player_by_id.set(p.spielerid, p);
	}

	var team_by_id = new Map();
	for (let t of data.teams) {
		team_by_id.set(t.code, t);
	}

	var teammatch_by_id = new Map();
	for (let tm of data.teammatches) {
		teammatch_by_id.set(tm.matchid, tm);
	}

	data.active_teammatches = [];
	let active_teammatch_ids = new Set();
	for (let tm of data.teammatches) {
		var t1 = team_by_id.get(tm.team1id);
		var t2 = team_by_id.get(tm.team2id);
		var ohne_kampf = parse_bool(tm.flag_ok_gegen_team1) || parse_bool(tm.flag_ok_gegen_team2);

		if (! (t1.Status || t2.Status || ohne_kampf)) {
			data.active_teammatches.push(tm);
			active_teammatch_ids.add(tm.matchid);
		}
	}

	data.active_playermatches = [];
	for (let pm of data.playermatches) {
		if (active_teammatch_ids.has(pm.teammatchid)) {
			data.active_playermatches.push(pm);
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
			throw new Error('Konnte Spiel ' + JSON.stringify(teammatch_id) + ' nicht finden');
		}
		return res;
	};
	data.player_name = function(p) {
		return p.vorname + ' ' + p.name;
	};
}

module.exports = {
	enrich,
};