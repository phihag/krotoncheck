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

module.exports = {
	game_winner,
	is_winner,
	match_winner,
};
