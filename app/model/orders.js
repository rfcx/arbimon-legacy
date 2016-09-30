/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:orders');
var async = require('async');
var joi = require('joi');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;


var orderSchema = joi.object().keys({
    order_id: joi.string().length(36),
    user_id: joi.number(),
    datetime: joi.date(),
    status: joi.string(),
    action: joi.string(),
    data: joi.string(),
    paypal_payment_id: joi.string(),
    payment_data: joi.string(),
    error: joi.string().optional(),
});


var orders = {
    insert: function(orderData, callback) {
        var q = "INSERT INTO orders \n"+
                "SET ?";
        
        var result = joi.validate(orderData, orderSchema, {
            stripUnknown: true,
            presence: 'required',
        });
        
        if(result.error) {
            return callback(result.error);
        }
        
        var order = result.value;
        
        queryHandler(dbpool.format(q, order), callback);
    },
    
    findById: function(orderId, callback) {
        var q = "SELECT * FROM orders WHERE order_id = ?";
        
        queryHandler(dbpool.format(q, [orderId]), callback);
    },
    
    update: function(orderData, callback) {
        var q = "UPDATE orders SET ? WHERE order_id = ?";
        
        var result = joi.validate(orderData, orderSchema);
        if(result.error) {
            return callback(result.error);
        }
        
        var order = result.value;
        var orderId = order.order_id;
        delete order.order_id;
        
        
        queryHandler(dbpool.format(q, [order, orderId]), callback);
    },
};

module.exports = orders;
