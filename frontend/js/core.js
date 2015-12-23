var superagent = require('superagent');

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function errorWrapper(callback) {
    return function (error, result) {
        if (error && error.status === 401) {
            window.location.href = '/auth/login';
            return;
        }

        callback(error, result);
    };
}

function Thing(id, createdAt, tags, content, richContent) {
    this.id = id;
    this.createdAt = createdAt || 0;
    this.tags = tags || [];
    this.content = content;
    this.richContent = richContent;
}

function Things(server) {
    this._server = server;
    this._addCallbacks = [];
    this._editCallbacks = [];
    this._delCallbacks = [];
    this.data = [];
    this._operation = '';
}

Things.prototype.get = function (filter, callback) {
    var that = this;
    var url = this._server + '/api/things';
    var operation = guid();

    this._operation = operation;

    if (filter) url += '?filter=' + encodeURIComponent(filter);

    superagent.get(url).end(errorWrapper(function (error, result) {
        // ignore this if we moved on
        if (that._operation !== operation) {
            console.log('ignore this call');
            return;
        }

        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that.data = result.body.things.map(function (thing) {
            return new Thing(thing._id, new Date(thing.createdAt).getTime(), thing.tags, thing.content, thing.richContent);
        });

        callback(null, that.data);
    }));
};

Things.prototype.add = function (content, callback) {
    var that = this;
    var url = this._server + '/api/things';

    superagent.post(url).send({ content: content }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._addCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        callback(null);
    }));
};

Things.prototype.edit = function (thing, callback) {
    var that = this;
    var url = this._server + '/api/things/' + thing.id;

    superagent.put(url).send({ content: thing.content }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 201) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._editCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        callback(null);
    }));
};

Things.prototype.del = function (thing, callback) {
    var that = this;
    var url = this._server + '/api/things/' + thing.id;

    superagent.del(url).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that._delCallbacks.forEach(function (callback) {
            setTimeout(callback, 0);
        });

        callback(null);
    }));
};

Things.prototype.onAdded = function (callback) {
    this._addCallbacks.push(callback);
};

Things.prototype.onEdited = function (callback) {
    this._editCallbacks.push(callback);
};

Things.prototype.onDeleted = function (callback) {
    this._delCallbacks.push(callback);
};

Things.prototype.export = function () {
    window.location.href = this._server + '/api/export';
};

function Settings(server) {
    this._server = server;
    this._changeCallbacks = [];
    this.data = {
        title: '',
        backgroundUrl: ''
    };
}

Settings.prototype.save = function (callback) {
    var url = this._server + '/api/settings';

    superagent.post(url).send({ settings: this.data }).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 202) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        callback(null);
    }));
};

Settings.prototype.get = function (callback) {
    var that = this;
    var url = this._server + '/api/settings';

    superagent.get(url).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        that.set(result.body.settings);

        callback(null, result.body.settings);
    }));
};

Settings.prototype.set = function (data) {
    var that = this;

    this.data.title = data.title;
    this.data.backgroundUrl = data.backgroundUrl;

    this._changeCallbacks.forEach(function (callback) {
        setTimeout(callback.bind(null, that.data), 0);
    });
};

Settings.prototype.onChanged = function (callback) {
    this._changeCallbacks.push(callback);
};

function Tags(server) {
    this._server = server;
}

Tags.prototype.get = function (callback) {
    var url = this._server + '/api/tags';

    superagent.get(url).end(errorWrapper(function (error, result) {
        if (error) return callback(error);
        if (result.status !== 200) return callback(new Error('Failed: ' + result.status + '. ' + result.text));

        callback(null, result.body.tags);
    }));
};

function Core() {
    this._server = '';

    this.settings = new Settings(this._server);
    this.things = new Things(this._server);
    this.tags = new Tags(this._server);
}

module.exports = {
    Thing: Thing,
    Core: new Core()
};
