LIBDIR=static/libs

default: run-server

help:
	echo 'make targets:'
	@echo '  help          This message'
	@echo '  deps          Download and install all dependencies (for compiling / testing / CLI operation)'
	@echo '  compile       Create output files from source files where necessary'
	@echo '  test          Run tests'
	@echo '  run           Run the krotoncheck server'
	@echo '  clean         Remove temporary files'


deps:
	(node --version && npm --version) >/dev/null 2>/dev/null || sudo apt-get install -y nodejs npm
	npm install

compile:
	$(MAKE) -C static all

test:
	@npm test

clean:
	@npm clean

run:
	node_modules/.bin/node-supervisor src/krotoncheck.js

run-server: run

lint: eslint ## Verify source code quality

eslint: eslint-server eslint-client

eslint-server:
	@node_modules/.bin/eslint src/ test/*.js

eslint-client:
	@node_modules/.bin/eslint -c static/.eslintrc static/*.js

install-service:
	@if id -u 2>/dev/null ; echo "Could not find user krotoncheck . Create the user and put this repository somewhere they can access"; exit 2; then fi
	sed -e "s#KROTONCHECK_ROOT_DIR#$$PWD#" div/krotoncheck.service.template > /etc/systemd/system/krotoncheck.service
	systemctl enable krotoncheck
	systemctl start krotoncheck

.PHONY: default compile help deps test clean run-server lint eslint eslint-server eslint-client install-service
