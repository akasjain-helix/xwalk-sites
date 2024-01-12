/* eslint-disable max-classes-per-file */
import { createFormInstance } from './model/afb-runtime.js';

export default class RuleEngine {
  rulesOrder = {};

  constructor(formDef) {
    this.form = createFormInstance(formDef);
  }

  getState() {
    return this.form.getState(true);
  }
}

let ruleEngine;
onmessage = (e) => {
  switch (e.data.name) {
    case 'init':
      ruleEngine = new RuleEngine(e.data.payload);
      // eslint-disable-next-line no-case-declarations
      const state = ruleEngine.getState();
      postMessage({
        name: 'init',
        payload: state,
      });
      ruleEngine.dispatch = (msg) => {
        postMessage(msg);
      };
      break;
    default:
      break;
  }
};
