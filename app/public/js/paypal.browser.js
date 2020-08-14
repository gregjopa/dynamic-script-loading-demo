/*!
 * paypal-js v0.1.0 (2020-08-14T14:08:25.396Z)
 * Copyright 2020-present, PayPal, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var paypalLoadScript = (function (exports) {
  'use strict';

  /**
   * @this {Promise}
   */
  function finallyConstructor(callback) {
    var constructor = this.constructor;
    return this.then(
      function(value) {
        // @ts-ignore
        return constructor.resolve(callback()).then(function() {
          return value;
        });
      },
      function(reason) {
        // @ts-ignore
        return constructor.resolve(callback()).then(function() {
          // @ts-ignore
          return constructor.reject(reason);
        });
      }
    );
  }

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function isArray(x) {
    return Boolean(x && typeof x.length !== 'undefined');
  }

  function noop() {}

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function() {
      fn.apply(thisArg, arguments);
    };
  }

  /**
   * @constructor
   * @param {Function} fn
   */
  function Promise(fn) {
    if (!(this instanceof Promise))
      throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    /** @type {!number} */
    this._state = 0;
    /** @type {!boolean} */
    this._handled = false;
    /** @type {Promise|undefined} */
    this._value = undefined;
    /** @type {!Array<!Function>} */
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function() {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self)
        throw new TypeError('A promise cannot be resolved with itself.');
      if (
        newValue &&
        (typeof newValue === 'object' || typeof newValue === 'function')
      ) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  /**
   * @constructor
   */
  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(
        function(value) {
          if (done) return;
          done = true;
          resolve(self, value);
        },
        function(reason) {
          if (done) return;
          done = true;
          reject(self, reason);
        }
      );
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function(onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function(onFulfilled, onRejected) {
    // @ts-ignore
    var prom = new this.constructor(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.prototype['finally'] = finallyConstructor;

  Promise.all = function(arr) {
    return new Promise(function(resolve, reject) {
      if (!isArray(arr)) {
        return reject(new TypeError('Promise.all accepts an array'));
      }

      var args = Array.prototype.slice.call(arr);
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(
                val,
                function(val) {
                  res(i, val);
                },
                reject
              );
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function(value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function(resolve) {
      resolve(value);
    });
  };

  Promise.reject = function(value) {
    return new Promise(function(resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function(arr) {
    return new Promise(function(resolve, reject) {
      if (!isArray(arr)) {
        return reject(new TypeError('Promise.race accepts an array'));
      }

      for (var i = 0, len = arr.length; i < len; i++) {
        Promise.resolve(arr[i]).then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn =
    // @ts-ignore
    (typeof setImmediate === 'function' &&
      function(fn) {
        // @ts-ignore
        setImmediate(fn);
      }) ||
    function(fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  function loadError() {
    throw new Error("The script \"".concat(this.src, "\" didn't load correctly."));
  }

  function findScript(url) {
    return document.querySelector("script[src=\"".concat(url, "\"]"));
  }
  function insertScriptElement(_ref) {
    var _scriptAttributes$asy, _scriptAttributes$def;

    var url = _ref.url,
        _ref$dataAttributes = _ref.dataAttributes,
        dataAttributes = _ref$dataAttributes === void 0 ? {} : _ref$dataAttributes,
        _ref$scriptAttributes = _ref.scriptAttributes,
        scriptAttributes = _ref$scriptAttributes === void 0 ? {} : _ref$scriptAttributes,
        callback = _ref.callback;
    var newScript = document.createElement('script');
    newScript.onerror = loadError;
    if (callback) newScript.onload = callback;
    forEachObjectKey(dataAttributes, function (key) {
      newScript.setAttribute(key, dataAttributes[key]);
    });
    document.head.insertBefore(newScript, document.head.firstElementChild);
    newScript.src = url;
    newScript.async = (_scriptAttributes$asy = scriptAttributes.async) !== null && _scriptAttributes$asy !== void 0 ? _scriptAttributes$asy : false;
    newScript.defer = (_scriptAttributes$def = scriptAttributes.defer) !== null && _scriptAttributes$def !== void 0 ? _scriptAttributes$def : true;
  }
  function processOptions() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var processedOptions = {
      queryParams: {},
      dataAttributes: {},
      scriptAttributes: {}
    };
    forEachObjectKey(options, function (key) {
      if (key.substring(0, 5) === 'data-') {
        processedOptions.dataAttributes[key] = options[key];
      } else if (key === 'defer' || key === 'async') {
        processedOptions.scriptAttributes[key] = options[key];
      } else {
        processedOptions.queryParams[key] = options[key];
      }
    });
    var queryParams = processedOptions.queryParams,
        dataAttributes = processedOptions.dataAttributes,
        scriptAttributes = processedOptions.scriptAttributes;
    return {
      queryString: objectToQueryString(queryParams),
      dataAttributes: dataAttributes,
      scriptAttributes: scriptAttributes
    };
  }
  function objectToQueryString(params) {
    var queryString = '';
    forEachObjectKey(params, function (key) {
      if (queryString.length !== 0) queryString += '&';
      queryString += key + '=' + params[key];
    });
    return queryString;
  } // uses es3 to avoid requiring polyfills for Array.prototype.forEach and Object.keys

  function forEachObjectKey(obj, callback) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        callback(key);
      }
    }
  }

  var SDK_BASE_URL = 'https://www.paypal.com/sdk/js';
  var loadingPromise;
  var isLoading = false;
  function loadScript(options) {
    // resolve with the existing promise when the script is loading
    if (isLoading) return loadingPromise;
    return loadingPromise = new Promise(function (resolve, reject) {
      // resolve with null when running in Node
      if (typeof window === 'undefined') return resolve(null);

      var _processOptions = processOptions(options),
          queryString = _processOptions.queryString,
          dataAttributes = _processOptions.dataAttributes,
          scriptAttributes = _processOptions.scriptAttributes;

      var url = "".concat(SDK_BASE_URL, "?").concat(queryString); // resolve with the existing global paypal object when a script with the same src already exists

      if (findScript(url) && window.paypal) return resolve(window.paypal);
      isLoading = true;
      insertScriptElement({
        url: url,
        dataAttributes: dataAttributes,
        scriptAttributes: scriptAttributes,
        callback: function callback() {
          isLoading = false;
          if (window.paypal) return resolve(window.paypal);
          return reject(new Error('The window.paypal global variable is not available.'));
        }
      });
    });
  } // replaced with the package.json version at build time

  var version = '0.1.0';

  exports.loadScript = loadScript;
  exports.version = version;

  return exports;

}({}));
paypalLoadScript = paypalLoadScript.loadScript;
