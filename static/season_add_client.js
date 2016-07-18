'use strict';

var season_add_client = (function() {

function ui_init() {
	uiu.qsEach('form.season_add_dialog', function(form) {
		var url_input = uiu.qs('input[name="url"]', form);
		url_input.addEventListener('input', function() {
			// TODO automatically query Name + Season id
		});
	});
}

return {
	ui_init: ui_init,
};

})();


/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var uiu = require('./uiu');

	module.exports = season_add_client;
}
/*/@DEV*/
