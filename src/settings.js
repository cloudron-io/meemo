/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    put: put
};

var MongoClient = require('mongodb').MongoClient,
    config = require('./config.js');

var g_db, g_settings;

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_db.createCollection('settings');
        g_settings = db.collection('settings');

        callback(null);
    });
}

function put(settings, callback) {
    g_settings.update({ type: 'frontend' }, { type: 'frontend', value: settings }, { upsert: true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function get(callback) {
    g_settings.find({ type: 'frontend' }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result[0] ? result[0].value : {
            title: 'Guacamoly'
        });
    });
}
