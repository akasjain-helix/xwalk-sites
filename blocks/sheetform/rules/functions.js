function valueOf(a) {
  if (a === null || a === undefined) { return a; }
  if (Array.isArray(a)) {
    return a.map((i) => valueOf(i));
  }
  return a.valueOf();
}

export default {
  dispatchEvent: {
    _func: (args, data, interpreter) => {
      const element = args[0];
      let eventName = valueOf(args[1]);
      let payload = args.length > 2 ? valueOf(args[2]) : undefined;
      let dispatch = false;
      if (typeof element === 'string') {
        payload = eventName;
        eventName = element;
        dispatch = true;
      }
      let event;
      if (eventName.startsWith('custom:')) {
        event = {
          name: eventName,
          payload,
          dispatch,
        };
      } else {
        event = {
          name: eventName,
          payload,
        };
      }
      if (event != null) {
        if (typeof element === 'string') {
          interpreter.globals.dispatch(event);
        } else {
          interpreter.globals.dispatch(event, element.$id);
        }
      }
      return {};
    },
    _signature: [],
  },
};
