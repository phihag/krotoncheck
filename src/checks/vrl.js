'use strict';
// Check the VRLs themselves

var data_access = require('../data_access');
var utils = require('../utils');


function count_o19_players(players) {
	let res = 0;
	for (const p of players) {
		if (data_access.o19_is_regular(p)) {
			res++;
		}
	}
	return res;
}

function* check_team(vrl, team_id, players) {
	if ((vrl.typeid == 9) || (vrl.typeid == 11)) {
		// Men O19
		let pcount = count_o19_players(players);
		if (pcount < 4) {
			yield {
				type: 'vrl',
				clubcode: vrl.clubcode,
				vrl_typeid: vrl.typeid,
				message: 'Zu wenig (' + pcount + ') Stammspieler im Team ' + team_id + ' (VRL ' + vrl.typeid + ' von ' + vrl.clubname + ')',
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
				message: 'Zu wenig (' + pcount + ') Stammspielerinnen im Team ' + team_id + ' (VRL ' + vrl.typeid + ' von ' + vrl.clubname + ')',
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
				message: 'Zu wenig (' + pcount + ') Spieler im Team ' + team_id + ' (VRL ' + vrl.typeid + ' von ' + vrl.clubname + ')',
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
				message: 'Zu wenig (' + pcount + ') Spielerinnen im Team ' + team_id + ' (VRL ' + vrl.typeid + ' von ' + vrl.clubname + ')',
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
		const lid = data.league_type(t.DrawID);
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
			' (in AK U19-1) in VRL ' + vrl.typeid + ' von ' + vrl.clubname
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
			' (in AK U19-1) in VRL ' + vrl.typeid + ' von ' + vrl.clubname
		);
		yield {
			type: 'vrl',
			clubcode: vrl.clubcode,
			vrl_typeid: vrl.typeid,
			message: message,
		};
	}
}

function* check_in_youth_team(data, is_hr, line) {
	let vrl_type;
	let top = 4;
	const expect_team = line.vkz1;
	if (expect_team === 'J1') {
		if (line.sex === 'M') {
			vrl_type = is_hr ? 17 : 18;
		} else if (line.sex === 'F') {
			vrl_type = is_hr ? 14 : 16;
			top = 2;
		} else {
			throw new Error('Ungültige Geschlechtsangabe: ' + JSON.stringify(line.sex));
		}
	} else if (expect_team === 'M1') {
		vrl_type = is_hr ? 17 : 18;
	} else {
		throw new Error('Ungültiges Kennzeichen für M1/J1-Überprüfung: ' + JSON.stringify(expect_team));
	}

	const clubcode = line.clubcode;
	const ve = data.try_get_vrl_entry(clubcode, vrl_type, line.memberid);
	if (!ve) {
		const message = (
			'Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit Kennzeichen ' + expect_team + ' in der ' +
			'O19-VRL(' + line.typeid + ') von ' +
			'(' + clubcode + ') ' + line.clubname + ', fehlt aber in der U19-VRL (' + vrl_type + ')'
		);
		yield {
			type: 'vrl',
			clubcode: clubcode,
			vrl_typeid: line.typeid,
			message: message,
		};
		return;
	} else if (! ve.teamcode.endsWith('-' + expect_team)) {
		const message = (
			'Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit Kennzeichen ' + expect_team + ' in der ' +
			line.typeid + '-VRL von ' +
			'(' + clubcode + ') ' + line.clubname + ', spielt aber für ' +
			ve.teamcode + ' statt ' + clubcode + '-' + expect_team
		);
		yield {
			type: 'vrl',
			clubcode: clubcode,
			vrl_typeid: line.typeid,
			message: message,
		};
	} else {
		if (line.enddate) {
			// Retracted or moved
			return;
		}

		var pos = data_access.parse_int(ve.position);
		if (pos > top) {
			const message = (
				'Spieler' + (line.sex === 'F' ? 'in' : '') +
				' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
				' steht mit Kennzeichen ' + expect_team + ' in der ' +
				'O19-VRL(' + line.typeid + ') von ' +
				'(' + clubcode + ') ' + line.clubname + ', ' +
				'gehört aber nicht zu den Top ' + top + ' in ' + expect_team +
				', sondern ist Nr. ' + pos + ' in ' + ve.teamname + ' (VRL ' + ve.typeid + ')'
			);
			yield {
				type: 'vrl',
				clubcode: clubcode,
				vrl_typeid: line.typeid,
				message: message,
			};
		}
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
			' steht mit Kennzeichen ' + expect_team + ' in der ' +
			'O19-VRL(' + line.typeid + ') von ' +
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
		const message = (
			'Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' steht mit Kennzeichen ' + expect_team + ' (ohne Enddatum) in der ' +
			'O19-VRL(' + line.typeid + ') von ' +
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
		data.league_type(tm.staffelcode) === 'O19'
	);
	for (let i = 2;i < o19_tms.length;i++) {
		const o19tm = o19_tms[i];
		const message = (
			expect_team + '-Spieler' + (line.sex === 'F' ? 'in' : '') +
			' (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
			' wurde mehr als zweimal im O19-Bereich eingesetzt (§11.1.2 JSpO)'
		);
		yield {
			teammatch_id: o19tm.matchid,
			message,
		};
	}
}

function* check_vrl(data, vrl) {
	const is_o19 = [9, 11, 10, 12].includes(vrl.typeid);
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

		if (line.position != line.teamposition) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Ungültige VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': position (' + line.position + ') != teamposition (' + line.teamposition + ') bei Spieler (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname,
			};
		}

		const position = parseInt(line.teamposition);
		if (isNaN(position)) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'teamposition-Feld fehlt in VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname,
			};
			last_id = '[keine Position angegeben]';
			continue;
		}
		const position_doubles = line.teampositiondouble ? parseInt(line.teampositiondouble) : position;

		// No gaps in VRL
		if (last_id !== (position - 1)) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Lücke in der VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': Auf ' + last_id + ' folgt ' + position,
			};
		}
		last_id = position;

		// No duplicate numbers in doubles VRL
		if (by_doubles_pos.has(position_doubles)) {
			const old = by_doubles_pos.get(position_doubles);

			const message = (
				'Doppelter Eintrag in der Doppel-VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
				'(' + old.memberid + ') ' + old.firstname + ' ' + old.lastname + ' und ' +
				'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname + ' ' +
				'sind beide an an Position ' + position_doubles
			);

			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: message,
			};
		}
		by_doubles_pos.set(position_doubles, line);

		// Youth players in O19 with correct designations
		if (is_o19) {
			const is_hr = [9, 10].includes(vrl.typeid);
			const m = /^U([01][0-9])(?:-[12])?$/.exec(line.akl);
			if (m) {
				if ((line.jkz1 === 'U19E') && (m[1] == '19')) {
					yield* check_u19e(data, vrl, line);
				} else if ((line.vkz1 === 'J1') || (line.vkz1 === 'M1')) {
					yield* check_in_youth_team(data, is_hr, line);
				} else if (line.jkz1 === 'SE') {
					// Special excemption by federation
				} else if(line.jkz1) {
					const message = (
						'Falsches Jugendkennzeichen ' + JSON.stringify(line.jkz1) + ' in VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei ' +
						'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname + ' (AKL ' + line.akl + ')'
					);
					yield {
						type: 'vrl',
						vrl_typeid: vrl.typeid,
						clubcode: vrl.clubcode,
						message: message,
					};
				} else {
					const message = (
						'Jugendkennzeichen fehlt in VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ' bei ' +
						'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname
					);
					yield {
						type: 'vrl',
						vrl_typeid: vrl.typeid,
						clubcode: vrl.clubcode,
						message: message,
					};
				}
			} else if (line.jkz1 || (line.vkz1 === 'J1') || (line.vkz1 === 'S1') || (line.vkz1 === 'M1')) {
				const message = (
					'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname +
					' hat Kennzeichen ' + (line.jkz1 || line.vkz1) + ',' +
					' aber Altersklasse ' + JSON.stringify(line.akl) +
					' in der VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname
				);
				yield {
					type: 'vrl',
					vrl_typeid: vrl.typeid,
					clubcode: vrl.clubcode,
					message: message,
				};
			}
		}

		// Ascending team numbers
		if (line.teamcode) {
			let m = /^[0-9]+-[0-9]+-([JSM]?)([0-9]+)$/.exec(line.teamcode);
			if (m) {
				const team_char = m[1];
				const team_num = parseInt(m[2]);

				if ((team_char === last_team_char) && (last_team_num > team_num) && (last_team_num !== 0)) {
					const message = (
						'Mannschaftsnummer nicht aufsteigend in VRL ' +
						vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
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
					'Ungültiger Team-Code in VRL ' +
					vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
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
					'VRL-Zeile ohne Mannschaftszuordnung: VRL ' +
					vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ', ' +
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
	}

	// Check that each team has enough players
	for (const [team_id, players] of players_by_team.entries()) {
		if (! team_id) {
			// Bundesliga
			continue;
		}
		yield* check_team(vrl, team_id, players);
	}
}


module.exports = function*(season, data) {
	for (const vrl of data.all_vrlinfos()) {
		yield* check_vrl(data, vrl);
	}
};