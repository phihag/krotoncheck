'use strict';

var utils = require('../utils');

function* check_tm(now, tm) {
	if (tm.flag_ok_gegen_team1 || tm.flag_ok_gegen_team2) {
		return; // Not played at all
	}

	const played = utils.parse_date(tm.spieldatum);

	const team_entered = tm.mannschaftsergebnis_eintragedatum ? utils.parse_date(tm.mannschaftsergebnis_eintragedatum) : null;
	const entered = tm.detailergebnis_eintragedatum ? utils.parse_date(tm.detailergebnis_eintragedatum) : null;
	if (team_entered !== null) {
		if (team_entered < played) {
			const message = (
				'Mannschaftsergebnis vor Spieldatum eingetragen ' +
				'(' + tm.mannschaftsergebnis_eintragedatum +
				' vor ' + tm.spieldatum + ')' +
				' - nicht eingetragene Vorverlegung?');
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
		// TODO check that this fulfills OL regulations
	} else {
		// TODO only if entered is not set itself
		// TODO in OL too late?
	}

	const report_until = (
		[5, 6].includes(utils.weekday(played)) ?
		(0)
		: (played + 48 * 3600000));
	if (entered !== null) {
				if (entered < played) {
			const message = (
				'Detailergebnis vor Spieldatum eingetragen ' +
				'(' + tm.detailergebnis_eintragedatum +
				' vor ' + tm.spieldatum + ')' +
				' - nicht eingetragene Vorverlegung?');
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
		// TODO compare to played
		// TODO check that this fulfills league regulations
	} else {
		// TODO too late?
	}
}

module.exports = function*(season, data) {
	for (const tm of data.teammatches) {
		yield* check_tm(season.check_now, tm);
	}
};