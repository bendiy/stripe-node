var JM = require('json-mapper');

/**
 * Authorize.net's JSON API works by checking the `Content-Type` header.
 * Stripe's library sets it to `application/x-www-form-urlencoded`. We override
 * that by including this header in each resource spec.
 */
var authNetHeaders = {
  'Content-Type': 'application/json'
};

var convertCardAddressToAuthNetAddress = JM.makeConverter({
  firstName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[0];
  },
  lastName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[1];
  },
  company: function (input) {
    if (!input.address_line2) {
      return;
    } else {
      return input.address_line1;
    }
  },
  address: function (input) {
    if (!input.address_line2) {
      return input.address_line1;
    } else {
      return input.address_line2;
    }
  },
  city: 'address_city',
  state: 'address_state',
  zip: 'address_zip',
  country: 'address_country',

// TODO: On `getCustomerProfileRequest` these properties are first. On `createCustomerPaymentProfileRequest` they are last. :sadface:
  // Authorize.net only fields:
  phoneNumber: 'phoneNumber',
  faxNumber: 'faxNumber'
});

var convertShippingToAuthNetAddress = JM.makeConverter({
  // Authorize.net only fields:
  faxNumber: 'faxNumber',
  phoneNumber: 'phone',
  customerAddressId: 'customerAddressId',

  firstName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[0];
  },
  lastName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[1];
  },
  company: function (input) {
    if (!input.address.line2) {
      return;
    } else {
      return input.address.line1;
    }
  },
  address: function (input) {
    if (!input.address.line2) {
      return input.address.line1;
    } else {
      return input.address.line2;
    }
  },
  city: 'address.city',
  state: 'address.state',
  zip: 'address.postal_code',
  country: 'address.country'
});

var convertChargeShippingToAuthNetAddress = JM.makeConverter({
  firstName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[0];
  },
  lastName: function (input) {
    var name = input.name ? input.name.split(' ') : [];
    return name[1];
  },
  company: function (input) {
    if (!input.address.line2) {
      return;
    } else {
      return input.address.line1;
    }
  },
  address: function (input) {
    if (!input.address.line2) {
      return input.address.line1;
    } else {
      return input.address.line2;
    }
  },
  city: 'address.city',
  state: 'address.state',
  zip: 'address.postal_code',
  country: 'address.country'
});

var convertCustomerToProfile = JM.makeConverter({
  paymentProfiles: ['sources.data', JM.map(function (input) {
    return convertSourceToPaymentProfile(input);
  })],
  shipToList: ['shipping', function (input) {
    return [convertShippingToAuthNetAddress(input)];
  }],
  customerProfileId: 'id',
  merchantCustomerId: 'metadata.merchantCustomerId',
  description: 'description',
  email: 'email'
});

var convertCustomerToCustomerProfile = JM.makeConverter({
  profile: function (input) {
    return convertCustomerToProfile(input);
  },
  subscriptionIds: ['subscriptions.data', JM.map(function (input) {
    // TODO: Should be full subscription object, not just the IDs.
    return input;
  })]
});

/**
 * Convert Authorize.net's `CustomerProfile` object to the generic `Customer` object.
 * @See: http://developer.authorize.net/api/reference/#customer-profiles-get-customer-profile
 * @See: https://stripe.com/docs/api/node#customer_object
 */
var convertCustomerProfileToCustomer = JM.makeConverter({
  id: 'profile.customerProfileId',
  object: JM.helpers.def('customer'),
  //account_balance: Not supported.
  //business_vat_id: Not supported.
  //created: Not supported.
  //currency: Not supported.
  //default_source: Not supported.
  //delinquent: Not supported.
  description: 'profile.description',
  //discount: Not supported.
  email: 'profile.email',
  metadata: {
    merchantCustomerId: 'profile.merchantCustomerId'
  },
  shipping: {
    address: {
      city: 'profile.shipToList.0.city',
      country: 'profile.shipToList.0.country',
      line1: function (input) {
        if (!input.profile.shipToList[0].company) {
          return input.profile.shipToList[0].address;
        } else {
          return input.profile.shipToList[0].company;
        }
      },
      line2: function (input) {
        if (!input.profile.shipToList[0].company) {
          return;
        } else {
          return input.profile.shipToList[0].address;
        }
      },
      postal_code: 'profile.shipToList.0.zip',
      state: 'profile.shipToList.0.state'
    },
    name: ['profile.shipToList.0', function (input) {
      return input.firstName + ' ' + input.lastName;
    }],
    phone: 'profile.shipToList.0.phoneNumber',

    // Authorize.net only fields:
    customerAddressId: 'profile.shipToList.0.customerAddressId'
  },
  sources: {
    object: JM.helpers.def('list'),
    data: ['profile.paymentProfiles', JM.map(function (input) {
      return convertPaymentProfileToSource({paymentProfile: input});
    })],
    has_more: JM.helpers.def(false),
    total_count: function (input) {
      return input.profile.paymentProfiles.length;
    },
    url: function (input) {
      return '/v1/customers/' + input.profile.customerProfileId + '/sources';
    }
  },
  subscriptions: {
    object: JM.helpers.def('list'),
    data: ['subscriptionIds', JM.map('$root')],
    has_more: JM.helpers.def(false),
    total_count: function (input) {
      return input.subscriptionIds ? input.subscriptionIds.length : 0;
    },
    url: function (input) {
      return '/v1/customers/' + input.profile.customerProfileId + '/subscriptions';
    }
  }
});

/**
 * Convert Authorize.net's `PaymentProfile` object to the generic `source` object.
 * @See: http://developer.authorize.net/api/reference/#customer-profiles-get-customer-payment-profile
 * @See: https://stripe.com/docs/api/node#card_object
 * @See: https://stripe.com/docs/api/node#customer_bank_account_object
 */
var convertPaymentProfileToSource = JM.makeConverter({
  id: 'paymentProfile.customerPaymentProfileId',
  object: function (input) {
    if (input.paymentProfile.payment.creditCard) {
      return 'card';
    } else if (input.paymentProfile.payment.bankAccount) {
      return 'bank_account';
    } else {
      return;
    }
  },
  // TODO: Bank Account address should be pushed into source.metadata.
  address_city: 'paymentProfile.billTo.city',
  address_country: 'paymentProfile.billTo.country',
  address_line1: function (input) {
    if (!input.paymentProfile.billTo.company) {
      return input.paymentProfile.billTo.address;
    } else {
      return input.paymentProfile.billTo.company;
    }
  },
  //address_line1_check: Not supported.
  address_line2: function (input) {
    if (!input.paymentProfile.billTo.company) {
      return;
    } else {
      return input.paymentProfile.billTo.address;
    }
  },
  address_state: 'paymentProfile.billTo.state',
  address_zip: 'paymentProfile.billTo.zip',
  //address_zip_check: Not supported.
  brand: function (input) {
    if (input.paymentProfile.payment.bankAccount) {
      return;
    } else {
      return 'Unknown'; // Authorize.net does not provide the card brand.
    }
  },
  country: function (input) {
    if (input.paymentProfile.payment.bankAccount) {
      return 'US'; // Authorize.net is US only.
    } else {
      return input.paymentProfile.billTo.country;
    }
  },
  //customer: Not supported.
  //cvc_check: Not supported.
  //dynamic_last4: Not supported.
  exp_month: ['paymentProfile.payment.creditCard.expirationDate', function (input) {
    if (input && input.indexOf('XXXX', input.length - 4) !== -1) {
      return 'XX'; // Masked date.
    } else if (input) {
      return parseInt(input.substr(input.length - 2)); // Get `MM` of `YYYY-MM`.
    } else {
      return;
    }
  }],
  exp_year: ['paymentProfile.payment.creditCard.expirationDate', function (input) {
    if (input && input.indexOf('XXXX', input.length - 4) !== -1) {
      return 'XXXX'; // Masked date.
    } else if (input) {
      return parseInt(input.substring(0, 4)); // Get `YYYY` of `YYYY-MM`.
    } else {
      return;
    }
  }],
  funding: function (input) {
    if (input.paymentProfile.payment.creditCard) {
      return 'credit';
    } else {
      return;
    }
  },
  last4: function (input) {
    if (input.paymentProfile.payment.creditCard && input.paymentProfile.payment.creditCard.cardNumber) {
      var cardNumber = input.paymentProfile.payment.creditCard.cardNumber;
      return cardNumber.substring(cardNumber.length - 4);
    } if (input.paymentProfile.payment.bankAccount && input.paymentProfile.payment.bankAccount.accountNumber) {
      var bankAccount = input.paymentProfile.payment.bankAccount.accountNumber;
      return bankAccount.substring(bankAccount.length - 4);
    } else {
      return;
    }
  },
  account_holder_name: 'paymentProfile.payment.bankAccount.nameOnAccount',
  account_holder_type:  function (input) {
    if (input.paymentProfile.customerType === 'business') {
      return 'company';
    } else if (input.paymentProfile.customerType) {
      return input.paymentProfile.customerType;
    } else {
      return;
    }
  },
  bank_name: 'paymentProfile.payment.bankAccount.bankName',
  currency: function (input) {
    if (input.paymentProfile.payment.bankAccount) {
      return 'USD'; // Authorize.net is USD only.
    } else {
      return;
    }
  },
  metadata: {
    accountType: 'paymentProfile.payment.bankAccount.accountType'
  },
  routing_number: ['paymentProfile.payment.bankAccount.routingNumber', function (input) {
    if (input) {
      return input.substring(input.length - 4);
    } else {
      return;
    }
  }],
  name: ['paymentProfile.billTo', function (input) {
    return input.firstName + ' ' + input.lastName;
  }],
  //tokenization_method: Not supported.

  // Authorize.net only fields:
  phoneNumber: 'paymentProfile.billTo.phoneNumber',
  faxNumber: 'paymentProfile.billTo.faxNumber'
});

/**
 * Convert the generic `source` object to Authorize.net's `PaymentProfile` object.
 * @See: http://developer.authorize.net/api/reference/#customer-profiles-get-customer-payment-profile
 * @See: https://stripe.com/docs/api/node#card_object
 * @See: https://stripe.com/docs/api/node#customer_bank_account_object
 */
var convertSourceToPaymentProfile = JM.makeConverter({
  customerType: ['account_holder_type', function (input) {
    if (input === 'company') {
      return 'business';
    } else if (input) {
      return input;
    } else {
      return;
    }
  }],
  billTo: function (input) {
    return convertCardAddressToAuthNetAddress(input);
  },
  payment: function (input) {
    var payment = {};

    if (input.object === 'card') {
      var creditCard = {
        // Handle "new" source logic where we want the full number, not masked.
        cardNumber: input.number ? input.number : 'XXXX' + input.last4,
        // TODO: Test this after disabling mask.
        expirationDate: input.exp_year + '-' + ((input.exp_month > 0 && input.exp_month < 10) ? '0' + input.exp_month : input.exp_month)
      };

      // Authorize.net only fields:
      if (input.validationMode) {
        creditCard.cardCode = input.cvc;
      }

      payment.creditCard = creditCard;
    } else if (input.object === 'bank_account') {
      var bankAccount = {
        accountType: (function () {
          if (input.metadata && input.metadata.accountType) {
            return input.metadata.accountType;
          } else {
            return;
          }
        })(),
        // Handle "new" source logic where we want the full number, not masked.
        routingNumber: input.account_number ? input.routing_number : ('XXXX' + input.routing_number),
        accountNumber: input.account_number ? input.account_number : ('XXXX' + input.last4),
        nameOnAccount: input.account_holder_name,

        // Authorize.net only fields:
        echeckType: (function () {
          // @See: https://www.authorize.net/support/CNP/helpfiles/Miscellaneous/Pop-up_Terms/ALL/eCheck.Net_Type.htm
          if (input.account_holder_type === 'individual') {
            return 'PPD';
          } else if (input.account_holder_type === 'company') {
            return 'CCD';
          } else {
            return;
          }
        })(),
        bankName: input.bank_name
      };

      payment.bankAccount = bankAccount;
    }

    return payment;
  },
  customerPaymentProfileId: 'id'
});

var convertChargeToTransactionRequest = JM.makeConverter({
  transactionType: ['capture', function (input) {
    if (input) {
      return 'authCaptureTransaction';
    } else {
      return 'authOnlyTransaction';
    }
  }],
  amount: ['amount', function (input) {
    return (input / 100).toFixed(2);
  }],
  profile: function (input) {
    var profile = {
      customerProfileId: input.customer,
      paymentProfile: {}
    };

    if (typeof input.source === 'object' && input.source.id) {
      profile.paymentProfile.paymentProfileId = input.source.id;
    } else {
      profile.paymentProfile.paymentProfileId = input.source;
    }

    if (input.source && input.source.cvc) {
      profile.paymentProfile.cardCode = input.source.cvc;
    }

    return profile;
  },
  order: 'metadata.order',
  lineItems: 'metadata.lineItems',
  tax: 'metadata.tax',
  duty: 'metadata.duty',
  shipping: 'metadata.shipping',
  taxExempt: ['metadata.taxExempt', JM.helpers.toBoolean],
  poNumber: 'metadata.poNumber',
  customer: function (input) {
    var customer = {};

    if (input.metadata && input.metadata.customer) {
      if (input.metadata.customer.type) {
        customer.type = input.metadata.customer.type;
      }
      if (input.metadata.customer.id) {
        customer.id = input.metadata.customer.id;
      }
      if (input.metadata.customer.email) {
        customer.email = input.metadata.customer.email;
      }
    }

    // If set, override customer.email.
    if (input.receipt_email) {
      customer.email = input.receipt_email;
    }

    if (customer.type || customer.id || customer.email) {
      return customer;
    } else {
      return;
    }
  },
  shipTo: ['shipping', function (input) {
    if (input) {
      return convertChargeShippingToAuthNetAddress(input);
    } else {
      return;
    }
  }],
  customerIP: 'metadata.customerIP',
  cardholderAuthentication: 'metadata.cardholderAuthentication',
  transactionSettings: 'metadata.transactionSettings',
  userFields: 'metadata.userFields',
  solution: 'metadata.solution',
});

var convertTransactionDetailToCharge = JM.makeConverter({
  id: 'transaction.transId',
  object: JM.helpers.def('charge'),
  amount: ['transaction', function (input) {
    if (input.settleAmount) {
      return input.settleAmount;
    } else {
      return input.authAmount;
    }
  }],
  amount_refunded: false,
  captured: ['transaction.transactionStatus', function (input) {
    if (input === 'settledSuccessfully') {
      return true;
    } else {
      return false;
    }
  }],
  created: ['transaction.submitTimeUTC', function (input) {
    return Math.round(+new Date(input)/1000);
  }],
  currency: JM.helpers.def('usd'),
  customer: 'transaction.customer.id',
  description: 'transaction.order.description',
  //dispute: false,
  failure_code: ['transaction.responseCode', function (input) {
    if (input === 3) {
      return input;
    } else {
      return;
    }
  }],
  failure_message: ['transaction.transactionStatus', function (input) {
    var failed = [
      'communicationError',
      'couldNotVoid',
      'declined',
      'expired',
      'failedReview',
      'generalError',
      'returnedItem',
      'settlementError',
      'voided'
    ];

    var index = failed.indexOf(input);
    if (index > -1) {
      return failed[index];
    } else {
      return;
    }
  }],
  //fraud_details: false,
  invoice: 'transaction.order.invoiceNumber',
  //livemode: false,
  metadata: false,
  //order: false,
  paid: ['transaction.transactionStatus', function (input) {
    var succeeded = [
      'authorizedPendingCapture',
      'capturedPendingSettlement',
      'refundSettledSuccessfully',
      'settledSuccessfully'
    ];

    if (succeeded.indexOf(input) > -1) {
      return true;
    } else {
      return false;
    }
  }],
  receipt_email: 'transaction.customer.email',
  receipt_number: 'transaction.transId',
  //refunded: false,
  //refunds: false,
  shipping: {
    address: {
      city: 'transaction.shipTo.city',
      country: 'transaction.shipTo.country',
      line1: function (input) {
        if (!input.transaction.shipTo.company) {
          return input.transaction.shipTo.address;
        } else {
          return input.transaction.shipTo.company;
        }
      },
      line2: function (input) {
        if (!input.transaction.shipTo.company) {
          return;
        } else {
          return input.transaction.shipTo.address;
        }
      },
      postal_code: 'transaction.shipTo.zip',
      state: 'transaction.shipTo.state'
    },
    carrier: false,
    name: ['transaction.shipTo', function (input) {
      return input.firstName + ' ' + input.lastName;
    }],
    phone: 'transaction.billTo.phoneNumber',
    tracking_number: false
  },
  source: function (input) {
    return convertPaymentProfileToSource({paymentProfile: input.transaction});
  },
  statement_descriptor: false,
  status: ['transaction.responseCode', function (input) {
    var responseCode = {
      '1': 'succeeded', // Approved
      '2': 'failed',    // Declined
      '3': 'failed',    // Error
      '4': 'pending'    // Held for Review
    }

    return responseCode[input];
  }]
});

/**
 * Reimplement the `_responseHandler()` function to handle removing the invalid
 * BOM char Authorize.net includes in their response.
 *
 * @See: http://stackoverflow.com/a/37285581/251019
 */
var _responseHandler = function _responseHandler (req, callback) {
  var self = this;
  return function(res) {
    var Error = require('../Error');
    var response = '';

    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      response += chunk;
    });
    res.on('end', function() {
      var headers = res.headers || {};

      try {
        // The response back from Authorize.net starts with an invalid BOM char.
        // We have to `trim()` it off so `JSON.parse()` will work.
        // @See: http://stackoverflow.com/a/37285581/251019
        //response = JSON.parse(response);
        response = JSON.parse(response.trim());

        // Handle network error.
        if (response.error) {
          var err;

          response.error.statusCode = res.statusCode;
          response.error.requestId = headers['request-id'];

          if (res.statusCode === 401) {
            err = new Error.StripeAuthenticationError(response.error);
          } else if (res.statusCode === 429) {
            err = new Error.StripeRateLimitError(response.error);
          } else {
            err = Error.StripeError.generate(response.error);
          }
          return callback.call(self, err, null);
        }

        // Handle Authorize.net error.
        if (response.messages && response.messages.resultCode !== 'Ok') {
          var err;

          if (!response.error) {
            response.error = {};
          }

          response.error.type = 'invalid_request_error';
          response.error.statusCode = response.messages.message[0].code;
          response.error.requestId = headers['request-id'];
          response.error.message = response.messages.message[0].text;

          err = Error.StripeError.generate(response.error);

          return callback.call(self, err, null);
        }
        if (response.transactionResponse && response.transactionResponse.errors && response.transactionResponse.errors.length > 0) {
          var err;

          if (!response.error) {
            response.error = {};
          }

          response.error.type = 'invalid_request_error';
          response.error.statusCode = response.transactionResponse.errors[0].errorCode;
          response.error.requestId = headers['request-id'];
          response.error.message = response.transactionResponse.errors[0].errorText;

          err = Error.StripeError.generate(response.error);

          return callback.call(self, err, null);
        }
      } catch (e) {
        // TODO: Our re-implementation of `_responseHandler` needs the `StripeAPIError` added.
        return callback.call(
          self,
          new Error.StripeAPIError({
            message: 'Invalid JSON received from the Stripe API',
            response: response,
            exception: e,
            requestId: headers['request-id'],
          }),
          null
        );
      }
      // Expose res object
      Object.defineProperty(response, 'lastResponse', {
        enumerable: false,
        writable: false,
        value: res,
      });
      callback.call(self, null, response);
    });
  };
};

module.exports = {
  authNetHeaders: authNetHeaders,
  convertCardAddressToAuthNetAddress: convertCardAddressToAuthNetAddress,
  convertShippingToAuthNetAddress: convertShippingToAuthNetAddress,
  convertChargeShippingToAuthNetAddress: convertChargeShippingToAuthNetAddress,
  convertChargeToTransactionRequest: convertChargeToTransactionRequest,
  convertCustomerToProfile: convertCustomerToProfile,
  convertCustomerProfileToCustomer: convertCustomerProfileToCustomer,
  convertCustomerToCustomerProfile: convertCustomerToCustomerProfile,
  convertPaymentProfileToSource: convertPaymentProfileToSource,
  convertSourceToPaymentProfile: convertSourceToPaymentProfile,
  convertTransactionDetailToCharge: convertTransactionDetailToCharge,
  _responseHandler: _responseHandler
};
