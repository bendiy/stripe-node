'use strict';

var StripeResource = require('../StripeResource');
var stripeMethod = StripeResource.method;
var utils = require('../utils');

var authnetUtils = require('./authnet-utils');

module.exports = StripeResource.extend({

  overrideHost: 'apitest.authorize.net',

  requestDataProcessor: function(method, data, headers) {
    data = data || {};
console.log("request: ", JSON.stringify(data, null, 2));
    return JSON.stringify(data);
  },

  _responseHandler: authnetUtils._responseHandler,

  create: function (charge) {
    var requestDefault = {
      "createTransactionRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof charge === 'object') {
      // Combine passed in `charge` with `requestDefault`.
      requestDefault.createTransactionRequest.transactionRequest = authnetUtils.convertChargeToTransactionRequest(charge);

      // Remove `charge` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Error handling.
        console.log("create response:", JSON.stringify(response, null, 2));

        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  list: function (filter) {
    // TODO: Authorize.net's Transaction Reporting does not have any filtering
    // support. You can only list ALL Unsettled Transactions or list Settled
    // Transactions by batchid, which is ALL Settled Transactions for a single
    // day. To emulate the Stripe API, we have to support transaction history
    // by keeping a local copy of each `transId` and associate that with
    // customer, date, status, etc.

    // TODO: Add local database storage support for this.

    // Filters to support: created, customer, source(source = 'card')

  },

  retrieve: function (chargeId) {
    var requestDefault = {
      "getTransactionDetailsRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof chargeId === 'string') {
      // Combine passed in `chargeId` with `requestDefault`.
      requestDefault.getTransactionDetailsRequest.transId = chargeId;

      // Remove `chargeId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        response = authnetUtils.convertTransactionDetailToCharge(response);
        return response;
      }
    }).apply(this, arguments);
  },

  capture: function (chargeId, capture) {
    var requestDefault = {
      "createTransactionRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof chargeId === 'string' && typeof capture === 'object') {
      // Combine passed in `chargeId` with `requestDefault`.
      requestDefault.createTransactionRequest.transactionRequest = {
        transactionType: 'priorAuthCaptureTransaction',
// TODO: Move to helper function.
        amount: (capture.amount / 100).toFixed(2),
        refTransId: chargeId
      };

      // TODO: There's a bug in Authorize.net's API that hasn't been fixed in 5+ years...
      // @See: https://community.developer.authorize.net/t5/Integration-and-Testing/Invoice-Number-from-CIM-and-Order/m-p/11744
      /*
      if (capture.metadata && capture.metadata.order) {
        requestDefault.createTransactionRequest.transactionRequest.order = {};
        if (capture.metadata.order.invoiceNumber) {
          requestDefault.createTransactionRequest.transactionRequest.order.invoiceNumber = capture.metadata.order.invoiceNumber;
        }
        if (capture.metadata.order.description) {
          requestDefault.createTransactionRequest.transactionRequest.order.description = capture.metadata.order.description;
        }
      }
      */

      // Remove `chargeId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
      // Remove `capture` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Error handling.
        console.log("capture response:", JSON.stringify(response, null, 2));

        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  refund: function (chargeId, refund) {
    // TODO: Split the three different paths here into private methods.

    // Stripe uses `refund` to credit customers back for Settled Transactions
    // AND to void Unsettled Transactions based on the Transactions status.
    // To void an Unsettled Transaction, the full amount is refunded.

    var self = this;
    var selfArgs = arguments;

    var requestDefault = {
      "createTransactionRequest": {
        "merchantAuthentication": self._stripe.getApiField('merchantAuthentication')
      }
    };

    if (!chargeId && refund.metadata && refund.metadata.number && refund.metadata.exp_month && refund.metadata.exp_year) {
      // TODO: Authorize.net says that passing a paymentProfileId is
      // deprecated, but it's the only way to credit a card without a TransId
      // when using Card on File. Support it here and hope they don't turn it off.

// TODO: Move to helper function.
      var expirationDate = refund.metadata.exp_year + '-' + ((refund.metadata.exp_month > 0 && refund.metadata.exp_month < 10) ? '0' + refund.metadata.exp_month : refund.metadata.exp_month);
      // if settled, call refund for the amount.
      requestDefault.createTransactionRequest.transactionRequest = {
        transactionType: 'refundTransaction',
// TODO: Move to helper function.
        amount: (refund.amount / 100).toFixed(2),
        payment: {
          creditCard: {
            cardNumber: refund.metadata.number,
            expirationDate: expirationDate
          }
        },
        refTransId: chargeId
      };

      // Remove `chargeId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(selfArgs);
      // Remove `refund` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(selfArgs);

      Array.prototype.unshift.call(selfArgs, requestDefault);

      return stripeMethod({
        method: 'POST',
        headers: authnetUtils.authNetHeaders,
        transformResponseData: function (response) {
          // TODO: Error handling.
          console.log("refund response:", JSON.stringify(response, null, 2));

          // TODO: Manipulate the `response` object if need be.
          return response;
        }
      }).apply(self, selfArgs);
    } else if (chargeId) {
      return self.retrieve(chargeId).then(function(charge){
  console.log("refund charge:", JSON.stringify(charge, null, 2));

        // check for settled status
        if (!charge.captured) {
          // if pending, call void for the full transaction
          requestDefault.createTransactionRequest.transactionRequest = {
            transactionType: 'voidTransaction',
            refTransId: chargeId
          };

        } else if (typeof chargeId === 'string') {
          // if settled, call refund for the amount.
          requestDefault.createTransactionRequest.transactionRequest = {
            transactionType: 'refundTransaction',
  // TODO: Move to helper function.
            amount: (refund.amount / 100).toFixed(2),
            payment: {
              creditCard: {
                cardNumber: charge.source.last4,
                expirationDate: 'XXXX' // Authorize.net requires setting this property to `XXXX`.
              }
            },
            refTransId: chargeId
          };
        }

        if (typeof chargeId === 'string') {
          // Remove `chargeId` argument as stripeMethod would complain of unexpected argument.
          Array.prototype.shift.apply(selfArgs);
        }
        if (typeof refund === 'object') {
          // Remove `refund` argument as stripeMethod would complain of unexpected argument.
          Array.prototype.shift.apply(selfArgs);
        }

        Array.prototype.unshift.call(selfArgs, requestDefault);

        return stripeMethod({
          method: 'POST',
          headers: authnetUtils.authNetHeaders,
          transformResponseData: function (response) {
  // TODO: Authorize.net has no way to list refunds applied to transactions, only
  // the transaction a refund applies to. Therefore, we must store refund history
  // next to the transaction history so we can show how much of a refund has been
  // applied to a transaction.
  // TODO: Write this refund response to our database.

            // TODO: Error handling.
            console.log("refund response:", JSON.stringify(response, null, 2));

            // TODO: Manipulate the `response` object if need be.
            return response;
          }
        }).apply(self, selfArgs);
      });
// TODO: Qt script doesn't support catch.
      //.catch(function (err) {
      //  console.log("refund error: ", JSON.stringify(err, null, 2));
      //});
    } else {
      // TODO: invalide call. throw error.
    }
  },

});
