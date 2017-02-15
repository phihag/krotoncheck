'use strict';

const data_utils = require('../data_utils');

const WINNER_DISABLED = true;


module.exports = function*(season) {
	const data = season.data;

	for (const pm of data.playermatches) {
		if (pm.flag_aufgabe_team1 || pm.flag_aufgabe_team2 || pm.flag_umwertung_gegen_team1 || pm.flag_umwertung_gegen_team2 || pm.flag_keinspiel_keinespieler || pm.flag_keinspiel_keinspieler_team1 || pm.flag_keinspiel_keinspieler_team2) {
			// handled by other checks
			continue;
		}

		for (let team = 1;team <= 2;team++) {
			let sum = 0;
			for (let game = 1;game <= pm.setcount;game++) {
				sum += pm[`set${game}team${team}`];
			}

			const in_table = pm[`team${team}spielpunkte`];
			if (sum !== in_table) {
				const tm = data.get_teammatch(pm.teammatchid);
				const team_name = tm[`team${team}name`];

				const message = (
					team_name + ' hat im ' + data_utils.match_name(pm) + ' ' +
					sum + ' Ballwechselpunkte erzielt, aber die angegebene Summe ist ' + in_table
				);
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}

		let games = [0, 0];
		for (let game = 1;game <= pm.setcount;game++) {
			if (pm[`set${game}team1`] > pm[`set${game}team2`]) {
				games[0]++;
			} else if (pm[`set${game}team1`] < pm[`set${game}team2`])  {
				games[1]++;
			}
		}

		for (let team_id = 1;team_id <= 2;team_id++) {
			const correct_games = games[team_id - 1];
			const in_table = pm[`team${team_id}sets`];
			if (correct_games !== in_table) {
				const tm = data.get_teammatch(pm.teammatchid);
				const team_name = tm[`team${team_id}name`];

				const message = (
					team_name + ' hat im ' + data_utils.match_name(pm) + ' ' +
					correct_games + ' Sätze gewonnen, aber die angegebene Satzsumme ist ' + in_table
				);
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}

		if (!WINNER_DISABLED) {
			const correct_winner = ((games[0] > games[1]) ? 1 : ((games[0] < games[1]) ? 2 : 0));
			const table_winner = pm.winner;
			if (correct_winner !== table_winner) {
				const tm = data.try_get_teammatch(pm.teammatchid);
				if (!tm) {
					continue; // Match not played
				}
				const team_name = tm[`team${correct_winner}name`];
				const lost_team_name = tm[`team${3 - correct_winner}name`];

				const message = (
					team_name + ' hat das ' + data_utils.match_name(pm) + ' ' +
					'gewonnen, aber als Sieger ist ' + lost_team_name + ' eingetragen'
				);
				yield {
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}
	}
};
