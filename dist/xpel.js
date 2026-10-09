(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.xpel = factory());
})(this, (function () { 'use strict';

  function index (subs) {
    var _this = this;
    if (subs === void 0) {
      subs = {};
    }
    subs['*'] = [];
    return function (name) {
      for (var _len = arguments.length, handler = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        handler[_key - 1] = arguments[_key];
      }
      if (handler.length === 1 && typeof handler[0] === 'function') {
        subs[name] = subs[name] ? subs[name].concat(handler) : (subs[name] = []).concat(handler);
        return function (name) {
          return name && (subs[name] = []);
        };
      }
      if (name !== '*') {
        var listeners = subs[name];
        if (listeners !== undefined) listeners.map(function (f) {
          return f.apply(void 0, handler);
        });
      }
      subs['*'].map(function (f) {
        return f.apply(void 0, handler);
      });
      return _this;
    };
  }

  return index;

}));
