/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    del: del,
    update: update,
    cleanup: cleanup
};

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
    things = require('../things.js'),
    config = require('../config.js');

var g_db;
var g_collections = {};

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;

        callback(null);
    });
}

function getCollection(userId) {
    if (!g_collections[userId]) {
        g_db.createCollection(userId + '_tags');
        g_collections[userId] = g_db.collection(userId + '_tags');
    }

    return g_collections[userId];
}

function get(userId, callback) {
    getCollection(userId).find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result || []);
    });
}

function update(userId, name, callback) {
    getCollection(userId).update({ name: name }, {
        $inc: { usage: 1 },
        $set: {
            name: name
        }
    }, { upsert:true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function del(userId, id, callback) {
    getCollection(userId).deleteOne({ _id: new ObjectId(id) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function cleanup(userId) {
    things.getAllLean(userId, function (error, result) {
        if (error) return console.error(new Error(error));

        var tags = [];
        result.forEach(function (thing) {
            tags = tags.concat(things.extractTags(thing.content));
        });

        get(function (error, result) {
            if (error) return console.error(new Error(error));

            async.each(result, function (tag, callback) {
                if (tags.indexOf(tag.name) !== -1) return callback(null);

                console.log('Cleanup tag', tag.name);

                del(userId, tag._id, callback);
            }, function (error) {
                if (error) console.error('Failed to cleanup tags:', error);
            });
        });
    });
}
