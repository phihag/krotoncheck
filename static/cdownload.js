var cdownload = (function() {
'use strict';

function ui_init() {
	uiu.qsEach('.download_button', function(dbtn) {
		dbtn.addEventListener('click', function() {
			var season_key = dbtn.getAttribute('data-season_key');

			cutils.request(cutils.root_path() + 's/' + season_key + '/download-start', {
				_csrf: cutils.csrf_token(),
			}, function(err/*, doc*/) {
				if (err) {
					return report_problem.network_error(err);
				}

				// TODO reload downloads inline?
				location.reload();
			});
		});
	});
}

return {
	ui_init: ui_init,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var cutils = require('./cutils.js');
	var report_problem = require('./report_problem.js');
	var uiu = require('./uiu.js');

	module.exports = cdownload;
}
/*/@DEV*/
