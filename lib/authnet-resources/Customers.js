'use strict';

var StripeResource = require('../StripeResource');
var stripeMethod = StripeResource.method;
var utils = require('../utils');

var authnetUtils = require('./authnet-utils');

module.exports = StripeResource.extend({

  overrideHost: 'apitest.authorize.net',

  requestDataProcessor: function(method, data, headers) {
    data = data || {};

    return JSON.stringify(data);
  },

  _responseHandler: authnetUtils._responseHandler,

  create: function(customer) {
    var requestDefault = {
      "createCustomerProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customer === 'object') {
      // Combine passed in `customer` with `requestDefault`.
      requestDefault.createCustomerProfileRequest.profile = authnetUtils.convertCustomerToProfile(customer);

      // Remove `customer` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  // Avoid 'delete' keyword in JS
  del: function(customerProfileId) {
    var requestDefault = {
      "deleteCustomerProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerProfileId === 'string') {
      // Combine passed in `customerProfileId` with `requestDefault`.
      requestDefault.deleteCustomerProfileRequest.customerProfileId = customerProfileId;

      // Remove `customerProfileId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  list: function() {
    var self = this;
    var requestDefault = {
      "getCustomerProfileIdsRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    // TODO: There may be a better way to handle this with the returned Promise.
    /*
     * Authorize.net's API only supports an Id list. Stash the callback argument,
     * loop over the ids and retrieve each CustomerProfile, add each customer
     * to the response and then call the callback argument with the full results.
     */
    var next = arguments[0];
    var processIds = function (err, ids) {
      var listResponse = {
        "object": "list",
        "has_more": false,
        "count": 0,
        "data": []
      };
      ids.forEach(function (currentValue) {
        self.retrieve(currentValue, function (err, customer) {
          // TODO: Error handling.
          console.log("error:", err);
          console.log("customer:", customer);
          listResponse.data.push(customer);
          listResponse.count += 1;

          if (listResponse.count === ids.length) {
            next(false, listResponse);
          }
        });
      });
    };
    // Remove the callback argument.
    Array.prototype.shift.apply(arguments);
    // Add `processIds` as the callback, which wraps the original callback.
    Array.prototype.unshift.call(arguments, processIds);

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (customers) {
        return customers.ids || [];
      }
    }).apply(this, arguments);
  },

  retrieve: function(customerProfileId) {
    var requestDefault = {
      "getCustomerProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerProfileId === 'string') {
      // Combine passed in `customerProfileId` with `requestDefault`.
      requestDefault.getCustomerProfileRequest.customerProfileId = customerProfileId;

      // Remove `customerProfileId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);
// TODO: Loop over subscriptions if they exist and request each one.
// TODO: There may be a better way to handle this with the returned Promise.
    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        response = authnetUtils.convertCustomerProfileToCustomer(response);
        return response;
      }
    }).apply(this, arguments);
  },

  update: function(customer) {
    var requestDefault = {
      "updateCustomerProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customer === 'object') {
      // Combine passed in `customer` with `requestDefault`.
      var profile = authnetUtils.convertCustomerToProfile(customer);
      // TODO: Make seperate call to update these?
      delete profile.paymentProfiles;
      delete profile.shipToList;
      requestDefault.updateCustomerProfileRequest.profile = profile;

      // Remove `customer` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  /**
   * Customer: Source methods
   */

  createSource: function(customerProfileId, source) {
    var requestDefault = {
      "createCustomerPaymentProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerProfileId === 'string' && typeof source === 'object') {
      requestDefault.createCustomerPaymentProfileRequest.customerProfileId = customerProfileId;

      requestDefault.createCustomerPaymentProfileRequest.paymentProfile = authnetUtils.convertSourceToPaymentProfile(source);
      requestDefault.createCustomerPaymentProfileRequest.validationMode = source.validationMode || 'none';

      // Remove `customerProfileId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);

      // Remove `source` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  listSources: function (customerProfileId) {
    /*
     * Authorize.net's API does not support `listSources` directly. Instead, we
     * retrieve the customer and return only it's sources.
     */
    var next = arguments[1];
    var processCustomer = function (err, customer) {
      var listResponse = {
        "object": "list",
        "url": "/v1/customers/" + customerProfileId + "/sources",
        "has_more": false,
        "count": 0,
        "data": []
      };
      customer.sources.data.forEach(function (source) {
        listResponse.data.push(source);
        listResponse.count += 1;

        if (listResponse.count === customer.sources.data.length) {
          next(false, listResponse);
        }
      });
    };

    // TODO: There may be a better way to handle the callback with the returned Promise.
    return this.retrieve(customerProfileId, processCustomer);
  },

  retrieveSource: function (customerId, sourceId) {
    var requestDefault = {
      "getCustomerPaymentProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerId === 'string' && typeof sourceId === 'string') {
      // Combine passed in `customerId` and `sourceId` with `requestDefault`.
      requestDefault.getCustomerPaymentProfileRequest.customerProfileId = customerId;
      requestDefault.getCustomerPaymentProfileRequest.customerPaymentProfileId = sourceId;

      // Remove `customerId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
      // Remove `sourceId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);

      requestDefault.getCustomerPaymentProfileRequest.unmaskExpirationDate = true;
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        response = authnetUtils.convertPaymentProfileToSource(response);
        return response;
      }
    }).apply(this, arguments);
  },

  updateSource: function (customerId, sourceId, source) {
    var requestDefault = {
      "updateCustomerPaymentProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerId === 'string' && typeof sourceId === 'string' && typeof source === 'object') {
      // Combine passed in `customerId` with `requestDefault`.
      requestDefault.updateCustomerPaymentProfileRequest.customerProfileId = customerId;

      // Combine passed in `source` with `requestDefault`.
      requestDefault.updateCustomerPaymentProfileRequest.paymentProfile = authnetUtils.convertSourceToPaymentProfile(source);

      // Remove `customerId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);

      // Remove `sourceId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);

      // Remove `source` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);

      requestDefault.updateCustomerPaymentProfileRequest.validationMode = 'none';
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Error handling.
        if (response.messages && response.messages.resultCode && response.messages.resultCode !== "Ok") {
          console.log("response:", JSON.stringify(response, null, 2));
          return new Error("updateSource error");
        } else {
          return response;
        }
      }
    }).apply(this, arguments);
  },

  deleteSource: function(customerId, sourceId) {
    var requestDefault = {
      "deleteCustomerPaymentProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerId === 'string' && typeof sourceId === 'string') {
      // Combine passed in `customerId` with `requestDefault`.
      requestDefault.deleteCustomerPaymentProfileRequest.customerProfileId = customerId;
      requestDefault.deleteCustomerPaymentProfileRequest.customerPaymentProfileId = sourceId;

      // Remove `customerId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
      // Remove `sourceId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Error handling.
        console.log("deleteSource response:", JSON.stringify(response, null, 2));

        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  },

  verifySource: function(customerId, sourceId, source) {
    var requestDefault = {
      "validateCustomerPaymentProfileRequest": {
        "merchantAuthentication": this._stripe.getApiField('merchantAuthentication')
      }
    };

    if (typeof customerId === 'string' && typeof sourceId === 'string') {
      // Combine passed in `customerId` with `requestDefault`.
      requestDefault.validateCustomerPaymentProfileRequest.customerProfileId = customerId;
      requestDefault.validateCustomerPaymentProfileRequest.customerPaymentProfileId = sourceId;

      // Remove `customerId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
      // Remove `sourceId` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    }

    if (typeof source === 'object') {
      if (source.cvc) {
        requestDefault.validateCustomerPaymentProfileRequest.cardCode = source.cvc;
      }

      requestDefault.validateCustomerPaymentProfileRequest.validationMode = source.validationMode || 'testMode';

      // Remove `source` argument as stripeMethod would complain of unexpected argument.
      Array.prototype.shift.apply(arguments);
    } else {
      requestDefault.validateCustomerPaymentProfileRequest.validationMode = 'testMode';
    }

    Array.prototype.unshift.call(arguments, requestDefault);

    return stripeMethod({
      method: 'POST',
      headers: authnetUtils.authNetHeaders,
      transformResponseData: function (response) {
        // TODO: Error handling.
        console.log("verifySource response:", JSON.stringify(response, null, 2));

        // TODO: Manipulate the `response` object if need be.
        return response;
      }
    }).apply(this, arguments);
  }


  /**
   * Customer: Subscription methods
   */
// TODO:
/*
  createSubscription: stripeMethod({
    method: 'POST',
    path: '/{customerId}/subscriptions',
    urlParams: ['customerId'],
  }),

  listSubscriptions: stripeMethod({
    method: 'GET',
    path: '/{customerId}/subscriptions',
    urlParams: ['customerId'],
  }),

  retrieveSubscription: stripeMethod({
    method: 'GET',
    path: '/{customerId}/subscriptions/{subscriptionId}',
    urlParams: ['customerId', 'subscriptionId'],
  }),

  updateSubscription: function(customerId, subscriptionId) {
    if (typeof subscriptionId == 'string') {
      return this._newstyleUpdateSubscription.apply(this, arguments);
    } else {
      return this._legacyUpdateSubscription.apply(this, arguments);
    }
  },

  cancelSubscription: function(customerId, subscriptionId) {
    // This is a hack, but it lets us maximize our overloading.
    // Precarious assumption: If it's not an auth key it _could_ be a sub id:
    if (typeof subscriptionId == 'string' && !utils.isAuthKey(subscriptionId)) {
      return this._newstyleCancelSubscription.apply(this, arguments);
    } else {
      return this._legacyCancelSubscription.apply(this, arguments);
    }
  }
*/

});
