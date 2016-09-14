'use strict';

document.addEventListener('DOMContentLoaded', function() {
	season_add_client.ui_init();
	cdownload.ui_init();
});

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var cdownload = require('./cdownload.js');

	var season_add_client = require('./season_add_client');
}
/*/@DEV*/
