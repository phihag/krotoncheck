'use strict';
const levenshtein = require('fast-levenshtein');

const umpire_mail = require('../umpire_mail');


module.exports = function*(season) {
	const data = season.data;

	for (const tm of data.teammatches) {
		if (!['O19-RL', 'O19-GW-RL'].includes(tm.eventname)) {
			continue;
		}

		if ((tm.winner == 0) || !tm.detailergebnis_eintragedatum) {
			// Match not played / entered yet
			continue;
		}

		const sr = data.get_matchfield(tm, 'Namen der Schiedsrichter (nur Regionalliga), ggf. Absagen');
		if (!sr) {
			if (data.get_stb_note(tm.matchid, text => text.includes('Schiedsrichter'))) {
				// Already noted
				continue;
			}

			let message = 'Keine Schiedsrichter in der Regionalliga';

			if (data.get_comment(tm.matchid, text => text.includes('Schiedsrichter'))) {
				message += ' (als Kommentar vom Verein nachgeliefert?)';
			}

			yield {
				teammatch_id: tm.matchid,
				message,
			};
			continue;
		}

		if (sr.includes('erschienen')) {
			continue;
		}

		if (!season.umpire_index) {
			continue;
		}

		const umpire_names = umpire_mail.parse_names(sr);
		if (!/[A-ZÄÖÜ]\w+\s[A-ZÄÖÜ]\w+/.test(sr) && (umpire_names.length !== 2)) {
			console.error('cannot parse umpire names ' + umpire_names);
			continue;
		}

		for (const uname of umpire_names) {
			if (season.umpire_index.has(uname)) {
				continue;
			}

			let min_diff = Infinity;
			let candidates = [];
			for (const [short_name, full_name] of season.umpire_index.entries()) {
				const diff = levenshtein.get(uname, short_name);
				if (diff < min_diff) {
					min_diff = diff;
					candidates = [full_name];
				} else if (diff === min_diff) {
					if (!candidates.includes(full_name)) {
						candidates.push(full_name);
					}
				}
			}

			if (min_diff > 5) {
				yield {
					teammatch_id: tm.matchid,
					message: `Neuer Schiedsrichter ${JSON.stringify(uname)}, Philipp Hagemeister muss ihn/sie eintragen.`,
					stb: {
						firstname: 'Philipp',
						middlename: '',
						lastname: 'Hagemeister',
						email: 'philipp.hagemeister@badminton-nrw.de',
					},
				};
				continue;
			}

			const message = (
				'Unbekannter Schiedsrichter ' + JSON.stringify(uname) + '. ' +
				'Vielleicht ' + candidates.slice(0, 3).join(' oder ') + '?'
			);

			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}
	}
};