# krotoncheck

krotoncheck checks a turnier.de league alongside the rules of a federation (currently supports NRW only). It is implented as a node.js service (configurable via HTTP) that sets

## Installation

Install node.js and npm, and type
```
$ npm i
```

You can set up a systemd service by creating a user `krotoncheck`, moving this repository somewhere they can access, and typing `make install-service`.

## Configuration & Start

Copy `config.json.example` to `config.json`, and fill in the usernames and passwords.

To start a development server, type `make run`. An admin account will be created automatically and be included in the output.
