'use strict';
/**
 * Notes:
 * - Authorize.net does not return a "Card Type".
 * @See: https://community.developer.authorize.net/t5/Integration-and-Testing/Retrieve-Credit-Card-Type-of-Payment-Profile-using-CIM/td-p/4585
 *
 * - Authorize.net masks the `expirationDate` date on all API endpoints other
 *   than `getCustomerPaymentProfileRequest`. To show this date, we have to loop
 *   over the card list and request each `PaymentProfile` seperately.
 * @See: https://community.developer.authorize.net/t5/Ideas/UnMasked-Expiration-Date-in-Hosted-CIM-s/idc-p/50833
 * @See: https://community.developer.authorize.net/t5/The-Authorize-Net-Developer-Blog/Notifying-Users-Their-Credit-Card-Is-About-to-Expire-Without-PCI/ba-p/8025
 * @See: https://community.developer.authorize.net/t5/Integration-and-Testing/CIM-API-Credit-Card-Expiration-Dates/td-p/10504
 */

Stripe.DEFAULT_HOST = 'apitest.authorize.net';
Stripe.DEFAULT_PORT = '443';
Stripe.DEFAULT_BASE_PATH = '/xml/v1/request.api';
Stripe.DEFAULT_API_VERSION = null;

// Use node's default timeout:
Stripe.DEFAULT_TIMEOUT = require('http').createServer().timeout;

Stripe.PACKAGE_VERSION = require('../package.json').version;

Stripe.USER_AGENT = {
  bindings_version: Stripe.PACKAGE_VERSION,
  lang: 'node',
  lang_version: process.version,
  platform: process.platform,
  publisher: 'stripe',
  uname: null,
};

Stripe.USER_AGENT_SERIALIZED = 'xTuple ERP';

//var exec = require('child_process').exec;

var resources = {
  Charges: require('./authnet-resources/Charges'),
  Customers: require('./authnet-resources/Customers')
};

Stripe.StripeResource = require('./StripeResource');
Stripe.resources = resources;

function Stripe(key, version) {
  if (!(this instanceof Stripe)) {
    return new Stripe(key, version);
  }

  this._api = {
    auth: null,
    host: Stripe.DEFAULT_HOST,
    port: Stripe.DEFAULT_PORT,
    basePath: Stripe.DEFAULT_BASE_PATH,
    version: Stripe.DEFAULT_API_VERSION,
    timeout: Stripe.DEFAULT_TIMEOUT,
    agent: null,
    dev: false,
  };

  this._prepResources();
  this.setApiKey(key);
  this.setApiVersion(version);
}

Stripe.prototype = {

  setHost: function(host, port, protocol) {
    this._setApiField('host', host);
    if (port) {
      this.setPort(port);
    }
    if (protocol) {
      this.setProtocol(protocol);
    }
  },

  setProtocol: function(protocol) {
    this._setApiField('protocol', protocol.toLowerCase());
  },

  setPort: function(port) {
    this._setApiField('port', port);
  },

  setApiVersion: function(version) {
    if (version) {
      this._setApiField('version', version);
    }
  },

  setApiKey: function(authentication) {
    if (authentication && authentication.name && authentication.transactionKey) {
      this._setApiField(
        'merchantAuthentication',
        authentication
      );
    }
  },

  setTimeout: function(timeout) {
    this._setApiField(
      'timeout',
      timeout == null ? Stripe.DEFAULT_TIMEOUT : timeout
    );
  },

  setHttpAgent: function(agent) {
    this._setApiField('agent', agent);
  },

  _setApiField: function(key, value) {
    this._api[key] = value;
  },

  getApiField: function(key) {
    return this._api[key];
  },

  getConstant: function(c) {
    return Stripe[c];
  },

  getClientUserAgent: function(cb) {
    if (Stripe.USER_AGENT_SERIALIZED) {
      return cb(Stripe.USER_AGENT_SERIALIZED);
    }
    exec('uname -a', function(err, uname) {
      Stripe.USER_AGENT.uname = uname || 'UNKNOWN';
      Stripe.USER_AGENT_SERIALIZED = JSON.stringify(Stripe.USER_AGENT);
      cb(Stripe.USER_AGENT_SERIALIZED);
    });
  },

  _prepResources: function() {
    for (var name in resources) {
      this[
        name[0].toLowerCase() + name.substring(1)
      ] = new resources[name](this);
    }
  },

};

module.exports = Stripe;
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Stripe = Stripe;
