'use strict';

const assert = require('assert');

const laws = require('../src/laws');


describe('laws', function() {
	it('is_backup O19', function() {
		const RL = {
			eventname: 'O19-RL',
			number: '1',
		};
		const KL = {
			eventname: 'O19-S1-KL',
			number: '5',
		};
		const KL2 = {
			eventname: 'O19-S1-KL',
			number: '6',
		};
		const KK = {
			eventname: 'O19-S1-KK',
			number: '7',
		};

		assert(laws.is_backup(KL, RL));
		assert(laws.is_backup(KL2, RL));
		assert(laws.is_backup(KK, KL));
		assert(laws.is_backup(KK, KL2));
		assert(!laws.is_backup(RL, KL));
		assert(!laws.is_backup(KL, KK));
		assert(!laws.is_backup(RL, RL));
		assert(!laws.is_backup(KL, KL));
		assert(!laws.is_backup(KL2, KL2));
		assert(!laws.is_backup(KK, KK));
		assert(laws.is_backup(KL2, KL));
		assert(!laws.is_backup(KL, KL2));
	});

	it('is_backup U19', function() {
		const TEAMS = [{
			eventname: 'U19-S1-VL',
			number: 'J1',
		}, {
			eventname: 'U19-S1-LL',
			number: 'J2',
		}, {
			eventname: 'U19-S1-LL',
			number: 'J3',
		}, {
			eventname: 'U19-S1-Mini',
			number: 'M1',
		}, {
			eventname: 'U19-S1-Mini',
			number: 'M2',
		}, {
			eventname: 'U17-S1-Mini',
			number: 'M3',
		}, {
			eventname: 'U15-S1-VL',
			number: 'S1',
		}, {
			eventname: 'U15-S1-LL',
			number: 'S2',
		}, {
			eventname: 'U15-S1-BL',
			number: 'S3',
		}, {
			eventname: 'U15-S1-Mini',
			number: 'M4',
		}, {
			eventname: 'U13-S1-Mini',
			number: 'M5',
		}, {
			eventname: 'U13-S1-Mini',
			number: 'M6',
		}, {
			eventname: 'U11-S1-Mini',
			number: 'M7',
		}];

		for (const [idx1, t1] of TEAMS.entries()) {
			for (const [idx2, t2] of TEAMS.entries()) {
				assert.strictEqual(
					laws.is_backup(t1, t2),
					idx1 > idx2,
					'(' + t1.eventname + ') ' + t1.number + ' should ' +
					((idx1 > idx2) ? 'be ok' : 'NOT be allowed') + ' to play in ' +
					'(' + t2.eventname + ') ' + t2.number
				);
			}
		}

	});

});
