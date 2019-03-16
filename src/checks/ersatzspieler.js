'use strict';

const data_utils = require('../data_utils');


function all_players(data, tm) {
	let res = new Set();
	const pms = data.get_playermatches_by_teammatch_id(tm.matchid);
	for (let team_idx = 1;team_idx <= 2;team_idx++) {
		for (const pm of pms) {
			for (let player_idx = 1;player_idx <= 2;player_idx++) {
				let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
				if (player_id) {
					res.add(player_id);
				}
			}
		}
	}
	return res;
}

module.exports = function*(season) {
	const data = season.data;

	for (const tm of data.teammatches) {
		const backup_players = data.get_matchfield(tm, 'vorgesehene Ersatzspieler (NUR Verbandsliga aufwärts, § 58 SpO)');
		const is_high_league = /^O19-(?:(?:GW-)?OL|(?:GW-)?RL|[SN][12]-VL)$/.test(tm.eventname);
		const notes = data.get_matchfield(tm, 'weitere \'Besondere Vorkommnisse\' lt. Original-Spielbericht');
		const resigned = data.get_resigned_field(tm);

		if (!backup_players) {
			if (is_high_league) {
				const BACKUP_PLAYER_RE = /(?:spielte? (?:statt|anstatt|für|aufgrund))|ersetzt/;
				if (notes && BACKUP_PLAYER_RE.exec(notes)) {
					const message = (
						'Potenzieller Einsatz eines Ersatzspielers ohne Eintrag im Feld "vorgesehene Ersatzspieler" ' +
						' (besonderes Vorkommnis: ' + JSON.stringify(notes) + ')'
					);
					yield {
						teammatch_id: tm.matchid,
						message,
					};
				} else if (resigned && BACKUP_PLAYER_RE.exec(resigned)) {
					const message = (
						'Potenzieller Einsatz eines Ersatzspielers ohne Eintrag im Feld "vorgesehene Ersatzspieler" ' +
						' (Aufgabe: ' + JSON.stringify(resigned) + ')'
					);
					yield {
						teammatch_id: tm.matchid,
						message,
					};
				}
			}
			continue;
		}

		if (! is_high_league) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Eintrag im Feld "vorgesehene Ersatzspieler" unterhalb Verbandsliga (vgl. §61.3 SpO)',
			};
			continue;
		}

		for (const player_id of all_players(data, tm)) {
			const player = data.get_player(player_id);
			const names = [
				player.vorname + ' ' + player.name,
				player.vorname.substring(0, 1) + '. ' + player.name,
				player.name + ', ' + player.vorname,
				player.name + ', ' + player.vorname.substring(0, 1) + '.',
			];
			const includes_names = text => names.some(name => text.includes(name));

			if (! includes_names(backup_players)) {
				continue;
			}

			if (notes && includes_names(notes)) {
				continue;
			}

			// Not the correct place to put it in, but let's tolerate it
			if (resigned && includes_names(resigned)) {
				continue;
			}

			const message = (
				'Vorgesehener Ersatzspieler ' + data_utils.player_str(player) + ' eingetzt, aber ' +
				(notes ?
					'Einsatz nicht in "Besondere Vorkommnisse" erwähnt' :
					'kein Eintrag "Besondere Vorkommnisse"'));
			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}
	}
};
