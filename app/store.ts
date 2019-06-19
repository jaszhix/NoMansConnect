import {clone, intersection as intersect, difference} from 'lodash';
import {find, findIndex, filter} from './lang';
import log from './log';



function storeError(method: string, key: string, message: string): void {
  log.error('Warning: [store -> ' + method + ' -> ' + key + '] ' + message);
}

function getByPath(key: string, object: State): State {
  const path = key.split('.');
  for (let i = 0; i < path.length; i++) {
    object = object[path[i]];
    if (!object) {
      return object;
    }
  }
  return object;
}

/**
 * init
 * Initializes a store instance. It uses private scoping to prevent
 * its context from leaking.
 *
 * @param {object} [state={}]
 * @param {array} [listeners=[]] - Not intended to be set manually, but can be overriden.
 * See _connect.
 * @returns Initial state object with the public API.
 */
function init(state: State, listeners: Listener[] = [], connections = 0) {
  const publicAPI: State = Object.freeze({
    get,
    set,
    exclude,
    trigger,
    connect,
    disconnect,
    destroy
  });

  function getAPIWithObject(object: State): State {
    return Object.assign(object, publicAPI);
  }

  /**
   * dispatch
   * Responsible for triggering callbacks stored in the listeners queue from set.
   *
   * @param {object} object
   */
  function dispatch(object) {
    let keys = Object.keys(object);
    for (let i = 0; i < listeners.length; i++) {
      let commonKeys = intersect(keys, listeners[i].keys);
      if (commonKeys.length === 0) {
        continue;
      }
      if (listeners[i].callback) {
        let partialState = {};
        for (let z = 0; z < keys.length; z++) {
          partialState[keys[z]] = state[keys[z]];
        }
        listeners[i].callback(partialState);
      }
    }
  }

  /**
   * get
   * Retrieves a cloned property from the state object.
   *
   * @param {string} [key=null]
   * @returns {object}
   */
  function get(key: string = '') {
    if (!key || key === '*') {
      return exclude();
    }
    if (key.indexOf('.') > -1) {
      return getByPath(key, state);
    }
    return clone(state[key]);
  }

  /**
   * set
   * Copies a keyed object back into state, and
   * calls dispatch to fire any connected callbacks.
   *
   * @param {object} object
   * @param {boolean} forceDispatch
   */
  function set(object: State, cb: Function | boolean = false, force = false): State | void {
    let keys = Object.keys(object);
    let changed = false;
    for (let i = 0; i < keys.length; i++) {
      if (!state.hasOwnProperty(keys[i])) {
        storeError('set', keys[i], 'Property not found.');
        return;
      }
      if ((typeof object[keys[i]] === 'object')
        || state[keys[i]] !== object[keys[i]]) {
        changed = true;
        state[keys[i]] = object[keys[i]];
      }
    }

    if ((changed || cb === true || force) && listeners.length > 0) {
      dispatch(object);
    } /* else {
      console.log(`e.stack: `, new Error().stack)
      console.log('NO CHANGE:', keys.join(', '))
    } */

    if (typeof cb === 'function') {
      cb();
    }

    return publicAPI;
  }

  /**
   * exclude
   * Excludes a string array of keys from the state object.
   *
   * @param {array} excludeKeys
   * @returns Partial or full state object with keys in
   * excludeKeys excluded, along with the public API for chaining.
   */
  function exclude(excludeKeys: string[] = []): object {
    let apiKeys = Object.keys(publicAPI);
    let stateKeys = Object.keys(state);
    let filteredState = {};
    for (let i = 0, len = stateKeys.length; i < len; i++) {
      if (apiKeys.indexOf(stateKeys[i]) === -1
        && excludeKeys.indexOf(stateKeys[i]) === -1) {
        filteredState[stateKeys[i]] = state[stateKeys[i]];
      }
    }
    return filteredState;
  }

  /**
   * trigger
   * Fires a callback event for any matching key in the listener queue.
   * It supports passing through unlimited arguments to the callback.
   * Useful for setting up actions.
   *
   * @param {string} key
   * @param {any} args
   * @returns {any} Return result of the callback.
   */
  function trigger(): any {
    const [key, ...args] = Array.from(arguments);
    let matchedListeners = filter(listeners, function(listener) {
      return listener.keys.indexOf(key) > -1;
    });
    if (matchedListeners.length === 0) {
      console.log(listeners)
      storeError('trigger', key, 'Action not found.');
      return;
    }
    for (let i = 0; i < matchedListeners.length; i++) {
      if (matchedListeners[i].callback) {
        let output = matchedListeners[i].callback(...args);
        if (output !== undefined) {
          return output;
        }
      }
    }
  }

  function _connect(keys: any, callback: Function, id: number, context: object): void {
    let listener: Listener;

    if (callback) {

      listener = find(listeners, _listener => _listener && _listener.callback === callback);

      if (context) {
        callback.bind(context);
      }
    }

    if (listener) {
      let newKeys = difference(keys, listener.keys);
      listener.keys.concat(newKeys);
    } else {
      listeners.push({keys, callback, id});
    }
  }

  /**
   * connect
   *
   * @param {any} actions - can be a string, array, or an object.
   * @param {function} callback - callback to be fired on either state
   * property change, or through the trigger method.
   * @returns ID of the added listener.
   */
  function connect(
    actions: any,
    callback: Function,
    context: object
  ): number {
    const id = connections++;
    if (actions === '*') {
      listeners.push({keys: Object.keys(state), callback, id});
    } else if (typeof actions === 'string') {
      _connect([actions], callback, id, context);
    } else if (Array.isArray(actions)) {
      _connect(actions, callback, id, context);
    } else if (typeof actions === 'object') {
      let keys = Object.keys(actions);
      for (let i = 0; i < keys.length; i++) {
        _connect([keys[i]], actions[keys[i]], id, context);
      }
    }

    return id;
  }

  function disconnectByKey(key: string): void {
    let listenerIndex = findIndex(listeners, function(listener) {
      return listener.keys.indexOf(key) > -1;
    });
    if (listenerIndex === -1) {
      storeError('disconnect', key, 'Invalid disconnect key.');
      return;
    }
    listeners.splice(listenerIndex, 1);
  }

  /**
   * disconnect
   * Removes a callback listener from the queue.
   *
   * @param {string} key
   */
  function disconnect(key: DisconnectKey) {
    if (typeof key === 'string') {
      disconnectByKey(key);
    } else if (Array.isArray(key)) {
      for (let i = 0; i < key.length; i++) {
        disconnectByKey(key[i]);
      }
    } else if (typeof key === 'number') {
      for (let i = 0; i < listeners.length; i++) {
        if (!listeners[i] || listeners[i].id !== key) {
          continue;
        }
        listeners.splice(findIndex(listeners, function(listener) {
          return listener.id === key;
        }), 1);
      }
    }
  }

  /**
   * destroy
   * Assigns undefined to all state properties and listeners. Intended
   * to be used at the end of the application life cycle.
   *
   */
  function destroy() {
    for (let i = 0; i < listeners.length; i++) {
      listeners[i] = undefined;
    }
    listeners = [];
  }

  return getAPIWithObject(state);
}

export default init;