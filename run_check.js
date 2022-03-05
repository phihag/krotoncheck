#!/usr/bin/env node

const argparse = require('argparse');
const {promisify} = require('util');

const config_module = require('./src/config');
const database = require('./src/database');
const check = require('./src/check');
const {cmp_key} = require('./src/utils');


async function main() {
	const parser = new argparse.ArgumentParser({description: 'Run checks interactively'});
	parser.add_argument('-s', '--season', {
		help: 'key of the season to select. By default the newest season will be selected',
	});
	parser.add_argument('-j', '--json', {
		action: 'store_true',
		help: 'Output found problems as JSON',
	});
	const args = parser.parse_args();

	const app_cfg = await promisify(config_module.load)();
	const db = await database.async_init();

	// select season
	let seasons = await db.async_fetch_all([{
		collection: 'seasons',
	}]);
	if (args.season) {
		seasons = seasons.filter(s => s.key === args.season);
		if (!seasons.length) {
			parser.error(`Could not find season ${JSON.stringify(args.season)}`);
		}
	}
	seasons.sort(cmp_key('key'));
	const season = seasons[seasons.length - 1];

	// run checks in that season
	const {found} = await promisify(check.run_recheck)(season);

	// Write check output
	if (args.json) {
		console.log(JSON.stringify(found, undefined, 2));
		return;
	}

	for (const problem of found) {
		console.log(problem.message);
	}
}


(async () => {
    try {
        await main();
    } catch (e) {
        console.error(e.stack);
        process.exit(2);
    }
})();
