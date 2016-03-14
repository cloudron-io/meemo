/* jslint node:true */

'use strict';

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
    fs = require('fs'),
    os = require('os'),
    config = require('./config.js'),
    tags = require('./tags.js'),
    path = require('path'),
    superagent = require('superagent');

exports = module.exports = {
    init: init,
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    del: del,
    exp: exp,
    imp: imp,
    publicLink: publicLink,
    getByShareId: getByShareId
};

var g_db, g_things, g_publicLinks;

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_db.createCollection('things');
        g_db.createCollection('publicLinks');
        g_things = db.collection('things');
        g_publicLinks = db.collection('publicLinks');

        g_things.createIndex({ content: 'text' }, { default_language: 'none' });

        callback(null);
    });
}

function facelift(data, tagObjects, callback) {
    var geturl = new RegExp('(^|[ \t\r\n])((ftp|http|https|gopher|mailto|news|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))', 'g');

    var lines = data.split('\n');
    var urls = [];

    lines.forEach(function (line) {
        var tmp = line.match(geturl);
        if (tmp === null) return;

        urls = tmp.map(function (url) {
            return url.trim();
        }).concat(urls);
    });

    async.each(urls, function (url, callback) {
        url = url.trim();

        superagent.get(url).end(function (error, result) {
            if (error) return callback(null);

            if (result.type.indexOf('image/') === 0) {
                data = data.replace(url, '![' + url + '](' + url + ')');
            }

            callback(null);
        });
    }, function () {
        tagObjects.forEach(function (tag) {
            data = data.replace(new RegExp('#' + tag, 'gmi'), '[#' + tag + '](#search?#' + tag + ')');
        });

        callback(data);
    });
}

function extractTags(data) {
    var lines = data.split('\n');
    var tagObjects = [];

    lines.forEach(function (line) {
        var tmp = line.match(/\B#(\w+)/g);
        if (tmp === null) return;

        tagObjects = tmp.map(function (tag) {
            return tag.slice(1).toLowerCase();
        }).concat(tagObjects);
    });

    return tagObjects;
}

function getAll(query, skip, limit, callback) {
    g_things.find(query).skip(skip).limit(limit).sort({ modifiedAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        async.each(result, function (thing, callback) {
            var tagObjects = extractTags(thing.content);
            facelift(thing.content, tagObjects, function (data) {
                thing.richContent = data;

                callback(null);
            });
        }, function () {
            callback(null, result);
        });
    });
}

function get(id, callback) {
    g_things.find({ _id: new ObjectId(id) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        var thing = result[0];
        facelift(thing.content, extractTags(thing.content), function (data) {
            thing.richContent = data;
            callback(null, thing);
        });
    });
}

function add(content, callback) {
    var tagObjects = extractTags(content);
    var data = content;

    var doc = {
        content: data,
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: tagObjects
    };

    async.eachSeries(tagObjects, tags.update, function (error) {
        if (error) return callback(error);

        g_things.insert(doc, function (error, result) {
            if (error) return callback(error);
            if (!result) return callback(new Error('no result returned'));

            var thing = result.ops[0];
            facelift(thing.content, extractTags(thing.content), function (data) {
                thing.richContent = data;
                callback(null, thing);
            });
        });
    });
}

function put(id, content, callback) {
    var tagObjects = extractTags(content);
    var data = content;

    async.eachSeries(tagObjects, tags.update, function (error) {
        if (error) return callback(error);

        g_things.update({_id: new ObjectId(id) }, { $set: { content: data, tags: tagObjects, modifiedAt: new Date() } }, function (error) {
            if (error) return callback(error);

            get(id, callback);
        });
    });
}

function del(id, callback) {
    g_things.deleteOne({ _id: new ObjectId(id) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function exp(callback) {
    g_things.find({}).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return (null, '');

        var fileName = path.join(os.tmpdir(), Date.now() + '.json');
        var out = result.map(function (thing) {
            return {
                createdAt: thing.createdAt,
                modifiedAt: thing.modifiedAt,
                content: thing.content
            };
        });
        fs.writeFileSync(fileName, JSON.stringify({ things : out }, null, 4));

        callback(null, fileName);
    });
}

function imp(data, callback) {
    async.eachSeries(data.things, function (thing, next) {
        var tagObjects = extractTags(thing.content);
        var data = thing.content;

        var doc = {
            content: data,
            createdAt: thing.createdAt,
            modifiedAt: thing.modifiedAt || thing.createdAt,
            tags: tagObjects
        };

        async.eachSeries(tagObjects, tags.update, function (error) {
            if (error) return next(error);

            g_things.insert(doc, function (error, result) {
                if (error) return next(error);
                if (!result) return next(new Error('no result returned'));

                next(null, result._id);
            });
        });
    }, callback);
}

function publicLink(id, callback) {
    var doc = {
        thingId: id,
        createdAt: new Date()
    };

    g_publicLinks.insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result.insertedIds[0]);
    });
}

function getByShareId(shareId, callback) {
    g_publicLinks.find({ _id: new ObjectId(shareId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        get(result[0].thingId, function (error, result) {
            if (error) return callback(error);

            callback(null, result);
        });
    });
}
