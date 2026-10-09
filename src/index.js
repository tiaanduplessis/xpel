export default function (subs = {}) {
  subs['*'] = []
  return (name, ...handler) => {
    if (handler.length === 1 && typeof handler[0] === 'function') {
      subs[name] = subs[name] ? subs[name].concat(handler) : (subs[name] = []).concat(handler)
      return name => name && (subs[name] = [])
    }

    if (name !== '*') {
      const listeners = subs[name]
      if (listeners !== undefined) listeners.map(f => f(...handler))
    }
    subs['*'].map(f => f(...handler))
    return this
  }
}
