'use strict';

var utils = require('../utils.js');

function get_vrl_type(league_type, tm, pm, player_idx) {
	if (! /^[HR]$/.test(tm.runde)) {
		throw new Error('Ungültige Runde ' + tm.runde);
	}
	const is_hr = (tm.runde === 'H');

	if (league_type === 'O19') {
		if ((pm.disziplin === 'HD') || (pm.disziplin === 'HE') || ((pm.disziplin === 'GD') && player_idx === 1)) {
			return is_hr ? 9 : 11;
		}
		if ((pm.disziplin === 'DD') || (pm.disziplin === 'DE') || ((pm.disziplin === 'GD') && player_idx === 2)) {
			return is_hr ? 10 : 12;
		}
	} else if (league_type == 'Mini') {
		return is_hr ? 17 : 18;
	} else if (league_type == 'U19') {
		if ((pm.disziplin === 'HD') || (pm.disziplin === 'HE') || ((pm.disziplin === 'GD') && player_idx === 1)) {
			return is_hr ? 17 : 18;
		}
		if ((pm.disziplin === 'DD') || (pm.disziplin === 'DE') || ((pm.disziplin === 'GD') && player_idx === 2)) {
			return is_hr ? 14 : 16;
		}
	} else {
		throw new Error('Unsupported league type ' + league_type);
	}

	throw new Error('Unsupported discipline ' + JSON.stringify(pm.disziplin) + ' in match ' + pm.matchid);
}

function is_doubles(discipline) {
	return ((discipline === 'HD') || (discipline === 'GD') || (discipline === 'DD'));
}

function contains_backup_player(data, tm, players) {
	const backup_players = data.get_matchfield(tm, 'vorgesehene Ersatzspieler (NUR Verbandsliga aufwärts, § 58 SpO)');
	if (!backup_players) {
		return false;
	}

	const notes = data.get_matchfield(tm, 'weitere \'Besondere Vorkommnisse\' lt. Original-Spielbericht');
	if (!notes) {
		return false;
	}

	for (const p of players) {
		if (backup_players.includes(p.name) && notes.includes(p.name)) {
			return true;
		}
	}
	return false;
}

function* check_all(data, tm, pms, team_idx) {
	const team = data.get_team(tm['team' + team_idx + 'id']);
	const league_type = data.league_type(tm.staffelcode);
	const pm_ratings_by_discipline = {};

	// Check if everyone present in VRL
	for (let pm of pms) {
		if (pm['flag_umwertung_gegen_team' + team_idx]) {
			continue; // Already handled
		}

		const pm_is_doubles = is_doubles(pm.disziplin);

		if (!pm_ratings_by_discipline[pm.disziplin]) {
			pm_ratings_by_discipline[pm.disziplin] = [];
		}
		const match_ratings = {
			pm: pm,
			ratings: [],
			player_ids: [],
		};

		for (let player_idx = 1;player_idx <= 2;player_idx++) {
			let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
			if (!player_id) {
				continue;
			}
			let vrl_type = get_vrl_type(league_type, tm, pm, player_idx);

			let ve = data.get_vrl_entry(team.clubcode, vrl_type, player_id);
			if (!ve) {
				let player = data.get_player(player_id);
				if ((pm.disziplin === 'GD') && (
					((player_idx === 1) && (player.sex === 'F')) ||
					((player_idx === 2) && (player.sex === 'M')))) {
					// Incorrect gender, handled in mixed_geschlecht check
					continue;
				}
				if (league_type === 'U19') {
					// Look up in Mini database
					const mini_vrl_type = get_vrl_type('Mini', tm, pm, player_idx);
					const mini_ve = data.get_vrl_entry(team.clubcode, mini_vrl_type, player_id);
					if (mini_ve) {
						continue;
					}
				}

				const message = (
					'Kein ' + league_type + '-VRL-Eintrag für ' + data.player_str(player) +
					' bei ' + team.name + '.'); // Spalte vrl_type
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message: message,
				};
				continue;
			}

			let pos = parseInt(ve.teamposition);
			if (pm_is_doubles && ve.teampositiondouble) {
				pos = parseInt(ve.teampositiondouble);
			}
			match_ratings.ratings.push(pos);
			match_ratings.player_ids.push(player_id);
		}

		const expected_players = pm_is_doubles ? 2 : 1;
		if (match_ratings.ratings.length === expected_players) {
			pm_ratings_by_discipline[pm.disziplin].push(match_ratings);
		}
	}

	// Check that all ratings match
	for (const discipline in pm_ratings_by_discipline) {
		let match_ratings = pm_ratings_by_discipline[discipline];
		if (match_ratings.length < 2) {
			continue;
		}

		for (let i = 0;i < match_ratings.length - 1;i++) {
			let mr1 = match_ratings[i];
			let mr2 = match_ratings[i + 1];

			if (is_doubles(discipline)) {
				const sum1 = mr1.ratings[0] + mr1.ratings[1];
				const min1 = Math.min(mr1.ratings[0], mr1.ratings[1]);
				const sum2 = mr2.ratings[0] + mr2.ratings[1];
				const min2 = Math.min(mr2.ratings[0], mr2.ratings[1]);

				if ((sum1 < sum2) || ((sum1 === sum2) && (min1 < min2))) {
 					continue;
 				}

				if (mr1.pm.flag_keinspiel_keinespieler && mr2.pm.flag_keinspiel_keinespieler) {
					continue; // Both sides wrong?
				}

				let p1a = data.get_player(mr1.player_ids[0]);
				let p1b = data.get_player(mr1.player_ids[1]);
				let p2a = data.get_player(mr2.player_ids[0]);
				let p2b = data.get_player(mr2.player_ids[1]);

				if (contains_backup_player(data, tm, [p1a, p1b, p2a, p2b])) {
					continue;
				}

				const message = (
					'Doppel falsch aufgestellt: ' +
					data.match_name(mr1.pm) + ' ' +
						data.player_name(p1a) + ' DVRL #' + mr1.ratings[0] + '' + ' / ' +
						data.player_name(p1b) + ' DVRL #' + mr1.ratings[1] + '.\n' +
					data.match_name(mr2.pm) + ' ' +
						data.player_name(p2a) + ' DVRL #' + mr2.ratings[0] + '' + ' / ' +
						data.player_name(p2b) + ' DVRL #' + mr2.ratings[1] + '.'
				);
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
 			} else {
 				// Singles
 				if (mr1.ratings[0] < mr2.ratings[0]) {
 					continue;
 				}

				if (mr1.pm.flag_keinspiel_keinespieler && mr2.pm.flag_keinspiel_keinespieler) {
					continue; // Both sides wrong?
				}

				let p1 = data.get_player(mr1.player_ids[0]);
				let p2 = data.get_player(mr2.player_ids[0]);

				if (contains_backup_player(data, tm, [p1, p2])) {
					continue;
				}

				const message = (
						'Einzel falsch aufgestellt: ' +
						data.player_str(p1) + ' ist VRL #' + mr1.ratings[0] + ' und hat ' + data.match_name(mr1.pm) + ' gespielt. ' +
						data.player_str(p2) + ' ist VRL #' + mr2.ratings[0] + ' und hat ' + data.match_name(mr2.pm) + ' gespielt.');
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
 			}
		}
	}
}

function* check(data, tm) {
	let pms = data.get_playermatches_by_teammatch_id(tm.matchid);

	yield* check_all(data, tm, pms, 1);
	yield* check_all(data, tm, pms, 2);
}


module.exports = function*(season, data) {
	for (var tm of data.active_teammatches) {
		yield* check(data, tm);
	}
};