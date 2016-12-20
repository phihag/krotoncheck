'use strict';

const assert = require('assert');


const laws = require('../laws');


function contains_backup_player(data, tm, players) {
	const backup_players = data.get_matchfield(tm, 'vorgesehene Ersatzspieler (NUR Verbandsliga aufwärts, § 58 SpO)');
	if (!backup_players) {
		return false;
	}

	const notes = data.get_matchfield(tm, 'weitere \'Besondere Vorkommnisse\' lt. Original-Spielbericht');
	const resigned = data.get_matchfield(tm, 'Spielaufgabe (Spielstand bei Aufgabe, Grund), Nichtantritt');
	if (!notes && !resigned) {
		return false;
	}

	for (const p of players) {
		if (backup_players.includes(p.name) && (
				(notes && notes.includes(p.name)) ||
				(resigned && resigned.includes(p.name)))) {
			return true;
		}
	}
	return false;
}

function* check_pm(data, league_type, tm, pm, pm_ratings_by_discipline, team, team_idx, flagged) {
	const pm_is_doubles = laws.is_doubles(pm.disziplin);

	if (!pm_ratings_by_discipline[pm.disziplin]) {
		pm_ratings_by_discipline[pm.disziplin] = [];
	}
	const match_ratings = {
		pm: pm,
		ratings: [],
		player_ids: [],
	};

	for (let player_idx = 1;player_idx <= 2;player_idx++) {
		let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
		if (!player_id) {
			continue;
		}
		let player = data.get_player(player_id);
		let vrl_type = laws.get_vrl_type(league_type, tm, player.sex);

		let ve = data.get_vrl_entry(team.clubcode, vrl_type, player_id);
		if (!ve) {
			if (league_type === 'U19') {
				// Look up in Mini database
				const mini_vrl_type = laws.get_vrl_type('Mini', tm, player.sex);
				const mini_ve = data.get_vrl_entry(team.clubcode, mini_vrl_type, player_id);
				if (mini_ve) {
					continue;
				}
			} else if (league_type === 'Mini') {
				// Look up in U19 database
				const u19_vrl_type = laws.get_vrl_type('U19', tm, player.sex);
				const u19_ve = data.get_vrl_entry(team.clubcode, u19_vrl_type, player_id);
				if (u19_ve) {
					continue;
				}
			}

			const message = (
				'Kein Eintrag für ' + data.player_str(player) +
				' in ' + data.vrl_name(vrl_type) +
				' von ' + team.name + '.');
			yield {
				player_id: player.spielerid,
				teammatch_id: pm.teammatchid,
				match_id: pm.matchid,
				message,
			};
			continue;
		}

		if (ve.startdate) {
			if (tm.ts < ve.parsed_startdate) {
				const message = (
					ve.firstname + ' ' + ve.lastname + '(' + ve.memberid + ') ' +
					' ist erst ab ' + ve.startdate +
					' für (' + ve.clubcode + ') ' + ve.clubname +
					' spielberechtigt, hat aber vorher am ' +
					tm.spieldatum + ' gespielt'
				);
				yield {
					player_id: ve.memberid,
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}
		if (ve.enddate) {
			if (tm.ts > ve.parsed_enddate) {
				const message = (
					'(' + ve.memberid + ') ' + ve.firstname + ' ' + ve.lastname +
					' ist nur bis zum ' + ve.startdate +
					' für (' + ve.clubcode + ') ' + ve.clubname +
					' spielberechtigt, hat aber danach am ' +
					tm.spieldatum + ' gespielt'
				);
				yield {
					player_id: ve.memberid,
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}

		// Check that player is allowed to play for the team
		if (ve.fixed_in && (!ve.fixed_from || (ve.parsed_fixed_from <= tm.ts))) {
			if (ve.fixed_in !== team.number) {
				const message = (
					ve.firstname + ' ' + ve.lastname + ' (' + ve.memberid + ')' +
					' ist in ' + ve.clubname + ' ' + ve.fixed_in +
					(ve.fixed_from ? (' (ab ' + ve.fixed_from + ')') : '') +
					' festgeschrieben, hat aber am ' + tm.spieldatum +
					' für (' + team.code + ') ' + team.name +
					' gespielt.'
				);
				yield {
					player_id: ve.memberid,
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		} else if (ve.teamcode !== team.code) {
			// Playing as backup player - verify that that's allowed
			const registered_in = data.get_team(ve.teamcode);

			if (! laws.is_backup(registered_in, team)) {
				const message = (
					ve.firstname + ' ' + ve.lastname + ' (' + ve.memberid + ')' +
					' ist Spieler von (' + registered_in.code + ') ' + registered_in.name +
					', hat aber für die tiefere Mannschaft (' + team.code + ') ' + team.name + ' gespielt'
				);
				yield {
					player_id: ve.memberid,
					teammatch_id: pm.teammatchid,
					match_id: pm.matchid,
					message,
				};
			}
		}

		let pos = parseInt(ve.teamposition);
		if (pm_is_doubles && ve.teampositiondouble) {
			pos = parseInt(ve.teampositiondouble);
		}
		match_ratings.ratings.push(pos);
		match_ratings.player_ids.push(player_id);
	}

	const expected_players = pm_is_doubles ? 2 : 1;
	if ((match_ratings.ratings.length === expected_players) && !flagged) {
		pm_ratings_by_discipline[pm.disziplin].push(match_ratings);
	}
}

function* check_all(data, tm, pms, team_idx) {
	const team = data.get_team(tm['team' + team_idx + 'id']);
	const league_type = data.league_type(tm.staffelcode);
	const pm_ratings_by_discipline = {};

	const valid_players_by_gender = {
		M: new Set(),
		F: new Set(),
	};

	// Check if everyone present in VRL
	for (let pm of pms) {
		const flagged = pm['flag_umwertung_gegen_team' + team_idx] || pm.flag_keinspiel_keinespieler;
		const problems = Array.from(check_pm(data, league_type, tm, pm, pm_ratings_by_discipline, team, team_idx, flagged));

		if (! flagged) { // Not already handled
			yield* problems;
		}

		// Take note of who is valid and who got blacklisted
		let blacklisted = problems.map(problem => problem.player_id);
		for (let player_idx = 1;player_idx <= 2;player_idx++) {
			let player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
			if (!player_id) {
				continue;
			}
			if (blacklisted.includes(player_id)) {
				continue;
			}

			const player = data.get_player(player_id);
			assert(['M', 'F'].includes(player.sex));
			valid_players_by_gender[player.sex].add(player.spielerid);
		}
	}

	// Check that enough non-blacklisted players
	const f_count = valid_players_by_gender.F.size;
	const m_count = valid_players_by_gender.M.size;
	if (/^O19-(?:OL|RL|[SN][12]-VL)$/.test(tm.eventname)) {
		if ((m_count < 4) || (f_count < 2)) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Nicht genügend spielberechtigte SpielerInnen von ' + team.name + ' aufgestellt (§58.1 SpO)',
			};
		}
	} else if (league_type === 'Mini') {
		if (f_count + m_count < 3) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Nicht genügend spielberechtigte SpielerInnen von ' + team.name + ' aufgestellt (§15.4 JSpO)',
			};
		}
	} else {
		// O19 or J or S
		if (f_count === 0) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Keine spielberechtigte Dame von ' + team.name + ' aufgestellt (§57.5 SpO)',
			};
		}

		if ((m_count < 2) || ((m_count === 2) && (f_count < 2)) || ((m_count === 3) && (f_count < 1))) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Nicht genügend spielberechtigte Spieler von ' + team.name + ' aufgestellt (§57.4 SpO)',
			};
		}
	}

	// Check that all ratings match
	for (const discipline in pm_ratings_by_discipline) {
		let match_ratings = pm_ratings_by_discipline[discipline];
		if (match_ratings.length < 2) {
			continue;
		}

		for (let i = 0;i < match_ratings.length - 1;i++) {
			let mr1 = match_ratings[i];
			let mr2 = match_ratings[i + 1];

			if (laws.is_doubles(discipline)) {
				const sum1 = mr1.ratings[0] + mr1.ratings[1];
				const min1 = Math.min(mr1.ratings[0], mr1.ratings[1]);
				const sum2 = mr2.ratings[0] + mr2.ratings[1];
				const min2 = Math.min(mr2.ratings[0], mr2.ratings[1]);

				if ((sum1 < sum2) || ((sum1 === sum2) && (min1 < min2))) {
					continue;
				}

				if (mr1.pm.flag_keinspiel_keinespieler && mr2.pm.flag_keinspiel_keinespieler) {
					continue; // Both sides wrong?
				}

				let p1a = data.get_player(mr1.player_ids[0]);
				let p1b = data.get_player(mr1.player_ids[1]);
				let p2a = data.get_player(mr2.player_ids[0]);
				let p2b = data.get_player(mr2.player_ids[1]);

				if (contains_backup_player(data, tm, [p1a, p1b, p2a, p2b])) {
					continue;
				}

				const message = (
					'Doppel falsch aufgestellt: ' +
					data.match_name(mr1.pm) + ' ' +
						data.player_name(p1a) + ' DVRL #' + mr1.ratings[0] + '' + ' / ' +
						data.player_name(p1b) + ' DVRL #' + mr1.ratings[1] + '.\n' +
					data.match_name(mr2.pm) + ' ' +
						data.player_name(p2a) + ' DVRL #' + mr2.ratings[0] + '' + ' / ' +
						data.player_name(p2b) + ' DVRL #' + mr2.ratings[1] + '.'
				);
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
			} else {
				// Singles
				if (mr1.ratings[0] < mr2.ratings[0]) {
					continue;
				}

				if (mr1.pm.flag_keinspiel_keinespieler && mr2.pm.flag_keinspiel_keinespieler) {
					continue; // Both sides wrong?
				}

				let p1 = data.get_player(mr1.player_ids[0]);
				let p2 = data.get_player(mr2.player_ids[0]);

				if (contains_backup_player(data, tm, [p1, p2])) {
					continue;
				}

				const message = (
						'Einzel falsch aufgestellt: ' +
						data.player_str(p1) + ' ist VRL #' + mr1.ratings[0] + ' und hat ' + data.match_name(mr1.pm) + ' gespielt. ' +
						data.player_str(p2) + ' ist VRL #' + mr2.ratings[0] + ' und hat ' + data.match_name(mr2.pm) + ' gespielt.');
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
			}
		}
	}
}

function* check(data, tm) {
	if (!tm.detailergebnis_eintragedatum) {
		return; // Not yet played
	}

	let pms = data.get_playermatches_by_teammatch_id(tm.matchid);

	yield* check_all(data, tm, pms, 1);
	yield* check_all(data, tm, pms, 2);
}


module.exports = function*(season) {
	for (var tm of season.data.active_teammatches) {
		yield* check(season.data, tm);
	}
};