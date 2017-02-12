'use strict';

function is_winner(candidate, other) {
	return (
		((candidate == 21) && (other < 20)) ||
		((candidate > 21) && (candidate <= 30) && (other == candidate - 2)) ||
		(candidate == 30) && (other == 29)
	);
}

function game_winner(pm, game_idx) {
	let p1 = pm['set' + game_idx + 'team1'];
	let p2 = pm['set' + game_idx + 'team2'];

	if (is_winner(p1, p2)) {
		return 1;
	}
	if (is_winner(p2, p1)) {
		return 2;
	}
	return 0;
}

function match_winner(pm) {
	let games = [0, 0];
	for (let i = 1;i <= pm.setcount;i++) {
		let gwinner = game_winner(pm, i);
		if (!gwinner) {
			break;
		}
		games[gwinner - 1]++;

		if (games[0] === 2) {
			return 1;
		} else if (games[1] === 2) {
			return 2;
		}
	}
	return 0;
}

function* check_comment(data, pm) {
	const resigned = data.get_matchfield(pm.tm, 'Spielaufgabe (Spielstand bei Aufgabe, Grund), Nichtantritt');
	if (resigned) {
		return;
	}

	const notes = data.get_matchfield(pm.tm, 'weitere \'Besondere Vorkommnisse\' lt. Original-Spielbericht');
	if (notes) {
		return;
	}

	// Look for a comment - not quite correct, but still close
	const comment = data.get_comment(pm.teammatchid, text => /krank|verletz|aufgegeben|Aufgabe/i.test(text));
	if (comment) {
		return;
	}

	// Already handled?
	if (data.get_stb_note(pm.teammatchid, text => /F(?:20|28)-/.test(text))) {
		return;
	}

	yield {
		teammatch_id: pm.teammatchid,
		match_id: pm.matchid,
		message: 'Spielaufgabe im ' + data.match_name(pm) + ', aber kein Eintrag im Feld "Spielaufgabe" (§65.7.1 SpO)',
	};
}

function* check_match(data, pm, team_idx) {
	if (! pm['flag_aufgabe_team' + team_idx]) {
		return;
	}

	yield* check_comment(data, pm);

	if (! pm['team' + team_idx + 'spieler1spielerid']) {
		yield {
			teammatch_id: pm.teammatchid,
			match_id: pm.matchid,
			message: 'Aufgebende Seite hat keine Spieler (nicht gespielt?)',
		};
		return;
	}

	let mw = match_winner(pm);
	if (mw === 3 - team_idx) {
		return; // everything in order
	}

	let tm = data.get_teammatch(pm.teammatchid);
	let msg = (
		(mw === 0) ?
		'Bei Aufgabe muss der Punktestand zum Gewinn(z.B. 21) ergänzt werden' :
		'Aufgebende Seite (' + tm['team' + team_idx + 'name'] + ') hatte bereits gewonnen');

	yield {
		teammatch_id: pm.teammatchid,
		match_id: pm.matchid,
		message: msg,
	};

}


module.exports = function*(season) {
	const data = season.data;

	for (const pm of season.data.played_playermatches) {
		yield* check_match(data, pm, 1);
		yield* check_match(data, pm, 2);
	}

	for (const tm of data.teammatches) {
		const resigned = data.get_matchfield(tm, 'Spielaufgabe (Spielstand bei Aufgabe, Grund), Nichtantritt');
		if (!resigned) {
			continue;
		}

		const pms = data.get_playermatches_by_teammatch_id(tm.matchid);
		if (! pms.some(pm => (
				pm.flag_aufgabe_team1 ||
				pm.flag_aufgabe_team2 ||
				pm.flag_keinspiel_keinespieler ||
				pm.flag_keinspiel_keinspieler_team1 ||
				pm.flag_keinspiel_keinspieler_team2 ||
				pm.flag_umwertung_gegen_team1 ||
				pm.flag_umwertung_gegen_team2
				))) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Eintrag im Textfeld Spielaufgabe, aber im Detailbericht keine Spiele als aufgegeben gekennzeichnet',
			};
		}
	}
};