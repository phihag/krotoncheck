'use strict';

// Check the VRLs themselves

var utils = require('../utils.js');

function* extract_vrls(data) {
	let clubcode;
	let clubname;
	let typeid = null;

	let entries = [];

	for (const line of data.clubranking) {
		if ((clubcode !== line.clubcode) || (typeid !== line.typeid)) {
			// Commit current
			if (typeid !== null) {
				yield {
					clubcode: clubcode,
					clubname: clubname,
					typeid: typeid,
					entries: entries,
				};
			}
			typeid = line.typeid;
			clubcode = line.clubcode;
			clubname = line.clubname;
			entries = [];
		}
		entries.push(line);
	}

	if (typeid !== null) {
		yield {
			clubcode: clubcode,
			clubname: clubname,
			typeid: typeid,
			entries: entries,
		};
	}
}

function count_o19_players(players) {
	let res = 0;
	for (const p of players) {
		// Nichtstammspieler
		if (p.vkz1 === 'N') {
			continue;
		}
		// Jugendspieler
		if ((p.vkz1 === 'J1') || (p.vkz1 === 'S1') || (p.vkz1 === 'M1')) {
			continue;
		}
		res++;
	}
	return res;
}

function* check_team(vrl, team_id, players) {
	if ((vrl.typeid == '9') || (vrl.typeid == '11')) {
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
	} else if ((vrl.typeid == '10') || (vrl.typeid == '12')) {
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
	} else if ((vrl.typeid == '17') || (vrl.typeid == '18')) {
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
	} else if ((vrl.typeid == '14') || (vrl.typeid == '16')) {
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

function* check_vrl(data, vrl) {
	const is_o19 = ['9', '11', '10', '12'].includes(vrl.typeid);
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
		const position_doubles = line.teampositiondouble ? parseInt(line.teampositiondouble) : position;

		// No gaps in VRL
		if ((last_id + 1) !== position) {
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
			const m = /^U([01][0-9])(?:-[12])?$/.exec(line.akl);
			if (m) {
				if ((line.jkz1 === 'U19E') && (m[1] == '19')) {
					// Alright, nothing to do here
				} else if ((line.vkz1 === 'J1') || (line.vkz1 === 'M1')) {
					// Ok as well
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
	const vrls = extract_vrls(data);

	for (const vrl of vrls) {
		yield* check_vrl(data, vrl);
	}
};