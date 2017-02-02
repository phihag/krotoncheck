'use strict';

const laws = require('../laws.js');
const utils = require('../utils.js');

module.exports = function*(season) {
	for (const team of season.data.teams) {
		if (team.Status === 'Mannschaftsrückzug') {
			continue;
		}

		const forced = laws.forced_retreat(season.data, team.code);
		if (forced) {
			const message = (
				'(' + team.code + ') ' + team.name + ' hat am ' + utils.ts2dstr(forced.ts) +
				' zum dritten Mal kampflos aufgegeben,' +
				' ist aber nicht als zurückgezogen markiert (§68.2b SpO)'
			);
			yield {
				teammatch_id: forced.matchid,
				message,
			};
		}
	}
};