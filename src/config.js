/* jslint node:true */

'use strict';

exports = module.exports = {
    databaseUrl: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/guacamoly'
};
