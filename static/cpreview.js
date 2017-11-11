'use strict';

// Standalone: Render email preview

document.addEventListener('DOMContentLoaded', function() {
	var previews = uiu.qs('.email_previews');
	uiu.empty(previews);
	var rendered = JSON.parse(previews.getAttribute('data-rendered-json'));

	rendered.forEach(function(r) {
		if (r.empty) {
			return;
		}

		var div = uiu.el(previews, 'div', 'jspreview');
		if (r.receiver_class) {
			uiu.el(div, 'span', {}, r.receiver_class + ' ');
		}
		uiu.el(div, 'span', {}, r.to);
		var colors = uiu.el(div, 'div', {
			style: 'display: inline-block;',
		});

		r.color_counts.forEach(function(cc) {
			uiu.el(colors, 'span', {
				style: (
					'display: inline-block;margin:0 0.2em;padding:0.1em 0.3em;' +
					'background:' + cc.css_color + ';'
				),
			}, cc.count);
		});

		var html_link = uiu.el(div, 'span', 'jspreview_show_link', 'HTML zeigen');
		html_link.addEventListener('click', function() {
			if (uiu.hasClass(html_space, 'jspreview_visible')) {
				uiu.hide(html_space);
				uiu.empty(html_space);
				uiu.text(html_link, 'HTML zeigen');
				uiu.removeClass(html_space, 'jspreview_visible');
			} else {
				html_space.innerHTML = r.body_html;
				uiu.text(html_link, 'HTML verbergen');
				uiu.addClass(html_space, 'jspreview_visible');
				uiu.show(html_space);
			}
		});

		var plain_link = uiu.el(div, 'span', 'jspreview_show_link', 'Text zeigen');
		plain_link.addEventListener('click', function() {
			if (uiu.hasClass(plain_space, 'jspreview_visible')) {
				uiu.hide(plain_space);
				uiu.empty(plain_space);
				uiu.text(plain_link, 'Text zeigen');
				uiu.removeClass(plain_space, 'jspreview_visible');
			} else {
				uiu.text(plain_space, r.mail_text);
				uiu.text(plain_link, 'Text verbergen');
				uiu.addClass(plain_space, 'jspreview_visible');
				uiu.show(plain_space);
			}
		});

		var html_space = uiu.el(div, 'div', {style: 'display:none;'});
		var plain_space = uiu.el(div, 'div', {
			'class': 'jsplaintext_preview',
			style: 'display:none;',
		});
	});
});


/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var uiu = require('./uiu.js');
}
/*/@DEV*/
