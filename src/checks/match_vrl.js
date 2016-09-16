'use strict';

var utils = require('../utils.js');

function get_vrl_type(tm, pm, player_idx) {
	if (! /^[HR]$/.test(tm.runde)) {
		throw new Error('Ungültige Runde ' + tm.runde);
	}
	var is_hr = tm.runde === 'H';

	if ((pm.disziplin === 'HD') || (pm.disziplin === 'HE') || ((pm.disziplin === 'GD') && player_idx === 1)) {
		return is_hr ? 9 : 11;
	}
	if ((pm.disziplin === 'DD') || (pm.disziplin === 'DE') || ((pm.disziplin === 'GD') && player_idx === 2)) {
		return is_hr ? 10 : 12;
	}
	throw new Error('Unsupported discipline in match ' + pm);
}

function* check_all(data, tm, pms, team_idx) {
	let team = data.get_team(tm['team' + team_idx + 'id']);

	// Check if everyone present in VRL
	for (let pm of pms) {
		if (pm['flag_umwertung_gegen_team' + team_idx]) {
			continue; // Already handled
		}

		for (let player_idx = 1;player_idx <= 2;player_idx++) {
			let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
			if (!player_id) {
				continue;
			}
			let vrl_type = get_vrl_type(tm, pm, player_idx);

			let ve = data.get_vrl_entry(team.clubcode, vrl_type, player_id);
			if (!ve) {
				let player = data.get_player(player_id);
				if ((pm.disziplin === 'GD') && (
					((player_idx === 1) && (player.gender !== 'M')) ||
					((player_idx === 2) && (player.gender !== 'F')))) {
					// Incorrect gender, handled in mixed_geschlecht check
					continue;
				}

				let player_str = player.vorname + ' ' + player.name + '(' + player_id + ')';

				let message = (
					'Kein VRL-Eintrag (Spalte ' + vrl_type + ') für ' + player_str +
					' im Verein ' + team.clubcode + '!');
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message: message,
				};
			}
		}
	}
}

function* check(data, tm) {
	if (data.league_type(tm) !== 'O19') {
		return;
	}

	let pms = data.get_playermatches_by_teammatch_id(tm.matchid);
	/*let pms_by_discipline = new Map();
	for (let pm of pms) {
		let dpms = pms_by_discipline.get(pm.disziplin);
		if (!dpms) {
			dpms = [];
			pms_by_discipline.set(pm.disziplin, dpms);
		}
		dpms.push(pm);
	}*/

	yield* check_all(data, tm, pms, 1);
	yield* check_all(data, tm, pms, 2);
}


module.exports = function*(season, data) {
	for (var tm of data.active_teammatches) {
		yield* check(data, tm);
	}
};