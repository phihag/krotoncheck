'use strict';

// Did a player play multiple times at a day?

function extract_date(tm) {
	const m = /^([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}) [0-9]{2}:[0-9]{2}:[0-9]{2}$/.exec(tm.spieldatum);
	if (!m) {
		throw new Error('Cannot parse date ' + JSON.stringify(tm.spieldatum) + ' of teammatch ' + tm.mathcid + '!');
	}
	return m[1];
}

function all_players(data, tm, team_idx) {
	let res = new Set();
	const pms = data.get_playermatches_by_teammatch_id(tm.matchid);
	for (const pm of pms) {
		if (pm['flag_umwertung_gegen_team' + team_idx]) { // Already noted
			continue;
		}
		for (let player_idx = 1;player_idx <= 2;player_idx++) {
			let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
			if (player_id) {
				res.add(player_id);
			}
		}
	}
	return res;
}

module.exports = function*(season) {
	const data = season.data;
	const players_by_date = new Map();

	for (const tm of data.teammatches) {
		const date = extract_date(tm);
		let today = players_by_date.get(date);
		if (!today) {
			today = new Map();
			players_by_date.set(date, today);
		}

		for (let team_idx = 1;team_idx <= 2;team_idx++) {
			const team_id = tm['team' + team_idx + 'id'];
			const team_players = all_players(data, tm, team_idx).values();

			for (const player_id of team_players) {
				var already_played = today.get(player_id);
				if (already_played) {
					if (already_played.team_id !== team_id) {
						const p = data.get_player(player_id);
						const message = (
							data.player_str(p) + ' hat am ' + date + ' für zwei verschiedene Mannschaften gespielt: ' +
							already_played.tm.team1name + ' - ' + already_played.tm.team2name + ' (' + already_played.tm.spieldatum + ')' + ' und ' +
							tm.team1name + ' - ' + tm.team2name + ' (' + tm.spieldatum + ')'
						);

						yield {
							teammatch_id: tm.matchid,
							teammatch2_id: already_played.tm.matchid,
							message: message,
						};
					}
				} else {
					today.set(player_id, {
						team_id: team_id,
						tm: tm,
					});
				}
			}
		}
	}
};