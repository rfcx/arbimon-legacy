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
var q = require('q');
var systemSettings = require('../../utils/settings-monitor');
var config = require('../../config');
const rfcxConfig = config('rfcx');

var model = require('../../model');
var APIError = require('../../utils/apierror.js');
var ordersUtils = require('../../utils/orders.js');
var countries = require('../../utils/countries.js');
var shippingCalculator = require('../../utils/shipping-calculator.js');

var findLinkObject = function(links, linkRelation) {
    var approvalLink = links.filter(function(link) {
        if(link.rel == linkRelation)
            return link;
    });

    return approvalLink[0] || null;
};

var createOrder = function(user, order, addendum, appHost) {
    if(systemSettings.setting('feature.payments') == 'off') {
        throw new APIError({ error: 'payments are unavailable, please try again later'}, 503);
    }

    var orderId = uuid.v4();

    var projectPayment = ordersUtils.createPayment({
        planType: order.planType,
        plan: order.data.plan,
        recorderQty: addendum.recorderQty,
        shippingAddress: addendum.address,
        redirect_urls: {
            return_url: appHost + "/process-order/"+ orderId,
            cancel_url: appHost + "/legacy-api/orders/cancel/" + orderId,
        },
    });

    console.log(projectPayment, '\n\n');
    console.log(projectPayment.transactions[0], '\n\n');
    console.log(projectPayment.transactions[0].item_list, '\n\n');
    var paypal_response;

    q.ninvoke(paypal.payment, "create", projectPayment).then(function(resp){
        paypal_response = resp;
        console.log(paypal_response);
    }, function(error){
        if(error) {
            console.error(error.response.name);
            console.error(error.response.details);
            throw new APIError("Error processing payment", error.response.httpStatusCode);
        }
    }).then(function() {
        return q.ninvoke(model.orders, "insert", {
            order_id: orderId,
            user_id: user.id,
            datetime: paypal_response.create_time,
            status: 'created',
            paypal_payment_id: paypal_response.id,
            action: order.action,
            data: JSON.stringify(order.data),
            payment_data: JSON.stringify(projectPayment.transactions[0])
        });
    }).then(function(result) {
        var approvalLink = findLinkObject(paypal_response.links, 'approval_url');
        console.log('approvalLink',  approvalLink.href);
        return { approvalUrl: approvalLink.href };
    });
};

router.get('/payments-status', function(req, res) {
    res.type('json');
    res.json({
        payments_enable: req.systemSettings('feature.payments') == 'on'
    });
});

router.get('/contact', function(req, res) {
    res.type('json');
    res.json({
        email:req.systemSettings('orders.contact.email')
    });
});

router.post('/check-coupon', function(req, res, next) {
    res.type('json');
    model.ActivationCodes.listAll({
        consumed:0,
        hash:req.body.hash,
        consumer:req.session.user.id
    }).get(0).then(function(code){
        if(code){
            code.valid = !code.consumed;
        } else {
            code = {valid:false};
        }
        res.json(code);
    }, next);
});

var projectSchema = joi.object().keys({
    name: joi.string(),
    url: joi.string(),
    description: joi.string().optional(),
    is_private: joi.boolean(),
});

var planSchema = joi.object().keys({
    tier: joi.string().valid('paid', 'free'),
    storage: joi.number(),
    duration: joi.number().optional(),
});

var freePlan = { ...model.projects.plans.free };


router.post('/create-project', function(req, res, next) {
    res.type('json');
    if(req.session.user && req.session.user.isAnonymousGuest) {
        return res.status(401).json({ error: "unauthorized"});
    }

    if(!req.body.project) {
        return res.status(400).json({ error: "missing parameters" });
    }

    req.body.recorderQty = +req.body.recorderQty || 0;


    var project = req.body.project;
    var plan = project.plan;
    var couponHash = req.body.coupon;
    delete project.plan;
    //type cast is_private
    project.is_private = !!project.is_private;

    q.all([
        q.ninvoke(joi, 'validate', project, projectSchema, {
            stripUnknown: true,
            presence: 'required',
        }),
        plan ? q.ninvoke(joi, 'validate', plan, planSchema, {
            stripUnknown: true,
            presence: 'required',
        }) : q(),
        couponHash ? model.ActivationCodes.listAll({hash: couponHash}).get(0) : q()
    ]).then(function(all){
        var project = all[0];
        var plan    = all[1];
        var coupon  = all[2];

        console.log(project, plan, coupon);

        return q.all([
            model.projects.find({name:project.name}).then(function(rows){
                if(rows.length){
                    throw new APIError({nameExists:true}, 422);
                }
            }),
            model.projects.find({url:project.url}).then(function(rows){
                if(rows.length){
                    throw new APIError({urlExists:true}, 422);
                }
            })
        ]).then(function() {
            console.log('project:', project);
            // assign project_type_id to normal type
            project.project_type_id = 1;

            if(couponHash){
                if(coupon){
                    if(coupon.consumed){
                        throw new APIError("The given coupon has expired.", 424);
                    }
                    console.log(coupon);
                    project.plan = {
                        storage : coupon.payload.recordings,
                        processing : coupon.payload.processing,
                        duration_period : (coupon.payload.duration | 0) || 1,
                        tier : 'paid',
                    };

                    return model.projects.createProjectInArbimonAndCoreAPI(project, req.session.user.id, req.session.idToken)
                        .then(async function (projectId) {
                            await model.ActivationCodes.consumeCode(coupon, req.session.user.id);
                        })
                        .then(function () {
                            res.json({
                                message: util.format("Project '%s' successfully created!", project.name)
                            });
                        });

                } else {
                    throw new APIError("The given coupon does not exists.", 422);
                }
            } else {
                if(plan.tier == 'free') {
                    plan = freePlan;

                    // check if user own another free project
                    return model.users.findOwnedProjects(req.session.user.id, { free: true }).then(function(rows) {
                        if (rows.length >= req.session.user.project_limit && !req.session.user.isSuper) {
                            throw new APIError({freeProjectLimit: true}, 422);
                        }
                    }).then(function(){
                        project.plan = plan;
                        return model.projects.createProjectInArbimonAndCoreAPI(project, req.session.user.id, req.session.idToken)
                    }).then(function (projectId) {
                        res.json({
                            message: util.format("Project '%s' successfully created!", project.name)
                        });
                    });
                } else if(project.plan.tier == 'paid') {
                    // set plan cost base on selected plan minutes
                    plan.cost = plan.storage * plan.duration_period * 0.03;
                    plan.processing = plan.storage * 100;
                    plan.duration_period = plan.duration;
                    delete plan.duration;

                    console.log('plan:', plan);

                    var order = req.order = {
                        action: 'create-project',
                        planType: 'new',
                        data: {
                            plan: plan,
                            project: project
                        }
                    };

                    var addendum = {
                        recorderQty: req.body.recorderQty,
                        address: req.body.address
                    };

                    return createOrder(req.session.user, order, addendum, req.appHost).then(function(orderHandle){
                        // If we re-implement paid plans, we need to add code which will call Core API to create a project in RFCx DB
                        // (see the same comment in "/process/:orderId" endpoint below)
                        res.json(orderHandle);
                    });
                } else {
                    res.sendStatus(400);
                }
            }
        });
    }).catch(next);
});


router.post('/update-project', function(req, res, next) {
    res.type('json');
    console.log(req.body);

    var newPlan = req.body.project.plan;
    req.body.recorderQty = +req.body.recorderQty || 0;

    if(!req.haveAccess(req.body.project.project_id, "manage project billing")) {
        res.status(401).json({
            error: "you dont have permission to 'manage project billing'"
        });
        return;
    }

    model.projects.find({ id: req.body.project.project_id }).get(0).then(function(project) {
        if(!project) {
            throw new APIError({ error: 'invalid project id' }, 400);
        }

        console.log(project);
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
                throw new APIError({
                    error: (
                        "project plans can not be downgraded, "+
                        "dont try this again"
                    ),
                }, 403);
            }

            newPlan.cost = (newPlan.storage - project.storage_limit) * monthsLeft * (0.03/12);
            newPlan.tier = 'paid';
        } else {
            console.log('create new plan');
            planType = 'new';
            newPlan.cost = newPlan.storage * 0.03;
        }

        newPlan.processing = newPlan.storage * 100;
        newPlan.duration_period = newPlan.duration;
        delete newPlan.duration;

        var order = req.order = {
            action: planType + '-plan',
            planType: planType,
            data: {
                plan: newPlan,
                project_id: project.project_id,
            }
        };
        var addendum = {
            recorderQty: req.body.recorderQty,
            address: req.body.address
        };

        console.log(req.order);

        return createOrder(req.session.user, order, addendum, req.appHost).then(function(orderHandle){
            res.json(orderHandle);
        });
    }).catch(next);
});

router.post('/calculate-shipping', function(req, res, next) {
    res.type('json');
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
    res.type('json');
    res.json(countries);
});


router.param('orderId', function(req, res, next, orderId) {
    res.type('json');
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
    res.type('json');

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
                model.projects.createProjectInArbimonAndCoreAPI(req.order.data.project, req.session.user.id, req.session.idToken).nodeify(cb);
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
        // If we re-implement paid plans, we need to add code which will call Core API to create a project in RFCx DB
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
    res.type('json');
    // set order as canceled

    if(req.order.status != 'created') {
        return res.redirect('/');
    }

    model.orders.update(
        {
            order_id: req.order.order_id,
            status: 'canceled'
        },
        function(err, result) {
            if(err) return next(err);

            res.redirect('/');
        }
    );
});

module.exports = router;
