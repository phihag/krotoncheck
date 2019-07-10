'use strict';
// Check the VRLs themselves

const assert = require('assert');

const data_utils = require('../data_utils');
const utils = require('../utils');

const laws = require('../laws');

function count_o19_players(players) {
	let res = 0;
	for (const p of players) {
		if (data_utils.o19_is_regular(p)) {
			res++;
		}
	}
	return res;
}

function* check_team(season, vrl, team_id, players) {
	const data = season.data;

	if ((vrl.typeid == 9) || (vrl.typeid == 11)) {
		// Men O19
		let pcount = count_o19_players(players);
		if (pcount < 4) {
			const message = (
				'Zu wenig (' + pcount + ') Stammspieler im Team ' + team_id +
				' (' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname + ')'
			);
			yield {
				type: 'vrl',
				clubcode: vrl.clubcode,
				vrl_typeid: vrl.typeid,
				message,
			};
		}
	} else if ((vrl.typeid == 10) || (vrl.typeid == 12)) {
		// Women O19
		let pcount = count_o19_players(players);
		if (pcount < 2) {
			yield {
				type: 'vrl',
				clubcode: vrl.clubcode,
				vrl_typeid: vrl.typeid,
				message: 'Zu wenig (' + pcount + ') Stammspielerinnen im Team ' + team_id + ' (' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname + ')',
			};
		}
	} else if ((vrl.typeid == 17) || (vrl.typeid == 18)) {
		// Boys U19, and mini
		let pcount = players.length;
		if (pcount < 4) {
			yield {
				type: 'vrl',
				clubcode: vrl.clubcode,
				vrl_typeid: vrl.typeid,
				message: 'Zu wenig (' + pcount + ') Spieler im Team ' + team_id + ' (' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname + ')',
			};
		}
	} else if ((vrl.typeid == 14) || (vrl.typeid == 16)) {
		// Girls U19
		let pcount = players.length;
		if (pcount < 2) {
			yield {
				type: 'vrl',
				clubcode: vrl.clubcode,
				vrl_typeid: vrl.typeid,
				message: 'Zu wenig (' + pcount + ') Spielerinnen im Team ' + team_id + ' (' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname + ')',
			};
		}
	} else {
		yield {
			type: 'warning',
			message: 'Unsupported VRL ' + vrl.typeid,
		};
	}
}

function* check_u19e(data, vrl, line) {
	if (line.akl === 'U19-2') {
		return; // §10.1 JSpO: always allowed
	}

	const teams = data.get_teams_by_club(line.playerclubcode);
	let withdrawn_all = undefined;
	for (const t of teams) {
		if (! t.DrawID) {
			// team not in any league, skip for now
			continue;
		}

		const lid = data_utils.league_type(t.DrawID);
		if ((lid !== 'Mini') && (lid !== 'U19')) {
			continue;
		}

		if (t.Status === 'Mannschaftsrückzug') {
			if (withdrawn_all === undefined) {
				withdrawn_all = true;
			}
		} else {
			withdrawn_all = false;
		}
	}

	if (withdrawn_all === undefined) {
		const message = (
			'Keine Schüler/Jugend/Mini-Teams, aber U19E-Spieler ' +
			'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' (in AK U19-1) in ' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname
		);
		yield {
			type: 'vrl',
			clubcode: vrl.clubcode,
			vrl_typeid: vrl.typeid,
			message: message,
		};
	} else if ((withdrawn_all === true) && (!line.enddate)) {
		const message = (
			'Alle Schüler/Jugend/Mini-Teams zurückgezogen, aber U19E-Spieler ' +
			'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' (in AK U19-1) in ' + data.vrl_name(vrl.typeid) + ' von ' + vrl.clubname
		);
		yield {
			type: 'vrl',
			clubcode: vrl.clubcode,
			vrl_typeid: vrl.typeid,
			message: message,
		};
	}
}

function* check_not_in_youth_team(data, is_hr, line) {
	const look_in = is_hr ? [14, 17] : [16, 18];
	const clubcode = line.clubcode;
	for (const vrl_type of look_in) {
		const ve = data.try_get_vrl_entry(clubcode, vrl_type, line.memberid);
		if (ve) {
			const message = (
				line.firstname + ' ' + line.lastname + ' (' + line.memberid + ') ' +
				'steht mit Kennzeichen ' + (line.vkz1 || line.jkz1) + ' in der ' +
				data.vrl_name(line.typeid) + ' von ' +
				'(' + clubcode + ') ' + line.clubname + ', ist aber in der ' + data.vrl_name(vrl_type) +
				' an Position ' + ve.position + ' aufgeführt.'
			);
			yield {
				type: 'vrl',
				clubcode: clubcode,
				vrl_typeid: line.typeid,
				message: message,
			};
		}
	}
}

function* check_in_youth_team(season, is_hr, line) {
	const data = season.data;
	if (line.vkz1 !== 'J') {
		throw new Error('Ungültiges Kennzeichen für J-Überprüfung: ' + JSON.stringify(line.vkz1));
	}

	const clubcode = line.clubcode;

	if (!['U17-1', 'U17-2', 'U19-1', 'U19-2'].includes(line.akl)) {
		const message = (
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit J-Kennzeichen ' + line.vkz1 + ' in der ' +
			data.vrl_name(line.typeid) + ' von ' +
			'(' + clubcode + ') ' + line.clubname +
			', aber ' + (
				['U13-1', 'U13-2', 'U15-1', 'U15-2'].includes(line.akl) ?
				'benötigt des Alters (' + line.akl + ') wegen aber eine O19-Starterlaubnis' :
				'die Altersklasse ' + JSON.stringify(line.akl) + ' ist nicht U17 oder U19'
			) + ' (§11.1.2 JSpO ab 2018/2019)'
		);
		yield {
			type: 'vrl',
			clubcode: line.clubcode,
			vrl_typeid: line.typeid,
			message,
		};
	}

	const vrl_types = is_hr ? [14, 17] : [16, 18];

	let ve;
	for (const vt of vrl_types) {
		ve = data.try_get_vrl_entry(clubcode, vt, line.memberid);
		if (ve) break;
	}
	if (!ve) {
		return;
	}

	if (line.enddate) {
		// Retracted or moved
		return;
	}

	const team = data.try_get_team(ve.teamcode);
	if (!team) {
		const message = (
			'Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit Kennzeichen ' + line.vkz1 + ' in der ' +
			data.vrl_name(line.typeid) + ' von ' +
			'(' + clubcode + ') ' + line.clubname + ', ' +
			'aber die Mannschaft ' + ve.teamcode + ' kann nicht gefunden werden'
		);
		yield {
			type: 'vrl',
			clubcode: clubcode,
			vrl_typeid: line.typeid,
			message,
		};
		return;
	}

	if (team.Status === 'Mannschaftsrückzug') {
		// Retreated in RR?
		if (is_hr && season.lastdate_hr) {
			const l_hr = utils.parse_date(season.lastdate_hr);
			const forced = laws.forced_retreat(data, team.code);
			if (forced) {
				if (l_hr < forced.ts) {
					// Irrelevant
					return;
				}
			}
		}

		const message = (
			'Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit Kennzeichen ' + line.vkz1 + ' (ohne Enddatum) in der ' +
			data.vrl_name(line.typeid) + ' von ' +
			'(' + clubcode + ') ' + line.clubname + ', ' +
			'aber die Mannschaft ' + ve.teamcode + ' hat Status ' + JSON.stringify(team.Status)
		);
		yield {
			type: 'vrl',
			clubcode: clubcode,
			vrl_typeid: line.typeid,
			message,
		};
	}

	// Check matches in O19
	const pms = data.get_player_matches(line.memberid, is_hr);
	const tms = utils.uniq(pms.filter(pm => {
		if (pm.flag_umwertung_gegen_team1) {
			if ((pm.team1spieler1spielerid === line.memberid) || (pm.team1spieler2spielerid === line.memberid)) {
				return false;
			}
		}
		if (pm.flag_umwertung_gegen_team2) {
			if ((pm.team2spieler1spielerid === line.memberid) || (pm.team2spieler2spielerid === line.memberid)) {
				return false;
			}
		}
		return true;
	}).map(pm => pm.tm));
	const o19_tms = tms.filter(tm =>
		data_utils.tm_league_type(tm) === 'O19'
	);
	for (let i = 2;i < o19_tms.length;i++) {
		const o19tm = o19_tms[i];
		const message = (
			line.vkz1 + '-Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' wurde mehr als zweimal im O19-Bereich eingesetzt (§11.2 JSpO)'
		);
		yield {
			teammatch_id: o19tm.matchid,
			message,
		};
	}
}

function* check_invalid_date(season, is_o19, line) {
	if (!line.startdate) {
		return;
	}

	const max_date_str = season['lastdate_' + (is_o19 ? 'o19' : 'u19')];
	if (max_date_str) {
		const actual_startdate = utils.parse_date(line.startdate);
		const max_date = utils.parse_date(max_date_str);
		if (actual_startdate > max_date) {
			const message = (
				line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
				' in ' + season.data.vrl_name(line.typeid) +
				' ist ab ' + line.startdate + ' spielberechtigt, aber dieses Datum ist nach Saisonende'
			);
			yield {
				type: 'vrl',
				vrl_typeid: line.typeid,
				clubcode: line.clubcode,
				message,
			};
		}
	}
}

function* check_startend(season, is_hr, vrl_date, is_o19, line) {
	// Start before vrl_date?
	if (line.startdate) {
		const startdate = utils.parse_date(line.startdate);
		if (startdate < vrl_date) {
			const message = (
				'Startdatum ' + line.startdate + ' von ' +
				line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
				' liegt vor Abgabeschluss der ' + (is_hr ? 'Hinrunden' : 'Rückrunden') + '-VRL' +
				', sollte gelöscht werden.'
			);
			yield {
				type: 'vrl',
				vrl_typeid: line.typeid,
				clubcode: line.clubcode,
				message,
			};
		}
	}

	// end before vrl_date?
	if (line.enddate) {
		const enddate = utils.parse_date(line.enddate);
		if (enddate < vrl_date) {
			const message = (
				line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
				' darf nicht mehr in der ' + (is_hr ? 'Hinrunden' : 'Rückrunden') + '-VRL stehen,' +
				' da ' + (line.sex === 'M' ? 'er' : 'sie') +
				' vor Abgabeschluss (am ' + line.enddate + ') abgemeldet wurde.'
			);
			yield {
				type: 'vrl',
				vrl_typeid: line.typeid,
				clubcode: line.clubcode,
				message,
			};
		}
	}

	if (!line.kz) {
		return;
	}

	const m = /^[Aa]b\s+([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})\s*$/.exec(line.kz);
	if (!m) {
		return;
	}

	// Enddate required?
	if (season.data.spielgemeinschaften && (line.clubcode !== line.playerclubcode) && (!season.data.in_sg(line.clubcode, line.playerclubcode))) {
		if (line.enddate) {
			return;
		}

		if (is_hr && season.lastdate_hr) {
			const left_date = utils.parse_date(m[1]);
			const l_hr = utils.parse_date(season.lastdate_hr);
			if (left_date > l_hr) {
				return;
			}
		}

		const ld_str = season['lastdate_' + (is_o19 ? 'o19' : 'u19')];
		if (ld_str) {
			const left_date = utils.parse_date(m[1]);
			const season_end = utils.parse_date(ld_str);
			if (left_date > season_end) {
				return;
			}
		}

		let after_start = true;
		const start_str = season['vrldate_' + (is_o19 ? 'o19' : 'u19')];
		if (start_str) {
			const left_date = utils.parse_date(m[1]);
			const season_start = utils.parse_date(start_str);
			if (left_date < season_start) {
				after_start = false;
			}
		}

		const message = (
			line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
			((line.playerclubcode === '01-8999') ?
				' wurde am ' + m[1] + ' von der Spielberechtigungsliste gestrichen,'
				:
				(' hat Verein (' + line.clubcode + ') ' + line.clubname + ' am ' + m[1] + ' verlassen ' +
				' zu (' + line.playerclubcode + ') ' + line.playerclubname + ',')
			) +
			(after_start ?
				' aber Enddatum fehlt in der ' + season.data.vrl_name(line.typeid) :
				' bitte aus der ' + season.data.vrl_name(line.typeid) + ' löschen.'
			)
		);
		yield {
			type: 'vrl',
			vrl_typeid: line.typeid,
			clubcode: line.clubcode,
			message,
		};
		return;
	}

	// Startdate required, check that it's present
	if (!vrl_date || line.startdate) {
		return;
	}

	const startdate = utils.parse_date(m[1]);
	if (startdate <= vrl_date) {
		return;
	}

	const HR_GRACE_TIME = 11 * 24 * 60 * 60 * 1000;
	if (is_hr && startdate <= vrl_date + HR_GRACE_TIME) {
		return;
	}

	const message = (
		line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
		' nachgemeldet (' + m[1] + ', VRL-Abgabe ' + utils.ts2dstr(vrl_date) + '),' +
		' aber Startdatum fehlt' +
		' in der ' + season.data.vrl_name(line.typeid) +
		' von (' + line.clubcode + ') ' + line.clubname
	);
	yield {
		type: 'vrl',
		vrl_typeid: line.typeid,
		clubcode: line.clubcode,
		message,
	};
}

function* check_fixed(season, is_hr, vrl_date, line) {
	if (line.vkz2.toUpperCase() === 'FIX') {
		const message = (
			'Ungltiges vkz2 ' + JSON.stringify(line.vkz2) +
			' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
		);
		yield {
			type: 'vrl',
			vrl_typeid: line.typeid,
			clubcode: line.clubcode,
			message,
		};
	}

	if (line.vkz3.toUpperCase() === 'FIX') {
		if (!line.fixed_in) {
			const message = (
				'FIX in vkz3, aber kein [Fest in] ' +
				' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
			);
			yield {
				type: 'vrl',
				vrl_typeid: line.typeid,
				clubcode: line.clubcode,
				message,
			};
		}

		if (line.fixed_from) {
			const fixed_date = utils.parse_date(line.fixed_from);
			if (fixed_date !== vrl_date) {
				const message = (
					'FIX am ' + line.fixed_from + ' statt zum Tag der ' +
					(is_hr ? 'Hinrunden' : 'Rückrunden') + '-VRL-Abgabe ' +
					'(' + utils.ts2dstr(vrl_date) + ') ' +
					' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
				);
				yield {
					type: 'vrl',
					vrl_typeid: line.typeid,
					clubcode: line.clubcode,
					message,
				};	
			}
		} else {
			const message = (
				'FIX in vkz3, aber kein [Fest ab] ' +
				' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
			);
			yield {
				type: 'vrl',
				vrl_typeid: line.typeid,
				clubcode: line.clubcode,
				message,
			};
		}
	}

	if (!line.fixed_in && !line.fixed_from) {
		return;
	}

	if (!line.fixed_from) {
		const message = (
			'[Fest in] ' + line.fixed_in + ' ohne [Fest ab]' +
			' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
		);
		yield {
			type: 'vrl',
			vrl_typeid: line.typeid,
			clubcode: line.clubcode,
			message,
		};
	}

	if (!line.fixed_in) {
		const message = (
			'[Fest ab] ' + line.fixed_from + ' ohne [Fest in]' +
			' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
		);
		yield {
			type: 'vrl',
			vrl_typeid: line.typeid,
			clubcode: line.clubcode,
			message,
		};
	}
}

function* check_vrl(season, vrl) {
	const data = season.data;
	const is_o19 = data_utils.vrlid_is_o19(vrl.typeid);
	const is_hr = [9, 10, 14, 17].includes(vrl.typeid);
	const date_key = 'vrldate_' + (is_o19 ? 'o19' : 'u19') + '_' + (is_hr ? 'hr' : 'rr');
	const vrl_date = season[date_key] ? utils.parse_date(season[date_key]) : null;

	let last_id = 0;
	let by_doubles_pos = new Map();
	let last_team_num = 0;
	let last_team_char = '';
	const players_by_team = new Map();
	for (const line of vrl.entries) {
		if (!players_by_team.has(line.teamcode)) {
			players_by_team.set(line.teamcode, []);
		}
		players_by_team.get(line.teamcode).push(line);

		yield* check_fixed(season, is_hr, vrl_date, line);

		if (line.position != line.teamposition) {
			const message = (
				'Ungültige ' + data.vrl_name(vrl.typeid) +
				' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
				'position (' + line.position + ') != teamposition (' + line.teamposition + ') ' +
				'bei Spieler (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname
			);
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message,
			};
		}

		const position = parseInt(line.position);
		if (isNaN(position)) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'teamposition-Feld fehlt in ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname,
			};
			last_id = '[keine Position angegeben]';
			continue;
		}
		const position_doubles = line.teampositiondouble ? parseInt(line.teampositiondouble) : position;

		if (line.teampositiondouble && (position_doubles === position)) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Redundanter Doppelranglisten-Eintrag ' + line.teampositiondouble + ' (Einzelranglisten-Nummer ist bereits ' + position + ') ' + ' in ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname,
			};
		}

		// No gaps in VRL
		if (last_id !== (position - 1)) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Lücke in der ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': Auf ' + last_id + ' folgt ' + position,
			};
		}
		last_id = position;

		// No duplicate numbers in doubles VRL
		if (by_doubles_pos.has(position_doubles)) {
			const old = by_doubles_pos.get(position_doubles);

			const message = (
				'Doppelter Eintrag in der Doppel-' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
				'(' + old.memberid + ') ' + old.firstname + ' ' + old.lastname + ' und ' +
				'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname + ' ' +
				'sind beide an an Position ' + position_doubles
			);

			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message,
			};
		}
		by_doubles_pos.set(position_doubles, line);

		if (line.vkz3 === 'FIX') {
			if (!line.fixed_in && (!line.fixed_from || !line.fixed_in)) {
				const message = (
					'FIX-Kennzeichen ohne ' +
					(!line.fixed_from ? (line.fixed_in ? '"Fest ab"-Wert' : '"Fest in"- und ohne "Fest ab"-Wert') : '"Fest in"-Wert') +
					' in der ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' ' +
					' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')'
				);

				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message,
				};
			}
		}

		if (line.vkz1 && !['U19E', 'SE', 'J', 'N'].includes(line.vkz1)) {
			const hint = {
				'U19': ' (U19 statt U19E? U19-Erklärung beim Verband prüfen!)',
				'F': ' (Festschreibung falsch eingetragen? Richtig ist "FIX" in vkz3)',
				'J1': ' (veraltete Markierung? Alle Jugendspieler werden seit 2018/2019 nur noch mit "J" gekennzeichnet)',
				'M1': ' (veraltete Markierung? Alle Jugendspieler werden seit 2018/2019 nur noch mit "J" gekennzeichnet)',
				'S1': ' (veraltete Markierung? Siehe §11 JSpO der Saison 2018/2019)',
			}[line.vkz1] || '';

			const message = (
				'Ungültiges Kennzeichen ' + JSON.stringify(line.vkz1) +
				' in der ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' ' +
				' bei ' + line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
				hint
			);

			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message,
			};
		} else if ((line.vkz1 === 'U19E') && (line.jkz1 !== 'U19E')) {
			const message = (
				line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
				' ist als U19E in ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' ' +
				' eingetragen, aber U19-Erklärung beim Verband fehlt'
			);

			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message,
			};
		}

		// Youth players in O19 with correct designations
		if (is_o19) {
			const m = /^U([01][0-9])(?:-[12])?$/.exec(line.akl);
			if (m) {
				if (!line.vkz1) { // Invalid vkz1 is handled elsewhere
					const message = (
						'Jugendkennzeichen (vkz1) fehlt in ' + data.vrl_name(vrl.typeid) +
						' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei ' +
						'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname
					);
					yield {
						type: 'vrl',
						vrl_typeid: vrl.typeid,
						clubcode: vrl.clubcode,
						message: message,
					};
				}

				if (((line.jkz1 === 'U19E') || (line.vkz1 === 'U19E')) && (m[1] == '19')) {
					yield* check_u19e(data, vrl, line);
					yield* check_not_in_youth_team(data, is_hr, line);
				} else if (line.vkz1 === 'J') {
					yield* check_in_youth_team(season, is_hr, line);
				} else if (line.jkz1 === 'SE') {
					// Special excemption by federation
					// The NRW Verbandsjugendausschuss decided that these players
					// - contrary to the regulations - can play in youth teams, so do not check.
				} else if (line.jkz1) {
					const message = (
						'Falsches Jugendkennzeichen ' + JSON.stringify(line.jkz1) +
						' in ' + data.vrl_name(vrl.typeid) +
						' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei ' +
						'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname + ' (AKL ' + line.akl + ')'
					);
					yield {
						type: 'vrl',
						vrl_typeid: vrl.typeid,
						clubcode: vrl.clubcode,
						message: message,
					};
				}
			} else if (line.jkz1 || (line.vkz1 === 'J')) {
				const message = (
					line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
					' hat Kennzeichen ' + (line.jkz1 || line.vkz1) + ',' +
					' aber Altersklasse ' + JSON.stringify(line.akl) +
					' in der ' + data.vrl_name(vrl.typeid) + ' von (' + vrl.clubcode + ') ' + vrl.clubname
				);
				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message,
				};
			}
		} else {
			// U19
			if (line.jkz1 === 'U19E') {
				const message = (
					((line.sex === 'F') ? 'Spielerin' : 'Spieler') +
					' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
					' mit U19-Erklärung in Jugendmannschaft gemeldet' +
					' in ' + data.vrl_name(line.typeid) + ' von ' + line.clubname +
					' (Position ' + line.position + ')'
				);
				yield {
					type: 'vrl',
					clubcode: line.clubcode,
					vrl_typeid: line.typeid,
					message,
				};
			}

			// Youth player playing in correct age group?
			if (line.teamcode && line.akl) {
				const team = data.try_get_team(line.teamcode);
				if (team && team.Status !== 'Mannschaftsrückzug') {
					const m = /^U([0-9]+)/.exec(line.akl);
					if (!m) {
						const message = (
							'Unbekannte Altersklasse ' + JSON.stringify(line.akl) + ' von' +
							' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
							' in ' + data.vrl_name(line.typeid) + ' von ' + line.clubname +
							' (Position ' + line.position + ')'
						);
						yield {
							type: 'vrl',
							clubcode: line.clubcode,
							vrl_typeid: line.typeid,
							message,
						};
					} else {
						const age = parseInt(m[1]);
						if (/^O19/.exec(team.eventname)) {
							const message = (
								`(${line.memberid}) ${line.firstname} ${line.lastname} in der U19-VRL ` +
								`${data.vrl_name(line.typeid)} ist der O19-Mannschaft ` +
								`(${line.teamcode}) ${team.name} zugeordnet. ` +
								'Diese Zuordnung muss stattdessen in einer O19-VRL passieren.');
							yield {
								type: 'vrl',
								clubcode: line.clubcode,
								vrl_typeid: line.typeid,
								message,
							};
							// Stop here for this line
							continue;
						}

						const team_age_m = /^U([0-9]+)/.exec(team.eventname);
						assert(team_age_m,
							`Cannot parse age from event ${team.eventname} (teamcode ${line.teamcode}) in VRL ${vrl.typeid}`);
						const team_age = parseInt(team_age_m[1]);
						if (age > team_age) {
							const message = (
								'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
								' ist Altersklasse ' + line.akl + ', steht aber in ' +
								' in ' + data.vrl_name(line.typeid) + ' von ' + line.clubname +
								' (Position ' + line.position + ')' +
								' in der Mannschaft ' + team.name + ', die ' + team.DrawName + ' spielt!'
							);
							yield {
								type: 'vrl',
								clubcode: line.clubcode,
								vrl_typeid: line.typeid,
								message,
							};
						}
					}
				}
			}
		}

		// Invalid start dates
		yield* check_invalid_date(season, is_o19, line);

		// Incorrectly noted start or end
		yield* check_startend(season, is_hr, vrl_date, is_o19, line);

		// Ascending team numbers
		if (line.teamcode) {
			let m = /^[0-9]+-[0-9]+-([JSM]?)([0-9]+)$/.exec(line.teamcode);
			if (m) {
				const team_char = m[1];
				const team_num = parseInt(m[2]);

				if ((team_char === last_team_char) && (last_team_num > team_num) && (last_team_num !== 0)) {
					const message = (
						'Mannschaftsnummer nicht aufsteigend in ' +
						data.vrl_name(vrl.typeid) +
						' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
						'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
						' hat Mannschaftsnummer ' + team_char + team_num + ', aber vorherige Zeile war ' + last_team_char + last_team_num
					);
					yield {
						type: 'vrl',
						vrl_typeid: vrl.typeid,
						clubcode: vrl.clubcode,
						message: message,
					};
				}

				last_team_char = team_char;
				last_team_num = team_num;
			} else {
				const message = (
					'Ungültiger Team-Code in ' +
					data.vrl_name(vrl.typeid) +
					' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
					JSON.stringify(line.teamcode)
				);
				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message: message,
				};
			}
		} else {
			if (last_team_num) { // If not, this may be a Bundesliga entry
				const message = (
					'VRL-Zeile ohne Mannschaftszuordnung: ' +
					data.vrl_name(vrl.typeid) +
					' von (' + vrl.clubcode + ') ' + vrl.clubname + ', ' +
					'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname
				);
				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message: message,
				};
			}
		}

		// Comment describing fixing, but no actual fixing
		if (line.comment) {
			if (/fest/i.test(line.comment) && !line.fixed_in) {
				const message = (
					'Kommentar erwähnt Festschreibung (' + JSON.stringify(line.comment) + '), ' +
					'aber kein [Fest in] bei ' +
					line.firstname + ' ' + line.lastname + ' (' + line.memberid + ')' +
					' in ' + vrl.clubname + ' (' + vrl.clubcode + ')'
				);
				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message: message,
				};
			}
		}
	}

	// Check that each team has enough players
	for (const [team_id, players] of players_by_team.entries()) {
		if (! team_id) {
			// Bundesliga
			continue;
		}
		yield* check_team(season, vrl, team_id, players);
	}
}


module.exports = function*(season) {
	for (const vrl of season.data.all_vrlinfos()) {
		yield* check_vrl(season, vrl);
	}
};