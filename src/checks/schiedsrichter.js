'use strict';

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

			yield {
				teammatch_id: tm.matchid,
				message: 'Keine Schiedsrichter in der Regionalliga',
			};
		}
	}
};