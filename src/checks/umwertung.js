'use strict';

module.exports = function*(season) {
	for (const pm of season.data.playermatches) {
		if (pm.flag_umwertung_gegen_team1 && (pm.setcount === 2) &&
				(pm.set1team1 === 0) && (pm.set1team2 === 21) &&
				(pm.set2team1 === 0) && (pm.set2team2 === 21)) {
			yield {
				teammatch_id: pm.teammatchid,
				match_id: pm.matchid,
				message: 'Punktestand bei Umwertung gelöscht.',
			};
		}

		if (pm.flag_umwertung_gegen_team2 && (pm.setcount === 2) &&
				(pm.set1team1 === 21) && (pm.set1team2 === 0) &&
				(pm.set2team1 === 21) && (pm.set2team2 === 0)) {
			yield {
				teammatch_id: pm.teammatchid,
				match_id: pm.matchid,
				message: 'Punktestand bei Umwertung gelöscht.',
			};
		}
	}
};