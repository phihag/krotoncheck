# krotoncheck

krotoncheck checks a turnier.de league alongside the rules of a federation (currently supports NRW only). It is implented as a node.js service (configurable via HTTP) that sets

## Installation

Install node.js, check out this repository, and install node.js dependencies:
```
$ git clone https://github.com/phihag/krotoncheck.git
$ cd krotoncheck
$ npm i
```

## Docker installation

You can also use the docker image:
```
$ docker run -u "$$(id -u):$$(id -g)" -v "$$(pwd)/data:/krotoncheck/data" --rm -it -p 3002:3002 krotoncheck
```

or install a docker service:
```
$ make docker
```

## Configuration & Start

Copy `config.json.example` to `config.json`, and fill in the usernames and passwords. To import from turnier.de/tournamentsoftware.com, you will need an administration account, whose credentials need to be filled in for `tournament_user`/`tournament_password`.

To start a development server, type `make run`. An admin account will be created automatically and be included in the output.

You can set up a systemd service by creating a user `krotoncheck`, moving this repository somewhere they can access, and typing `make install-service`.
