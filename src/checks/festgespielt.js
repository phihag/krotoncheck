'use strict';

const laws = require('../laws');


function* check_round(data, player, matches) {
	let vrl_entry;
	let league_type;
	const handled_tms = new Set();
	const played_else = [];

	for (const pm of matches) {
		if (handled_tms.has(pm.teammatchid)) {
			continue;
		}
		handled_tms.add(pm.teammatchid);

		const tm = pm.tm;
		const is_team1 = (pm.team1spieler1spielerid === player.spielerid) || (pm.team1spieler2spielerid === player.spielerid);
		const team_id = tm[`team${is_team1 ? 1 : 2}id`];
		const match_league_type = data.league_type(tm.staffelcode);
		const team = data.get_team(team_id);

		if (vrl_entry) {
			if ((match_league_type === 'O19') && (league_type !== 'O19')) {
				continue; // Youth in O19, handled in vrl check
			}
		} else {
			const club_id = team.clubcode;
			const vrl_type = laws.get_vrl_type(match_league_type, tm, player.sex);

			const ve = data.try_get_vrl_entry(club_id, vrl_type, player.spielerid);
			if (! ve) {
				continue; // Handled otherwise
			}
			const youth_in_o19 = (match_league_type === 'O19') && (ve.jkz1 || ve.vkz1);
			if (youth_in_o19) {
				continue; // Handled in vrl check
			}
			vrl_entry = ve;
			league_type = match_league_type;
		}

		if (team_id !== vrl_entry.teamcode) {
			played_else.push(tm);
			if (played_else.length === 3) {
				if (vrl_entry.fixed_in === team.number) {
					// TODO check fixed_at

					// Correctly fixed here, we're done
					return;
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
							'aber im Eintrag in VRL ' + vrl_entry.typeid + ' von (' + vrl_entry.clubcode + ') ' + vrl_entry.clubname + ' steht ' +
							'kein F-Kennzeichen'
						);
						yield {
							type: 'fixed',
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
	const player = data.get_player(player_id);
	
	yield* check_round(data, player, matches_struct.hr);
	yield* check_round(data, player, matches_struct.rr);
}

module.exports = function*(season) {
	for (const [pid, matches_struct] of season.data.matches_by_player.entries()) {
		yield* check_player(season.data, pid, matches_struct);
	}
};