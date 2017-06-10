export default function (subs = {}) {
  subs['*'] = []
  return (name, ...handler) => {
    if (handler.length === 1 && typeof handler[0] === 'function') {
      subs[name] = subs[name] ? subs[name].concat(handler) : (subs[name] = []).concat(handler)
      return name => name && (subs[name] = [])
    }

    name !== '*' && subs[name].map(f => f(...handler))
    subs['*'].map(f => f(...handler))
    return this
  }
}
