/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:routes:orders');
var util = require('util');
var express = require('express');
var router = express.Router();
var paypal = require('paypal-rest-sdk');
var async = require('async');
var joi = require('joi');
var uuid = require('node-uuid');


var model = require('../../model');

/**
    creates a new project an create news about project creation
*/
var createProject = function(project, userId, callback) {
    model.projects.create(project, userId, function(err, projectId) {
        if(err) return callback(err);
        
        model.projects.insertNews({
            news_type_id: 1, // project created
            user_id: userId,
            project_id: projectId,
            data: JSON.stringify({})
        });
        
        callback(null, projectId);
    });
};

var findLinkObject = function(links, linkRelation) {
    var approvalLink = links.filter(function(link) {
        if(link.rel == linkRelation)
            return link;
    });
    
    return approvalLink[0] || null;
};


router.post('/create-project', function(req, res, next) {
    if(!req.body.project) {
        return res.status(400).json({ error: "missing parameters" });
    }
    
    
    var orderData = {};
    
    orderData.recorderQty = +req.body.recorderQty || 0;
    orderData.shippingAddress = req.body.address;
    
    async.auto({
        projectData: function(callback) {
            var schema = joi.object().keys({
                name: joi.string(),
                url: joi.string(),
                description: joi.string(),
                tier: joi.string().valid('paid', 'free'),
                is_private: joi.boolean(),
                plan: joi.object().keys({
                    storage: joi.number(),
                })
            });
            
            //type cast is_private
            req.body.project.is_private = Boolean(req.body.project.is_private);
            
            joi.validate(req.body.project, schema, {
                    stripUnknown: true,
                    presence: 'required',
                }, callback);
        },
        nameExists: function(callback, results) {
            model.projects.findByName(results.projectData.name, function(err, rows) {
                if(err) return callback(err);

                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        },
        urlExists: function(callback, results) {
            model.projects.findByUrl(results.projectData.url, function(err, rows) {
                if(err) return callback(err);

                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        }
    },
    function(err, results) {
        if(err) return next(err);
        
        if(results.nameExists || results.urlExists) {
            return res.status(403).json(results);
        }
        
        orderData.project = results.projectData;
        console.log(orderData.project);
        
        // assign project_type_id to normal type
        orderData.project.project_type_id = 1;
        
        if(orderData.project.tier == 'free') {
            var freePlan = {
                cost: 0,
                storage: 100,
                processing: 1000,
            };
            
            orderData.project.plan = freePlan;
            
            // check if user own another free project
            model.users.findOwnedProjects(req.session.user.id, { free: true }, function(err, rows) {
                if(err) return next(err);
                
                if(rows.length > 0) {
                    res.status(403).json({ 
                        freeProjectLimit: true
                    });
                    return;
                }
                
                createProject(orderData.project, req.session.user.id, function(err, result) {
                    if(err) return next(err);
                    
                    res.json({ 
                        message: util.format("Project '%s' successfully created!", orderData.project.name)
                    });
                });
            });
        }
        else if(orderData.project.tier == 'paid') {
            // set plan cost base on selected plan minutes
            orderData.project.plan.cost = orderData.project.plan.storage*0.03;
            orderData.project.plan.processing = orderData.project.plan.storage*100;
            
            var recorderInfo = {
                price: 125,
                currency: "USD",
                tax: 0, // tax in dollars
                name: "Arbimon recorder",
                description: (
                    "recorder description"
                )
            };
            
            // prepare order and forward to paypal
            var orderId = uuid.v4();
            
            var projectPayment = {
                intent: "sale",
                payer: {
                    payment_method: "paypal"
                },
                redirect_urls: {
                    return_url: req.appHost + "/process-order/"+ orderId,
                    cancel_url: req.appHost + "/api/orders/cancel/" + orderId,
                },
                transactions: [{
                    amount: {
                        currency: "USD",
                        details: {}
                    },
                    item_list: {
                        items: [{
                            quantity: 1,
                            price: orderData.project.plan.cost,
                            currency: "USD",
                            tax: 0,
                            name: "Plan for project '"+orderData.project.name+"'",
                            description: (
                                "includes storage for "+ 
                                orderData.project.plan.storage +
                                " minutes of audio "+
                                "and capacity to process "+ 
                                orderData.project.plan.processing +
                                " minutes of audio"
                            )
                        }]
                    }
                }]
            };
            
            var subtotal = 0, 
                tax = 0,
                total = 0,
                shippingCost = 0;
            
            if(orderData.recorderQty) {
                recorderInfo.quantity = +orderData.recorderQty;
                
                // updates item list to add recorders
                var itemList = projectPayment.transactions[0].item_list;
                itemList.items.push(recorderInfo);
                
                // add shipping_address
                itemList.shipping_address = {
                    recipient_name: orderData.shippingAddress.name,
                    line1: orderData.shippingAddress.line1,
                    line2: orderData.shippingAddress.line2,
                    city: orderData.shippingAddress.city,
                    state: orderData.shippingAddress.state,
                    country_code: orderData.shippingAddress.country_code,
                    postal_code: orderData.shippingAddress.postal_code,
                    phone: orderData.shippingAddress.telephone,
                };
                
                // TODO calculate shipping cost
                shippingCost = 10;
            }
            
            projectPayment.transactions[0].item_list.items.forEach(function(item) {
                subtotal += item.price;
                tax += item.tax;
            });
            
            total = subtotal + tax;
            
            projectPayment.transactions[0].amount.details.shipping = shippingCost;
            projectPayment.transactions[0].amount.details.subtotal = subtotal;
            projectPayment.transactions[0].amount.details.tax = tax;
            projectPayment.transactions[0].amount.total = total + shippingCost;
            
            paypal.payment.create(projectPayment, function(err, resp) {
                if(err) {
                    console.error(err.response.name);
                    console.error(err.response.details);
                    res.sendStatus(err.response.httpStatusCode);
                    return;
                }
                console.log(resp);
                model.orders.insert({
                        order_id: orderId,
                        user_id: req.session.user.id,
                        datetime: resp.create_time,
                        status: 'created',
                        paypal_payment_id: resp.id,
                        action: 'create-project',
                        data: JSON.stringify(orderData),
                    }, 
                    function(err, result) {
                        if(err) return next(err);
                        
                        var approvalLink = findLinkObject(resp.links, 'approval_url');
                        
                        console.log('approvalLink',  approvalLink.href);
                        res.json({ approvalUrl: approvalLink.href });
                    }
                );
            });
        }
    });
});

router.post('/update-project', function(req, res, next) {
    
});

router.post('/calculate-shipping', function(req, res, next) {
    // TODO calculate shipping & handling cost
    // receive list of items to be shipped
    console.log(req.body.address);
    var address = req.body.address;
    
    model.users.updateAddress(
        {
            user_id: req.session.user.id,
            name: address.name,
            line1: address.line1,
            line2: address.line2 || '',
            city: address.city,
            state: address.state,
            country_code: address.country_code,
            postal_code: address.postal_code,
            telephone: address.telephone,
        },
        function(err, result) {
            res.json({ 
                shipping_cost: 10, 
                address: address 
            });
        }
    );
    
});



router.param('orderId', function(req, res, next, orderId) {
    console.log(orderId);
    model.orders.findById(orderId, function(err, rows) {
        if(err) return next(err);

        if(!rows.length){
            return res.sendStatus(404);
        }

        req.order = rows[0];
        req.order.data = JSON.parse(req.order.data);
        
        return next();
    });
});

router.post('/process/:orderId', function(req, res, next) {
    
    if(!req.query.PayerID) {
        return res.status(400).json({ error: 'MISSING_PARAMS'});
    }
    var payer = { payer_id : req.query.PayerID };
    
    if(req.order.status != 'created') {
        return res.status(400).json({ error: 'ALREADY_PROCESSED' });
    }
    
    async.series([
        function executePayment(cb) {
            paypal.payment.execute(req.order.paypal_payment_id, payer, {}, function(err, resp) {
                if(err) {
                    console.error(err);
                    if(err.response.name == 'PAYMENT_NOT_APPROVED_FOR_EXECUTION') {
                        paypal.payment.get(req.order.paypal_payment_id, function(err, resp) {
                            if(err) {
                                console.error(err);
                                return res.sendStatus(500);
                            }
                            console.log(resp);
                            var approvalLink = findLinkObject(resp.links, 'approval_url');
                            
                            res.status(400).json({ 
                                error: 'APPROVAL_NEEDED',
                                approvalLink: approvalLink.href,
                            });
                        });
                    }
                    else {
                        model.orders.update({
                            order_id: req.order.order_id,
                            status: 'error',
                            error: JSON.stringify(err),
                        },
                        function(err, result) {
                            if(err) return next(err);
                            
                            res.status(500).json({ error: 'ERROR' });
                        });
                    }
                    return;
                }
                
                console.log(resp);
                cb();
            });
        },
        function setApproved(cb) {
            model.orders.update({
                order_id: req.order.order_id,
                status: 'approved'
            }, cb);
        },
        function performAction(cb) {
            // perform action required by order:
            
            // create project and plan for it
            if(req.order.action == 'create-project') {
                createProject(
                    req.order.data.project, 
                    req.session.user.id, 
                    function(err) {
                        if(err) return cb(err);
                        cb();
                    }
                );
            }
            // update project plan
            else if(req.order.action == 'update-plan') {
                
            }
        },
        function setCompleted(cb) {
            model.orders.update({
                order_id: req.order.order_id,
                status: 'completed'
            }, cb);
        },
    ], function(err) {
        console.log(err);
        if(err) return next(err);
        
        res.json({ success: true, action: req.order.action });
    });
});

router.get('/cancel/:orderId', function(req, res, next) {
    // set order as canceled
    
    if(req.order.status != 'created') {
        return res.redirect('/home');
    }
        
    model.orders.update(
        {
            order_id: req.order.order_id,
            status: 'canceled'
        }, 
        function(err, result) {
            if(err) return next(err);
            
            res.redirect('/home');
        }
    );
});

module.exports = router;
