'use strict';

const laws = require('../laws');
const data_utils = require('../data_utils');


function* check_round(data, player, matches, o19) {
	let vrl_entry;
	const handled_tms = new Set();
	const played_else = [];

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
				if (vrl_entry.fixed_in === team.number) {
					// TODO check fixed_at

					// Correctly fixed here, we're done
					continue;
				}

				if (vrl_entry.fixed_in) {
					const message = (
						data.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' + 
						'(' + team.code + ') ' + team.name + ' festgespielt (Bundesliga!), ' +
						'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
						'Fest in ' + JSON.stringify(vrl_entry.fixed_in)
					);
					yield {
						type: 'vrl',
						teammatch_id: pm.teammatchid,
						player_id: player.spielerid,
						clubcode: vrl_entry.clubcode,
						vrl_typeid: vrl_entry.typeid,
						message,
					};
				} else {
					const message = (
						data.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' + 
						'(' + team.code + ') ' + team.name + ' festgespielt (Bundesliga!), ' +
						'aber im Eintrag in ' + data.vrl_name(vrl_entry.typeid) + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
						'kein F-Kennzeichen'
					);
					yield {
						type: 'vrl',
						teammatch_id: pm.teammatchid,
						player_id: player.spielerid,
						clubcode: vrl_entry.clubcode,
						vrl_typeid: vrl_entry.typeid,
						message,
					};
				}
			}

			continue;
		}

		if (!vrl_entry) {
			const club_id = team.clubcode;
			const vrl_type = laws.get_vrl_type(match_league_type, tm, player.sex);

			const ve = data.try_get_vrl_entry(club_id, vrl_type, player.spielerid);
			if (! ve) {
				continue; // Handled otherwise
			}
			const youth_in_o19 = (match_league_type === 'O19') && ((ve.vkz1 === 'J1') || (ve.vkz1 === 'S1') || (ve.vkz1 === 'M1'));
			if (youth_in_o19) {
				return; // Handled in vrl check
			}
			vrl_entry = ve;
		}

		if (team_id !== vrl_entry.teamcode) {
			played_else.push(tm);
			if (played_else.length === 3) {
				if (vrl_entry.fixed_in === team.number) {
					// TODO check fixed_at

					// Correctly fixed here, we're done
					continue;
				}

				let incorrect_fix = true;

				// Fixed in Bundesliga?
				if ((vrl_entry.fixed_in === '1') || (vrl_entry.fixed_in === '2')) {
					const fixed_in_team = vrl_entry.clubcode + '-' + vrl_entry.fixed_in;
					if (! data.try_get_team(fixed_in_team)) {
						incorrect_fix = false;
					}
				}

				if (incorrect_fix) {
					if (vrl_entry.fixed_in) {
						const message = (
							data.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' + 
							'(' + team.code + ') ' + team.name + ' festgespielt, ' +
							'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
							'Fest in ' + JSON.stringify(vrl_entry.fixed_in)
						);
						yield {
							type: 'vrl',
							teammatch_id: pm.teammatchid,
							player_id: player.spielerid,
							clubcode: vrl_entry.clubcode,
							vrl_typeid: vrl_entry.typeid,
							message,
						};
					} else {
						const message = (
							data.player_str(player) + ' hat sich am ' + tm.spieldatum + ' in ' + 
							'(' + team.code + ') ' + team.name + ' festgespielt, ' +
							'aber im Eintrag in ' + data.vrl_name(vrl_entry.typeid) + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
							'kein F-Kennzeichen'
						);
						yield {
							type: 'vrl',
							teammatch_id: pm.teammatchid,
							player_id: player.spielerid,
							clubcode: vrl_entry.clubcode,
							vrl_typeid: vrl_entry.typeid,
							message,
						};
					}
				}
			}
		}
		// TODO check after festgespielt without F
	}
}

function* check_player(data, player_id, matches_struct) {
	const player = data.get_player(player_id, true);
	if (player.is_buli) {
		return; // We only check those if they occur in the non-buli database
	}
	
	yield* check_round(data, player, matches_struct.hr, true);
	yield* check_round(data, player, matches_struct.hr, false);
	yield* check_round(data, player, matches_struct.rr, true);
	yield* check_round(data, player, matches_struct.rr, false);
}

module.exports = function*(season) {
	for (const [pid, matches_struct] of season.data.matches_by_player.entries()) {
		yield* check_player(season.data, pid, matches_struct);
	}
};
