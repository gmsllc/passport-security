'use strict';

// REDIS STORE ADAPTER

var redis = require('redis'),
    util = require('util'),

    GetFunc = function (client) {
        var _self = this || {};

        _self.client = client;

        return function (id, cb) {
            _self.client.get(id, cb);
        };
    },

    SetFunc = function (client, ttl) {
        var _self = this || {};

        _self.client = client;
        _self.ttl = ttl;

        if (ttl) {
            return function (id, value, cb) {
                _self.client.setex(id, _self.ttl, value, cb);
            };
        } else {
            return function (id, value, cb) {
                _self.client.set(id, value, cb);
            }
        }
    },

    DelFunc = function (client) {
        var _self = this || {};

        _self.client = client;

        return function (id, cb) {
            _self.client.del(id, cb);
        };
    },


    Store = function (config) {

        var _self = this || {};

        _self.config = config || {};
        _self.ttl = _self.config.ttl;
        _self.debug = _self.config.debug;

        if(_self.debug) console.log('_SELF CONTAINS: '+ util.inspect(_self));

            if (_self.config.redisStore) {
            if(_self.debug) console.log('+++ USING PASSED REDIS CLIENT +++');
            _self.client = _self.config.redisStore;
        } else {
            if(_self.debug) console.log('+++ USING NEW REDIS CLIENT +++');
            _self.client = redis.createClient(_self.config.port || 6379, _self.config.host || '127.0.0.1', _self.config.options || {});
        }


        _self.get = new GetFunc(_self.client);
        _self.set = new SetFunc(_self.client, _self.ttl);
        _self.del = new DelFunc(_self.client);

        return this;
    };

module.exports = Store;