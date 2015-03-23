'use strict';

var Store = require('./store'),
    uuid = require('node-uuid'),
    util = require('util'),
    idPrefix = '-~+|',
    idPostfix = '|+~-',
    defaultPacker = {

        pack: function (target) {
            return JSON.stringify(target);
        },

        unpack: function (target) {
            return JSON.parse(target);
        }
    },

    Bucket = function (bucketConfig) {

        var _bucket = this || {};

        _bucket.config = bucketConfig || {};
        _bucket.debug = _bucket.config.debug;
        _bucket.prefix = (_bucket.config.bucketId || uuid.v4()) + '|';
        _bucket.store = new Store({
            redisStore: _bucket.config.redisStore,
            ttl: _bucket.config.ttl,
            debug: _bucket.config.debug
        });
        _bucket.packer = _bucket.config.packer || defaultPacker;
        _bucket.ttl = _bucket.config.ttl;
    };

Bucket.prototype.get = function (id, cb) {
    var _bucket = this || {};
    if(_bucket.debug){
        console.log('Getting: '+util.inspect({
            id: _bucket.prefix + id
        }));
    }
    _bucket.store.get(_bucket.prefix + id, function (err, data) {
        if (!err && data) {
            data = _bucket.packer.unpack(data);
            if (data[idPrefix + _bucket.prefix + id + idPostfix]) data = data[idPrefix + _bucket.prefix + id + idPostfix];
        }

        if(_bucket.debug){
            console.log('Returned from Getting: '+util.inspect({
                err: err,
                data: data
            }));
        }
        cb(err, data);
    });
    return _bucket;
};

Bucket.prototype.set = function (id, value, cb) {
    var _bucket = this || {},
        data = {};
    if (typeof value !== 'object') {
        data[idPrefix + _bucket.prefix + id + idPostfix] = value;
        data = _bucket.packer.pack(data);
    } else {
        data = _bucket.packer.pack(value);
    }

    if(_bucket.debug){
        console.log('Storing: '+util.inspect({
            id: _bucket.prefix + id,
            value: data
        }));
    }

    _bucket.store.set(_bucket.prefix + id, data, function(err, data){
        if(_bucket.debug){
            console.log('Returned from Storing: '+util.inspect({
                err: err,
                data: data
            }));
        }
        if(!err && data === 'OK'){
            cb(null, value);
        } else {
            if (!err) err = new Error('Not Stored:'+data);
            cb(err, data);
        }
    });
    return _bucket;
};

Bucket.prototype.del = function (id, cb) {
    var _bucket = this || {};
    _bucket.store.del(_bucket.prefix + id, cb);
};

module.exports = Bucket;