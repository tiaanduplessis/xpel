(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.xpel = factory());
}(this, (function () { 'use strict';

var index = function (subs) {
  var this$1 = this;
  if ( subs === void 0 ) subs = {};

  subs['*'] = [];
  return function (name) {
    var handler = [], len = arguments.length - 1;
    while ( len-- > 0 ) handler[ len ] = arguments[ len + 1 ];

    if (handler.length === 1 && typeof handler[0] === 'function') {
      subs[name] = subs[name] ? subs[name].concat(handler) : (subs[name] = []).concat(handler);
      return function (name) { return name && (subs[name] = []); }
    }

    name !== '*' && subs[name].map(function (f) { return f.apply(void 0, handler); });
    subs['*'].map(function (f) { return f.apply(void 0, handler); });
    return this$1
  }
};

return index;

})));
