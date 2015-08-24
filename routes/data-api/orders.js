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
var moment = require('moment');


var model = require('../../model');
var ordersUtils = require('../../utils/orders.js');
var countries = require('../../utils/countries.js');
var shippingCalculator = require('../../utils/shipping-calculator.js');

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

var createOrder = function(req, res, next) {
    if(req.systemSettings('feature.payments') == 'off') {
        res.status(503).json({ error: 'payments are unavailable, please try again later'});
        return;
    }
    
    var orderId = uuid.v4();
    
    var projectPayment = ordersUtils.createPayment({
        planType: req.order.planType,
        plan: req.order.data.plan,
        recorderQty: req.body.recorderQty, 
        shippingAddress: req.body.address,
        redirect_urls: {
            return_url: req.appHost + "/process-order/"+ orderId,
            cancel_url: req.appHost + "/api/orders/cancel/" + orderId,
        },
    });
    
    console.log(projectPayment, '\n\n');
    console.log(projectPayment.transactions[0], '\n\n');
    console.log(projectPayment.transactions[0].item_list, '\n\n');
    
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
                action: req.order.action,
                data: JSON.stringify(req.order.data),
                payment_data: JSON.stringify(projectPayment.transactions[0])
            }, 
            function(err, result) {
                if(err) return next(err);
                
                var approvalLink = findLinkObject(resp.links, 'approval_url');
                
                console.log('approvalLink',  approvalLink.href);
                res.json({ approvalUrl: approvalLink.href });
            }
        );
    });
};

router.get('/payments-status', function(req, res) {
    res.json({ 
        payments_enable: req.systemSettings('feature.payments') == 'on' 
    });
});

router.post('/create-project', function(req, res, next) {
    if(!req.body.project) {
        return res.status(400).json({ error: "missing parameters" });
    }
    
    req.body.recorderQty = +req.body.recorderQty || 0;
    
    async.auto({
        projectData: function(callback) {
            var schema = joi.object().keys({
                name: joi.string(),
                url: joi.string(),
                description: joi.string(),
                is_private: joi.boolean(),
                plan: joi.object().keys({
                    tier: joi.string().valid('paid', 'free'),
                    storage: joi.number(),
                    duration: joi.number().optional(),
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
        
        var project = results.projectData;
        console.log('project:', project);
        
        // assign project_type_id to normal type
        project.project_type_id = 1;
        
        if(project.plan.tier == 'free') {
            var freePlan = {
                cost: 0,
                storage: 100,
                processing: 1000,
                tier: 'free'
            };
            
            project.plan = freePlan;
            
            // check if user own another free project
            model.users.findOwnedProjects(req.session.user.id, { free: true }, function(err, rows) {
                if(err) return next(err);
                
                if(rows.length > 0) {
                    res.status(403).json({ 
                        freeProjectLimit: true
                    });
                    return;
                }
                
                createProject(project, req.session.user.id, function(err, result) {
                    if(err) return next(err);
                    
                    res.json({ 
                        message: util.format("Project '%s' successfully created!", project.name)
                    });
                });
            });
        }
        else if(project.plan.tier == 'paid') {
            
            var plan = project.plan;
            delete project.plan;
            
            // set plan cost base on selected plan minutes
            plan.cost = plan.storage * plan.duration_period * 0.03;
            plan.processing = plan.storage * 100;
            plan.duration_period = plan.duration;
            delete plan.duration;
            
            console.log('plan:', plan);
            
            req.order = {
                action: 'create-project',
                planType: 'new',
                data: {
                    plan: plan,
                    project: project
                }
            };
            next();
        }
        else {
            res.sendStatus(400);
        }
    });
}, createOrder);



router.post('/update-project', function(req, res, next) {
    console.log(req.body);
    
    var newPlan = req.body.project.plan;
    req.body.recorderQty = +req.body.recorderQty || 0;
    
    if(!req.haveAccess(req.body.project.project_id, "manage project billing")) {
        res.status(401).json({ 
            error: "you dont have permission to 'manage project billing'" 
        });
        return;
    }
    
    model.projects.find({ id: req.body.project.project_id }, function(err, rows) {
        if(err) next(err);
        
        if(!rows.length) {
            return res.status(400).json({ error: 'invalid project id' });
        }
        
        console.log(rows[0]);
        
        var project = rows[0];
        
        // verify upgrade type (created new plan or upgrade current)
        
        if(project.plan_period) {
            project.plan_due = new Date(project.plan_activated || project.plan_created);
            project.plan_due.setFullYear(project.plan_due.getFullYear() + project.plan_period);
        }
        
        console.log(project.plan_due, (new Date()));
        
        
        var planType;
        // calculate cost
        if(project.plan_due && project.plan_due > (new Date()) ) {
            console.log('upgrade current plan');
            planType = 'upgrade';
            
            var monthsLeft = ordersUtils.monthsUntilDue(
                project.plan_activated || project.plan_created, 
                project.plan_period
            );
            
            console.log(monthsLeft);
            
            
            if(newPlan.storage < project.storage_limit) {
                res.status(403).json({
                    error: (
                        "project plans can not be downgraded, "+
                        "dont try this again"
                    ),
                });
                return;
            }
            
            newPlan.cost = (newPlan.storage - project.storage_limit) * monthsLeft * (0.03/12);
            newPlan.tier = 'paid';
        }
        else {
            console.log('create new plan');
            planType = 'new';
            newPlan.cost = newPlan.storage * 0.03;
        }
        
        newPlan.processing = newPlan.storage * 100;
        newPlan.duration_period = newPlan.duration;
        delete newPlan.duration;
        
        req.order = {
            action: planType + '-plan',
            planType: planType,
            data: {
                plan: newPlan,
                project_id: project.project_id,
            }
        };
        
        console.log(req.order);
        
        next();
    });
}, createOrder);

router.post('/calculate-shipping', function(req, res, next) {
    if(!req.body.address || !req.body.recorderQty)
        return res.status(400).json({ error: "missing parameters" });
    
    
    var address = req.body.address;
    
    var result = shippingCalculator(address, req.body.recorderQty);
    
    if(result.error) {
        return res.status(400).json(result);
    }
    
    console.log(result);
    
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
        function(err, result2) {
            res.json({ 
                shipping_cost: result.cost, 
                address: address 
            });
        }
    );
});


router.get('/countries', function(req, res) {
    res.json(countries);
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
        req.order.payment_data = JSON.parse(req.order.payment_data);
        
        if(req.order.user_id !== req.session.user.id) {
            res.sendStatus(403);
        }
        
        req.order.number = (
            moment(req.order.datetime).format("YYMMDDHHmm") + 
            req.order.user_id
        );
        
        return next();
    });
});

// // DUMMY
// router.post('/process/:orderId', function(req, res, next) { 
//     
//     res.json({ 
//         success: true, 
//         action: req.order.action,
//         invoice: req.order.payment_data,
//         orderNumber: req.order.number,
//         user: {
//             email: req.session.user.email,
//             fullName: req.session.user.firstname + ' ' + req.session.user.lastname,
//         },
//     });
// });

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
            
            if(req.order.data.plan.cost) {
                delete req.order.data.plan.cost;
            }
            
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
                // get Project
                model.projects.find({ id: req.order.data.project_id }, function(err, rows) {
                    if(err) return cb(err);
                    
                    if(!rows.length) return cb(new Error('project not found'));
                    
                    var project = rows[0];
                    
                    // update current plan with order.data
                    model.plans.update(project.current_plan, req.order.data.plan, function(err) {
                        if(err) return cb(err);
                        cb();
                    });
                });
                // TODO add event to project_audit table
            }
            else if(req.order.action == 'new-plan') {
                
                var plan = req.order.data.plan;
                plan.project_id = req.order.data.project_id;
                plan.created_on = new Date();
                
                // create new plans
                model.plans.insert(plan, function(err, result) {
                    if(err) return cb(err);
                    
                    var planId = result.insertId;
                    // assign plan_id to project.current_plan
                    
                    model.projects.update({
                        project_id: req.order.data.project_id,
                        current_plan: planId,
                    }, function(err) {
                        if(err) return cb(err);
                        cb();
                    });
                });
                // TODO add event to project_audit table
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
        
        res.json({ 
            success: true, 
            action: req.order.action,
            invoice: req.order.payment_data,
            orderNumber: req.order.number,
            user: {
                email: req.session.user.email,
                fullName: req.session.user.firstname + ' ' + req.session.user.lastname,
            },
        });
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
