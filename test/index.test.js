import xpel from '../src'

test('should be defined', () => {
  expect(xpel).toBeDefined()
  expect(typeof xpel).toBe('function')
})

test('should emit and subscribe', () => {
  const emitter = xpel()
  const mock = jest.fn()

  emitter('event', mock)
  emitter('event')

  expect(mock).toBeCalled()
})

test('should return unsubscribe function', () => {
  const emitter = xpel()
  const mock = jest.fn()

  const unsub = emitter('event', mock)
  unsub()

  expect(typeof unsub).toBe('function')
  expect(mock).not.toBeCalled()
})
