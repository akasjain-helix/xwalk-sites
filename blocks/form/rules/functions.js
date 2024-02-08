function valueOf(a) {
  if (a === null || a === undefined) {
    return a;
  }
  if (Array.isArray(a)) {
    return a.map((i) => valueOf(i));
  }
  return a.valueOf();
}

/**
 * Converts a JSON string to an object.
 * @param {string} str - The JSON string to convert to an object.
 * @returns {object} - The parsed JSON object. Returns an empty object if an exception occurs.
 * @memberof module:FormView~customFunctions
 */
export function toObject(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
}

/**
 * Prefixes the URL with the context path.
 * @param {string} url - The URL to externalize.
 * @returns {string} - The externalized URL.
 * @memberof module:FormView~customFunctions
 */
export function externalize(url) {
  if (window?.Granite?.HTTP && typeof (window.Granite.HTTP.externalize === 'function')) {
    return window.Granite.HTTP.externalize(url);
  }
  return url;
}

/**
 * Validates if the given URL is correct.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - True if the URL is valid, false otherwise.
 * @memberof module:FormView~customFunctions
 */
function validateURL(url) {
  try {
    const validatedUrl = new URL(url, window.location.href);
    return (validatedUrl.protocol === 'http:' || validatedUrl.protocol === 'https:');
  } catch (err) {
    return false;
  }
}

/**
 * Navigates to the specified URL.
 * @param {string} destinationURL - The URL to navigate to. If not specified,
 * a new blank window will be opened.
 * @param {string} destinationType - The type of destination. Supports the following
 * values: "_newwindow", "_blank", "_parent", "_self", "_top", or the name of the window.
 * @returns {Window} - The newly opened window.
 * @memberof module:FormView~customFunctions
 */
export function navigateTo(destinationURL, destinationType) {
  let param = null;
  const windowParam = window;
  let arg = null;
  // eslint-disable-next-line default-case
  switch (destinationType) {
    case '_newwindow':
      param = '_blank';
      arg = 'width=1000,height=800';
      break;
  }
  if (!param) {
    if (destinationType) {
      param = destinationType;
    } else {
      param = '_blank';
    }
  }
  if (validateURL(destinationURL)) {
    windowParam.open(externalize(destinationURL), param, arg);
  }
}

/**
 * Default error handler for the invoke service API.
 * @param {object} response - The response body of the invoke service API.
 * @param {object} headers - The response headers of the invoke service API.
 * @param {object} globals - An object containing form instance and invoke method
 * to call other custom functions.
 * @returns {void}
 * @memberof module:FormView~customFunctions
 */
export function defaultErrorHandler(response, headers, globals) {
  if (response && response.validationErrors) {
    response.validationErrors?.forEach((violation) => {
      if (violation.details) {
        if (violation.fieldName) {
          globals.form.visit((f) => {
            if (f.qualifiedName === violation.fieldName) {
              f.markAsInvalid(violation.details.join('\n'));
            }
          });
        } else if (violation.dataRef) {
          globals.form.visit((f) => {
            if (f.dataRef === violation.dataRef) {
              f.markAsInvalid(violation.details.join('\n'));
            }
          });
        }
      }
    });
  }
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
