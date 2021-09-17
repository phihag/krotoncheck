'use strict';

const assert = require('assert');
const path = require('path');
const {promisify} = require('util');

const data_access = require('../src/data_access');
const loader = require('../src/loader');
const match_vrl = require('../src/checks/match_vrl');


describe('HRT bug', function() {
	it('Test order with HRT', async () => {
		const test_tasks = data_access.ALL_TASKS.slice();

		const data = await promisify(loader.load_data)(
			path.join(__dirname, 'testdata_hrt'), test_tasks);

		const season = {
			key: 'testseason_order',
			data,
			check_now: 1489078800000,
		};
		data_access.enrich(season);

		const messages = Array.from(match_vrl(season));
		assert.deepStrictEqual(messages, []);
	});
});
