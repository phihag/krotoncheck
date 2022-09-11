'use strict';

const calc = require('../calc');
const data_utils = require('../data_utils');
const utils = require('../utils');


function* check_comment(data, pm) {
	const resigned = data.get_resigned_field(pm.tm);
	if (!utils.is_empty_note(resigned)) {
		return;
	}

	const notes = data.get_matchfield(pm.tm, 'weitere \'Besondere Vorkommnisse\' lt. Original-Spielbericht');
	if (!utils.is_empty_note(notes)) {
		return;
	}

	// Look for a comment - not quite correct, but still close
	let late_comment = false;
	const comments = data.get_comments(pm.teammatchid, text => /krank|verletz|aufgegeben|Aufgabe/i.test(text));
	for (const c of comments) {
		// Only accept when the comment was in time
		const deadline = data_utils.reporting_deadline(pm.tm);
		const comment_ts = utils.parse_date(c.zeitpunkt);
		if (comment_ts <= deadline) {
			return;
		}
		late_comment = true;
	}

	// Already handled?
	if (data.get_stb_note(pm.teammatchid, text => /OGeb\s+F(?:20|28)/.test(text))) {
		return;
	}

	yield {
		teammatch_id: pm.teammatchid,
		match_id: pm.matchid,
		message: (
			'Spielaufgabe im ' + data_utils.match_name(pm) +
			', aber kein Eintrag im Feld "Spielaufgabe" (§65.7.1 SpO)' +
			(late_comment ?
				' (Verspäteter Kommentar? In Feld "Spielaufgabe" übertragen und OG F28 verhängen)'
				: '')
		),
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

	let mw = calc.match_winner(pm);
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
		const resigned = data.get_resigned_field(tm);
		if (!resigned) {
			continue;
		}

		const backup_players = data.get_backup_players(tm);
		if (backup_players) {
			const bp_names = data_utils.extract_names(backup_players);
			if (bp_names.some(bpn => resigned.includes(bpn))) {
				continue; // a backup player played
			}
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
