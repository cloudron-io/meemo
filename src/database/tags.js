/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    del: del,
    update: update
};

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
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
