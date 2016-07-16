'use strict';

document.addEventListener('DOMContentLoaded', function() {
	var form = uiu.qs('form.season_add_dialog');
	var url_input = uiu.qs('input[name="url"]', form);
	url_input.addEventListener('input', function() {
		// TODO automatically query Name + Season id
	});
});


/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var uiu = require('./uiu');

	module.exports = uiu;
}
/*/@DEV*/
