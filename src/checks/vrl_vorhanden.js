'use strict';
// Check that appropriate VRLs exist for all clubs

const data_utils = require('../data_utils');

module.exports = function*(season) {
	if (data_utils.is_preseason(season)) {
		return;
	}

	const data = season.data;
	for (const club of data.clubs) {
		const club_vrls = data.vrls_by_clubs.get(club.code);
		const club_vrl_ids = club_vrls ? Array.from(club_vrls.keys()) : [];
		const teams = data.try_get_teams_by_club(club.code);

		const expected_types = new Set();
		for (const team of teams) {
			if (team.Status) { // Retreated
				continue;
			}

			if (!team.DrawID) { // Bundesliga or so
				continue;
			}

			const league_type = data_utils.league_type(team.DrawID);
			if (league_type === 'O19') {
				expected_types.add(9);
				expected_types.add(10);
			} else if (league_type === 'U19') {
				expected_types.add(14);
				expected_types.add(17);
			} else if (league_type === 'Mini') {
				expected_types.add(17);
			} else if (league_type === 'Bundesliga') {
				// Ignore
			} else {
				throw new Error('Invalid league_type: ' + league_type);
			}
		}

		for (const typeid of expected_types) {
			if (! club_vrl_ids.includes(typeid)) {
				const message = (
					`${data.vrl_name(typeid)} von (${club.code}) ${club.name} fehlt`
				);

				yield {
					type: 'vrl',
					vrl_typeid: typeid,
					clubcode: club.code,
					message,
				};
			}
		}
	}
};
