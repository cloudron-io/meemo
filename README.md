# Guacamoly

Guacamoly is a personal data manager. It lets you simply input any kind of information like notes, thoughts, ideas as well as acts as a bookmarkmanager and todo list.
The user interface resembles a news feed organized with tags. Full text search further allows you to quickly find information in your pile of accumulated data.

For better bookmarking, there are chrome and firefox webextensions available.

[![Build Status](https://travis-ci.org/nebulade/guacamoly.svg?branch=master)](https://travis-ci.org/nebulade/guacamoly)

## Installation

[![Install](https://cloudron.io/img/button32.png)](https://cloudron.io/button.html?app=de.nebulon.guacamoly)

or using the [Cloudron command line tooling](https://cloudron.io/references/cli.html)

```
cloudron install --appstore-id de.nebulon.guacamoly
```

## Building

The app package can be built using the [Cloudron command line tooling](https://cloudron.io/references/cli.html).

```
cd guacamoly

cloudron build
cloudron install
```

## Development

The app can also be run locally for development. It depends on a locally running mongodb and optionally on an instance of the [ldap test server](https://github.com/nebulade/ldapjstestserver).

```
cd guacamoly

npm install

# with LDAP
LDAP_BIND_DN="cn=admin,ou=users,dc=example" LDAP_BIND_PASSWORD="password" LDAP_USERS_BASE_DN="ou=users,dc=example" LDAP_URL="ldap://localhost:3002" ./app.js

# without LDAP
./admin user-add --username test --password test --display-name "Test User"
./app.js
```
