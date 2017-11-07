// ui utils
var uiu = (function() {
'use strict';

function qsEach(selector, func, container) {
	if (!container) {
		container = document;
	}
	var nodes = container.querySelectorAll(selector);
	for (var i = 0;i < nodes.length;i++) {
		func(nodes[i], i);
	}
}

function on_click(node, callback) {
	node.addEventListener('click', callback, false);
}

function on_click_qs(selector, callback) {
	on_click(qs(selector), callback);
}

function on_click_qsa(qs, callback) {
	qsEach(qs, function(node) {
		on_click(node, callback);
	});
}


function qs(selector, container) {
	if (!container) {
		container = document;
	}

	/*@DEV*/
	var all_nodes = container.querySelectorAll(selector);
	if (all_nodes.length !== 1) {
		throw new Error(all_nodes.length + ' nodes matched by qs ' + selector);
	}
	/*/@DEV*/

	var node = container.querySelector(selector);
	if (! node) {
		report_problem.silent_error('Expected to find qs  ' + selector + ' , but no node matching.');
		return;
	}
	return node;
}

function empty(node) {
	var last;
	while ((last = node.lastChild)) {
		node.removeChild(last);
	}
}

function remove(node) {
	empty(node);
	node.parentNode.removeChild(node);
}

function remove_qsa(qs, container) {
	qsEach(qs, remove, container);
}

function text(node, str) {
	empty(node);
	node.appendChild(node.ownerDocument.createTextNode(str));
}

function text_qs(selector, str) {
	text(qs(selector), str);
}

function create_el(parent, tagName, attrs, text) {
	var el = document.createElement(tagName);
	if (attrs) {
		for (var k in attrs) {
			el.setAttribute(k, attrs[k]);
		}
	}
	if ((text !== undefined) && (text !== null)) {
		el.appendChild(document.createTextNode(text));
	}
	if (parent) {
		parent.appendChild(el);
	}
	return el;
}

function attr(el, init_attrs) {
	if (init_attrs) {
		for (var k in init_attrs) {
			el.setAttribute(k, init_attrs[k]);
		}
	}
}

function el(parent, tagName, init_attrs, text) {
	var doc = parent ? parent.ownerDocument : document;
	var el = doc.createElement(tagName);
	if (typeof init_attrs === 'string') {
		init_attrs = {
			'class': init_attrs,
		};
	}
	attr(el, init_attrs);
	if ((text !== undefined) && (text !== null)) {
		el.appendChild(doc.createTextNode(text));
	}
	if (parent) {
		parent.appendChild(el);
	}
	return el;
}

// From https://plainjs.com/javascript/attributes/adding-removing-and-testing-for-classes-9/
var hasClass, addClass, removeClass;
if (typeof document != 'undefined') {
	if ('classList' in document.documentElement) {
		hasClass = function(el, className) {
			return el.classList.contains(className);
		};
		addClass = function(el, className) {
			el.classList.add(className);
		};
		removeClass = function(el, className) {
			el.classList.remove(className);
		};
	} else {
		hasClass = function (el, className) {
			return new RegExp('\\b'+ className+'\\b').test(el.className);
		};
		addClass = function (el, className) {
			if (!hasClass(el, className)) {
				el.className += ' ' + className;
			}
		};
		removeClass = function (el, className) {
			el.className = el.className.replace(new RegExp('\\b' + className + '\\b', 'g'), '');
		};
	}
}

function is_hidden(el) {
	// Fast track: look if style is set
	if (el.style.display === 'none') return true;
	if (el.style.display) return false;

	var cs = window.getComputedStyle(el);
	return (cs.display === 'none');
}

function hide(el) {
	var style = el.style;
	if (! is_hidden(el)) {
		if (style.display) {
			el.setAttribute('data-uiu-display', style.display);
		}
		style.display = 'none';
	}
}

function show(el) {
	var style = el.style;
	removeClass(el, 'default-invisible');
	if (is_hidden(el)) {
		style.display = el.getAttribute('data-uiu-display');
		el.removeAttribute('data-uiu-display');
	}
}


return {
	addClass: addClass,
	create_el: create_el,
	el: el,
	empty: empty,
	hasClass: hasClass,
	hide: hide,
	on_click: on_click,
	on_click_qs: on_click_qs,
	on_click_qsa: on_click_qsa,
	qs: qs,
	qsEach: qsEach,
	remove: remove,
	remove_qsa: remove_qsa,
	removeClass: removeClass,
	show: show,
	text: text,
	text_qs: text_qs,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var report_problem = require('./report_problem');

	module.exports = uiu;
}
/*/@DEV*/
