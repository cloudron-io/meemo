'use strict';

var superagent = require('superagent');

var g_server = location.origin;
var g_token = localStorage.token || '';

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function errorWrapper(callback) {
    return function (error, result) {
        if (error && error.status === 401) return module.exports.loginFailed();

        callback(error, result);
    };
}

function url(path) {
    return g_server + path + '?token=' + g_token;
}

function origin() {
    return g_server;
}

function token() {
    return g_token;
}

function Thing(id, createdAt, tags, content, richContent) {
    this.id = id;
    this.createdAt = createdAt || 0;
    this.tags = tags || [];
    this.content = content;
    this.edit = false;
    this.richContent = richContent;
}

function ThingsApi() {
    this._addCallbacks = [];
    this._editCallbacks = [];
    this._delCallbacks = [];
    this._operation = '';
    this._query = null;
}

ThingsApi.prototype.get = function (filter, callback) {
    var that = this;
    var u = url('/api/things');
    var operation = guid();

    this._operation = operation;

    this._query = {};

    if (filter) this._query.filter = filter;
    this._query.skip = 0;
    this._query.limit = 10;

    superagent.get(u).query(this._query).end(errorWrapper(function (error, result) {
        // ignore this if we moved on
        if (that._operation !== operation) {
            console.log('ignore this call');
            return;
        }

        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        var tmp = result.body.things.map(function (thing) {
            return new Thing(thing._id, new Date(thing.createdAt).getTime(), thing.tags, thing.content, thing.richContent);
        });

        // update skip for fetch more call
        that._query.skip += result.body.things.length;

        callback(null, tmp);
    }));
};

ThingsApi.prototype.fetchMore = function (callback) {
    var that = this;
    var u = url('/api/things');

    if (!this._query) return callback(new Error('no previous query'));

    superagent.get(u).query(this._query).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        var tmp = result.body.things.map(function (thing) {
            return new Thing(thing._id, new Date(thing.createdAt).getTime(), thing.tags, thing.content, thing.richContent);
        });

        // update skip for next call
        that._query.skip += result.body.things.length;

        callback(null, tmp);
    }));
};

ThingsApi.prototype.add = function (content, callback) {
    var that = this;

    superagent.post(url('/api/things')).send({ content: content }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._addCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        var thing = result.body.thing;

        callback(null, new Thing(thing._id, new Date(thing.createdAt).getTime(), thing.tags, thing.content, thing.richContent));
    }));
};

ThingsApi.prototype.edit = function (thing, callback) {
    var that = this;

    superagent.put(url('/api/things/' + thing.id)).send({ content: thing.content }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._editCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        callback(null, result.body.thing);
    }));
};

ThingsApi.prototype.del = function (thing, callback) {
    var that = this;

    superagent.del(url('/api/things/' + thing.id)).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._delCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        callback(null);
    }));
};

ThingsApi.prototype.publicLink = function (thing, callback) {
    superagent.post(url('/api/things/' + thing.id + '/public')).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        callback(null, result.body.publicLinkId);
    }));
};

ThingsApi.prototype.getPublic = function (shareId, callback) {
    superagent.get(url('/api/share/' + shareId)).end(errorWrapper(function (error, result) {
        if (result && result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));
        if (error) return callback(error);

        var thing = result.body.thing;

        callback(null, new Thing(thing._id, new Date(thing.createdAt).getTime(), thing.tags, thing.content, thing.richContent));
    }));
};

ThingsApi.prototype.import = function (formData, callback) {
    superagent.post(url('/api/import')).send(formData).end(function (error, result) {
        if (error) return callback(error);
        callback(null);
    });
};

ThingsApi.prototype.onAdded = function (callback) {
    this._addCallbacks.push(callback);
};

ThingsApi.prototype.onEdited = function (callback) {
    this._editCallbacks.push(callback);
};

ThingsApi.prototype.onDeleted = function (callback) {
    this._delCallbacks.push(callback);
};

ThingsApi.prototype.export = function () {
    window.location.href = url('/api/export');
};

function SettingsApi() {
    this._changeCallbacks = [];
    this.data = {};
    this.reset();
}

SettingsApi.prototype.reset = function () {
    var that = this;

    this.data.title = 'Guacamoly';
    this.data.backgroundUrl =  '';

    this._changeCallbacks.forEach(function (callback) {
        setTimeout(callback.bind(null, that.data), 0);
    });
};

SettingsApi.prototype.save = function (callback) {
    superagent.post(url('/api/settings')).send({ settings: this.data }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 202) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        callback(null);
    }));
};

SettingsApi.prototype.get = function (callback) {
    var that = this;

    superagent.get(url('/api/settings')).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that.set(result.body.settings);

        callback(null, result.body.settings);
    }));
};

SettingsApi.prototype.set = function (data) {
    var that = this;

    this.data.title = data.title;
    this.data.backgroundUrl = data.backgroundUrl;

    this._changeCallbacks.forEach(function (callback) {
        setTimeout(callback.bind(null, that.data), 0);
    });
};

SettingsApi.prototype.onChanged = function (callback) {
    this._changeCallbacks.push(callback);
};

function TagsApi() {}

TagsApi.prototype.get = function (callback) {
    superagent.get(url('/api/tags')).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        result.body.tags.sort(function (a, b) { return a.name > b.name; });

        callback(null, result.body.tags);
    }));
};

function SessionApi() {}

SessionApi.prototype.login = function (username, password, callback) {
    superagent.post(g_server + '/api/login').send({ username: username, password: password }).end(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Login failed. ' + result.status + '. ' + result.text));

        g_token = result.body.token;
        localStorage.token = g_token;

        callback(null);
    });
};

SessionApi.prototype.logout = function () {
    superagent.get(url('/api/logout')).end(function (error, result) {
        if (error) console.error(error);
        if (result.status !== 200) console.error('Logout failed.', result.status, result.text);

        g_token = '';
        delete localStorage.token;

        module.exports.onLogout();
    });
};

module.exports = {
    loginFailed: function () {},
    onLogout: function () {},
    url: url,
    origin: origin,
    token: token,
    Thing: Thing,
    session: new SessionApi(),
    settings: new SettingsApi(),
    things: new ThingsApi(),
    tags: new TagsApi()
};
