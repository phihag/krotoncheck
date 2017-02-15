'use strict';

const data_utils = require('../data_utils');
const laws = require('../laws');
const utils = require('../utils');


function matches_by_disciplines(pms) {
	const res = utils.make_multi_index(pms, pm => pm.disziplin);
	for (const dpms of res.values()) {
		dpms.sort((pm1, pm2) => utils.cmp(pm1.matchtypeno, pm2.matchtypeno));
	}
	return res;
}

function* check_tm(data, tm, pms, team_idx) {
	const matches_by_player = new Map();
	const holes = new Map(); // true: not enough player

	for (const pm of pms) {
		const p1id = pm[`team${team_idx}spieler1spielerid`];
		const p2id = pm[`team${team_idx}spieler2spielerid`];
		const is_doubles = laws.is_doubles(pm.disziplin);

		if (!p1id || (is_doubles && !p2id)) {
			holes.set(pm.matchid, true);
		}

		// Not enough players for doubles?
		if (is_doubles) {
			const present_id = (!p1id && p2id) ? p2id : ((p1id && !p2id) ? p1id : null);
			if (present_id) {
				const present_player = data.get_player(present_id);
				const message = (
					'Nur 1 Spieler im ' +
					data_utils.match_name(pm) + ' für ' +
					tm[`team${team_idx}name`] + ' (' + tm[`team${team_idx}id`] + '): ' +
					data_utils.player_str(present_player)
				);
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message: message,
				};
			}
		}

		if (!p1id && !p2id && !pm.flag_keinspiel_keinespieler && !pm[`flag_keinspiel_keinspieler_team${team_idx}`] && (pm.winner != 0)) {
			const message = (
				'Spieler von ' + tm[`team${team_idx}name`] + ' (' + tm[`team${team_idx}id`] + ') ' +
				'fehlen im ' + data_utils.match_name(pm) +
				' ("Keine Spieler" falsch eingetragen?)'
			);
			yield {
				teammatch_id: pm.teammatchid,
				match_id: pm.matchid,
				message: message,
			};
		}

		for (const player_id of [p1id, p2id]) {
			if (! player_id) {
				continue;
			}
			let matches = matches_by_player.get(player_id);
			if (!matches) {
				matches = [];
				matches_by_player.set(player_id, matches);
			}
			matches.push(pm);
		}
	}

	for (const [pcode, pms] of matches_by_player.entries()) {
		if ((pms.length >= 3) && (!pms.every(pm => pm['flag_umwertung_gegen_team' + team_idx] || pm.flag_keinspiel_keinespieler))) {
			const player = data.get_player(pcode);
			const message = (
				data_utils.player_str(player) + ' hat ' + pms.length + ' Spiele ' +
				'(' + pms.map(data_utils.match_name).join(', ') + ') ' +
				'gespielt (§57.3a SpO)'
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}

		const played = [];
		for (const pm of pms) {
			if (pm['flag_umwertung_gegen_team' + team_idx] || pm.flag_keinspiel_keinespieler) {
				continue;
			}

			if (played.includes(pm.disziplin)) {
				const player = data.get_player(pcode);
				const message = (
					data_utils.player_str(player) + ' hat ' +
					pms.map(data_utils.match_name).join(' und ') +
					' gespielt (Verstoß gegen §57.3b SpO)'
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}

			played.push(pm.disziplin);
		}
	}

	for (const dpms of matches_by_disciplines(pms).values()) {
		let missing;
		for (const pm of dpms) {
			const is_hole = holes.get(pm.matchid);
			if (is_hole) {
				missing = pm;
			} else if (missing) {
				if (pm[`flag_umwertung_gegen_team${team_idx}`]) { // Already handled
					continue;
				}

				const message = (
					tm[`team${team_idx}name`] + ' hat nicht genügend Spieler im ' +
					data_utils.match_name(missing) + ' aufgestellt; damit ' +
					'muss auch das ' + data_utils.match_name(pm) + ' umgewertet werden'
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		}
	}
}

function* check(data, tm) {
	let pms = data.get_playermatches_by_teammatch_id(tm.matchid);

	yield* check_tm(data, tm, pms, 1);
	yield* check_tm(data, tm, pms, 2);
}


module.exports = function*(season) {
	for (var tm of season.data.active_teammatches) {
		yield* check(season.data, tm);
	}
};