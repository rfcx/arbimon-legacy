/* jshint node:true */
"use strict";

var uuid = require('node-uuid');
var sprintf = require("sprintf-js").sprintf;

var shippingCalculator = require('./shipping-calculator.js');

var info = {
    recorder: {
        name: 'Arbimon Recorder',
        description: (
            "includes an Android device preset for acoustic monitoring, "+
            "waterproof case(IP67), microphone, 6500mAh lithium-ion battery "+
            "and USB charger"
        ),
        priceWithPlan: 125,
        priceNoPlan: 300
    },
    plan: {
        new: {
            name: "Project data plan",
            description: (
                "includes storage for %(storage)d minutes of audio "+
                "and capacity to process %(processing)d minutes of audio "+
                "per year, for a term of %(duration_period)d year(s)"
            )
        },
        upgrade: {
            name: "Project data plan upgrade",
            description: (
                "upgrade your plan storage to %(storage)d minutes of audio "+
                "and capacity to process %(processing)d minutes of audio "+
                "per year, until this plan due"
            )
        }
    },
};

module.exports = {
    /**
        receives a plan activation date and duration period, and calculates 
        how many month are left until the plan is due
        @param [Date] activationDate
        @param [Number] period
    */
    monthsUntilDue: function(activationDate, period) {
        var d = new Date(activationDate);
        var totalMonths = period*12;
        var today = new Date();
        var currentMonth;
        
        for(var i=0; i <= totalMonths; i++) {
            var month = new Date(d.getFullYear(), d.getMonth()+i, d.getDate());
            if(today <= month) {
                currentMonth = i-1;
                break;
            }
        }

        return totalMonths-currentMonth;
    },
    
    
    createPayment: function(paymentData) {
        // TODO calculate tax!!!
        
        var type = paymentData.planType;
        
        var projectPayment = {
            intent: "sale",
            payer: {
                payment_method: "paypal"
            },
            redirect_urls: paymentData.redirect_urls,
            transactions: [{
                amount: {
                    currency: "USD",
                    details: {}
                },
                item_list: {
                    items: [{
                        quantity: 1,
                        price: paymentData.plan.cost,
                        currency: "USD",
                        tax: 0,
                        name: info.plan[type].name,
                        description: sprintf(info.plan[type].description, paymentData.plan),
                    }]
                }
            }]
        };
        
        var subtotal = 0, 
            tax = 0,
            total = 0,
            shippingCost = 0;
        
        if(paymentData.recorderQty) {
            var recorderInfo = {
                price: info.recorder.priceWithPlan,
                currency: "USD",
                tax: 0, // tax in dollars
                name: info.recorder.name,
                description: info.recorder.description,
                quantity: paymentData.recorderQty
            };
            
            var result = shippingCalculator(paymentData.shippingAddress, paymentData.recorderQty);
            
            if(result.error) {
                return result.error;
            }
            else {
                shippingCost = result.cost;
            }
            
            // updates item list to add recorders
            var itemList = projectPayment.transactions[0].item_list;
            itemList.items.push(recorderInfo);
            
            // add shipping_address
            itemList.shipping_address = {
                recipient_name: paymentData.shippingAddress.name,
                line1: paymentData.shippingAddress.line1,
                line2: paymentData.shippingAddress.line2,
                city: paymentData.shippingAddress.city,
                state: paymentData.shippingAddress.state,
                country_code: paymentData.shippingAddress.country_code,
                postal_code: paymentData.shippingAddress.postal_code,
                phone: paymentData.shippingAddress.telephone,
            };
        }
        
        projectPayment.transactions[0].item_list.items.forEach(function(item) {
            subtotal += (item.price * item.quantity);
            tax += (item.tax * item.quantity);
        });
        
        total = subtotal + tax;
        
        projectPayment.transactions[0].amount.details.shipping = shippingCost;
        projectPayment.transactions[0].amount.details.subtotal = subtotal;
        projectPayment.transactions[0].amount.details.tax = tax;
        projectPayment.transactions[0].amount.total = total + shippingCost;
        
        
        return projectPayment;
    },
};
