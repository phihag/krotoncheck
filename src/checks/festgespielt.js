'use strict';

const data_utils = require('../data_utils');
const laws = require('../laws');
const utils = require('../utils');


function* check_fixed_date(player, team, vrl_entry, tm) {
	if (!vrl_entry.fixed_from) {
		const message = (
			data_utils.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' +
			'(' + team.code + ') ' + team.name + ' festgespielt, ' +
			'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' fehlt das "Fest ab"-Datum.'
		);
		yield {
			type: 'vrl',
			teammatch_id: tm.matchid,
			player_id: player.spielerid,
			clubcode: vrl_entry.clubcode,
			vrl_typeid: vrl_entry.typeid,
			message,
		};
		return;
	}

	if (vrl_entry.comment) {
		// May have filled up a team
		return;
	}

	const expected = utils.next_day(tm.ts);
	const fixed_from = utils.parse_date(vrl_entry.fixed_from);
	if (!utils.same_day(fixed_from, expected)) {
		const message = (
			'Falsche "Fest ab"-Angabe im Eintrag von ' +
			data_utils.player_str(player) + ' bei ' +
			'(' + team.code + ') ' + team.name +
			' in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ': ' +
			JSON.stringify(vrl_entry.fixed_from) + ', ' +
			'richtig wäre ' + JSON.stringify(utils.ts2dstr(expected))
		);
		yield {
			type: 'vrl',
			teammatch_id: tm.matchid,
			player_id: player.spielerid,
			clubcode: vrl_entry.clubcode,
			vrl_typeid: vrl_entry.typeid,
			message,
		};
	}

}

function* check_vrl_entry(data, should_fixed, vrl_entry, player) {
	if (!should_fixed.team) {
		if (vrl_entry.fixed_in) {
			if (vrl_entry.vkz3 === 'FIX') {
				return; // Manually fixed (usually by federation)
			}

			if (vrl_entry.comment) {
				return; // Special case, oftentimes moved up to fill team
			}

			const vrl_team = vrl_entry.teamcode ? data.get_team(vrl_entry.teamcode) : null;
			const message = (
				data_utils.player_str(player) +
				' steht in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' als ' +
				' Fest in ' + JSON.stringify(vrl_entry.fixed_in) +
				(vrl_entry.fixed_from ? (' (ab ' + vrl_entry.fixed_from + ')') : '') +
				', aber der Grund des Festspielens konnte nicht gefunden werden' +
				(vrl_entry.teamcode ? '' : ' (Reiner Bundesliga-Spieler!)') +
				((vrl_team && (vrl_entry.fixed_in === vrl_team.number)) ? ' (vkz3="FIX" beim Festschreiben vergessen?)' : '')
			);
			yield {
				type: 'vrl',
				player_id: player.spielerid,
				clubcode: vrl_entry.clubcode,
				vrl_typeid: vrl_entry.typeid,
				message,
			};
		}
		return;
	}

	if (should_fixed.team.number === vrl_entry.fixed_in) {
		// Correctly fixed, check date
		yield* check_fixed_date(player, should_fixed.team, vrl_entry, should_fixed.tm);
		return;
	}
	const team = should_fixed.team;
	const tm = should_fixed.tm;

	if (should_fixed.tm.is_buli) {
		if (vrl_entry.fixed_in) {
			const message = (
				data_utils.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' +
				'(' + team.code + ') ' + team.name + ' festgespielt (Bundesliga!), ' +
				'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
				'Fest in ' + JSON.stringify(vrl_entry.fixed_in)
			);
			yield {
				type: 'vrl',
				teammatch_id: should_fixed.tm.matchid,
				player_id: player.spielerid,
				clubcode: vrl_entry.clubcode,
				vrl_typeid: vrl_entry.typeid,
				message,
			};
		} else {
			const message = (
				data_utils.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' +
				'(' + team.code + ') ' + team.name + ' festgespielt (Bundesliga!), ' +
				'aber im Eintrag in ' + data.vrl_name(vrl_entry.typeid) + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' fehlt ' +
				'[Fest in] = ' + JSON.stringify(should_fixed.team.number) +
				' und [Fest ab] = ' + JSON.stringify(utils.ts2dstr(utils.next_day(tm.ts)))
			);
			yield {
				type: 'vrl',
				teammatch_id: should_fixed.tm.matchid,
				player_id: player.spielerid,
				clubcode: vrl_entry.clubcode,
				vrl_typeid: vrl_entry.typeid,
				message,
			};
		}
	} else { // Should be fixed in NRW
		if (vrl_entry.fixed_in) {
			const message = (
				data_utils.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' +
				'(' + team.code + ') ' + team.name + ' festgespielt, ' +
				'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
				'Fest in ' + JSON.stringify(vrl_entry.fixed_in) + (vrl_entry.fixed_from ? (' (ab ' + vrl_entry.fixed_from + ')') : '')
			);
			yield {
				type: 'vrl',
				teammatch_id: should_fixed.tm.matchid,
				player_id: player.spielerid,
				clubcode: vrl_entry.clubcode,
				vrl_typeid: vrl_entry.typeid,
				message,
			};
		} else {
			const message = (
				data_utils.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' +
				'(' + team.code + ') ' + team.name + ' festgespielt, ' +
				'aber im Eintrag in ' + data.vrl_name(vrl_entry.typeid) + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' fehlt ' +
				'[Fest in] = ' + JSON.stringify(should_fixed.team.number) +
				' und [Fest ab] = ' + JSON.stringify(utils.ts2dstr(utils.next_day(tm.ts)))
			);
			yield {
				type: 'vrl',
				teammatch_id: should_fixed.tm.matchid,
				player_id: player.spielerid,
				clubcode: vrl_entry.clubcode,
				vrl_typeid: vrl_entry.typeid,
				message,
			};
		}
	}
}

function* check_round(data, player, matches, is_hr, o19) {
	let vrl_entry;
	const handled_tms = new Set();
	const played_else = [];

	// object with the following keys:
	// - team     Team object we're fixed in
	// - tm       teammatch that caused the fixing
	let should_fixed = {};

	for (const pm of matches) {
		const tm = pm.tm;
		const match_league_type = data_utils.league_type(tm.staffelcode);
		if (((match_league_type === 'O19') || (match_league_type === 'Bundesliga')) !== (!!o19)) {
			continue; // Check later
		}

		const tm_id = (tm.is_buli ? 'buli_' : '') + pm.teammatchid;
		if (handled_tms.has(tm_id)) {
			continue;
		}
		handled_tms.add(tm_id);

		const is_team1 = (pm.team1spieler1spielerid === player.spielerid) || (pm.team1spieler2spielerid === player.spielerid);
		const team_id = tm[`team${is_team1 ? 1 : 2}id`];
		const team = data.get_team(team_id, true);

		if (tm.is_buli) {
			if (!vrl_entry) {
				const club_id = team.clubcode;
				const vrl_type = laws.get_vrl_type('O19', tm, player.sex);
				const ve = data.try_get_vrl_entry(club_id, vrl_type, player.spielerid, true);
				if (! ve) {
					continue; // Playing in another state, don't care
				}
				vrl_entry = ve;
			}

			if (! vrl_entry.teamcode) {
				continue; // Bundesliga-only player
			}

			played_else.push(tm);
			if (played_else.length === 3) {
				should_fixed = {team, tm};
			} else if ((played_else.length > 3) && !should_fixed.tm.is_buli) {
				// §61.2.2 SpO final clause
				should_fixed = {team, tm};
			}

			continue;
		}
		// Non-BuLi from here on

		if (!vrl_entry) {
			const club_id = team.clubcode;
			const vrl_type = laws.get_vrl_type(match_league_type, tm, player.sex);
			let ve = data.try_get_vrl_entry(club_id, vrl_type, player.spielerid);


			if ((! ve) && (! o19) && (match_league_type === 'U19')) {
				const mini_vrl_type = laws.get_vrl_type('Mini', tm, player.sex);
				ve = data.try_get_vrl_entry(club_id, mini_vrl_type, player.spielerid);
			}
			if ((! ve) && (! o19) && (match_league_type === 'Mini')) {
				const mini_vrl_type = laws.get_vrl_type('U19', tm, player.sex);
				ve = data.try_get_vrl_entry(club_id, mini_vrl_type, player.spielerid);
			}

			if (! ve) {
				continue; // Handled otherwise
			}
			const youth_in_o19 = (match_league_type === 'O19') && ((ve.vkz1 === 'J1') || (ve.vkz1 === 'S1') || (ve.vkz1 === 'M1'));
			if (youth_in_o19) {
				continue; // Handled in vrl check
			}
			vrl_entry = ve;
		}

		if (team_id !== vrl_entry.teamcode) {
			played_else.push(tm);
			if (played_else.length === 3) {
				should_fixed = {team, tm};
			}
		}

		if (should_fixed.team && (should_fixed.team.code !== team.code) && !vrl_entry.fixed_in) {
			if (pm[`flag_umwertung_gegen_team${is_team1 ? 1 : 2}`] || pm.flag_keinspiel_keinespieler) {
				continue;
			}

			const message = (
				data_utils.player_str(player) +
				' hat sich am ' + should_fixed.tm.spieldatum + ' in (' + should_fixed.team.code + ') ' + should_fixed.team.name + ' festgespielt, ' +
				'hat aber danach am ' + tm.spieldatum +
				' für (' + team.code + ') ' + team.name + ' gespielt.'
			);
			yield {
				player_id: player.spielerid,
				teammatch_id: pm.teammatchid,
				message,
			};
		}
	}

	if (!vrl_entry && (matches.length === 0)) {
		// Look up VRL entry in the main club instead
		const vrl_type = laws.get_round_vrl_type(o19 ? 'O19' : 'U19', is_hr, player.sex);
		vrl_entry = data.try_get_vrl_entry(player.clubid, vrl_type, player.spielerid, true);
		if (!vrl_entry && !o19) {
			vrl_entry = data.try_get_vrl_entry(player.clubid, 'Mini', player.spielerid, true);
		}
	}

	if (vrl_entry) {
		yield* check_vrl_entry(data, should_fixed, vrl_entry, player);
	}
}

function* check_player(data, player_id, matches_struct) {
	const player = data.get_player(player_id, true);
	if (player.is_buli) {
		return; // We only check those if they occur in the non-buli database
	}
	
	yield* check_round(data, player, matches_struct.hr, true, true);
	yield* check_round(data, player, matches_struct.hr, true, false);
	yield* check_round(data, player, matches_struct.rr, false, true);
	yield* check_round(data, player, matches_struct.rr, false, false);
}

module.exports = function*(season) {
	for (const [pid, matches_struct] of season.data.matches_by_player.entries()) {
		yield* check_player(season.data, pid, matches_struct);
	}
};
