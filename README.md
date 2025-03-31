**Development has moved to : https://git.cloudron.io/packages/meemo-app**

# Meemo

Meemo is a personal data manager. It lets you simply input any kind of information like notes, thoughts, ideas as well as acts as a bookmarkmanager and todo list.
The user interface resembles a news feed organized with tags. Full text search further allows you to quickly find information in your pile of accumulated data.

For better bookmarking, there are chrome and firefox webextensions available.

## Installation

[![Install](https://cloudron.io/img/button32.png)](https://cloudron.io/button.html?app=de.nebulon.guacamoly)

or using the [Cloudron command line tooling](https://cloudron.io/references/cli.html)

```
cloudron install --appstore-id de.nebulon.guacamoly
```

## Building

The app package can be built using the [Cloudron command line tooling](https://cloudron.io/references/cli.html).

```
cd meemo

cloudron build
cloudron install
```

## Development

The app can also be run locally for development.

```
cd meemo

npm install
gulp # or gulp develop in a new terminal
./app.js
```
