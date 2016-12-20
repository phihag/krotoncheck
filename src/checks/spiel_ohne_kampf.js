'use strict';

function* check_both(data, pm) {
	if (! pm.flag_keinspiel_keinespieler) {
		return;
	}

	if (pm.flag_keinspiel_keinspieler_team1 || pm.flag_keinspiel_keinspieler_team2) {
		return; // Handled by separate check (see below)
	}

	let tm = data.get_teammatch(pm.teammatchid);

	// Already handled?
	if (pm.flag_umwertung_gegen_team1 || pm.flag_umwertung_gegen_team2) {
		return;
	}
	if (tm.flag_umwertung_gegen_team1 || tm.flag_umwertung_gegen_team2 || tm.flag_umwertung_gegen_team1_beide || tm.flag_umwertung_gegen_team2_beide || tm.flag_umwertung_gegen_beide) {
		return;
	}

	if (pm.setcount) {
		yield {
			match_id: pm.matchid,
			teammatch_id: pm.teammatchid,
			message: '"Keine Spieler" angegeben, aber Ergebnis eingetragen',
		};
	}
}

function* check(data, pm, team_idx) {
	if (! pm['flag_keinspiel_keinspieler_team' + team_idx]) {
		return;
	}

	let tm = data.get_teammatch(pm.teammatchid);

	// Already handled?
	if (pm.flag_umwertung_gegen_team1 || pm.flag_umwertung_gegen_team2) {
		return;
	}
	if (tm.flag_umwertung_gegen_team1 || tm.flag_umwertung_gegen_team2 || tm.flag_umwertung_gegen_team1_beide || tm.flag_umwertung_gegen_team2_beide || tm.flag_umwertung_gegen_beide) {
		return;
	}

	if (pm[`team${team_idx}spieler1spielerid`]) {
		const player1 = data.get_player(pm[`team${team_idx}spieler1spielerid`]);
		let player_str = data.player_str(player1);
		if (pm[`team${team_idx}spieler2spielerid`]) {
			const player2 = data.get_player(pm[`team${team_idx}spieler2spielerid`]);
			player_str += ' / ' + data.player_str(player2);
		}

		const message = (
			'"' + tm['team' + team_idx + 'name'] + ' hatte keine Spieler" angegeben, ' +
			'aber Spieler ' + player_str + ' eingetragen'
		);
		yield {
			match_id: pm.matchid,
			teammatch_id: pm.teammatchid,
			message,
		};
	}
	let other_team = 3 - team_idx;
	if (
			(pm.setcount !== 2) ||
			(pm['set1team' + team_idx] !== 0) ||
			(pm['set1team' + other_team] !== 21) ||
			(pm['set2team' + team_idx] !== 0) ||
			(pm['set2team' + other_team] !== 21)) {
		let correct_result_str = (team_idx === 2) ? '21-0 21-0' : '0-21 0-21';
		yield {
			match_id: pm.matchid,
			teammatch_id: pm.teammatchid,
			message: '"' + tm['team' + team_idx + 'name'] + ' hatte keine Spieler" angegeben, aber Ergebnis nicht ' + correct_result_str,
		};
	}
}


module.exports = function*(season) {
	const data = season.data;
	for (let pm of data.active_playermatches) {
		yield* check_both(data, pm);
		yield* check(data, pm, 1);
		yield* check(data, pm, 2);
	}
};