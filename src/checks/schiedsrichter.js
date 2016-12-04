'use strict';

module.exports = function*(season, data) {
	for (const tm of data.teammatches) {
		if (tm.eventname !== 'O19-RL') {
			continue;
		}

		if (tm.winner == 0) {
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