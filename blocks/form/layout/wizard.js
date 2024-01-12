import { createButton } from '../util.js';

export class WizardLayout {
  inputFields = 'input,textarea,select';

  constructor(includePrevBtn = true, includeNextBtn = true) {
    this.includePrevBtn = includePrevBtn;
    this.includeNextBtn = includeNextBtn;
  }

  // eslint-disable-next-line class-methods-use-this
  getSteps(panel) {
    return [...panel.children].filter((step) => step.tagName.toLowerCase() === 'fieldset');
  }

  assignIndexToSteps(panel) {
    const steps = this.getSteps(panel);
    steps.forEach((step, index) => {
      step.dataset.index = index;
      step.style.setProperty('--wizard-step-index', index);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getEligibleSibling(current, forward = true) {
    const direction = forward ? 'nextElementSibling' : 'previousElementSibling';

    for (let sibling = current[direction]; sibling; sibling = sibling[direction]) {
      if (sibling.dataset.hidden !== 'true') {
        return sibling;
      }
    }
    return null;
  }

  /**
 * @param {FormElement | Fieldset} container
 * @returns return false, if there are invalid fields
 */
  validateContainer(container) {
    const fieldElements = [...container.querySelectorAll(this.inputFields)];
    const isValid = fieldElements.reduce((valid, fieldElement) => {
      const isFieldValid = fieldElement.checkValidity();
      return valid && isFieldValid;
    }, true);

    if (!isValid) {
      container.querySelector(':invalid')?.focus();
    }
    return isValid;
  }

  navigate(panel, forward = true) {
    const current = panel.querySelector('.current-wizard-step');

    let valid = true;
    if (forward) {
      valid = this.validateContainer(current);
    }
    const navigateTo = valid ? this.getEligibleSibling(current, forward) : current;

    if (navigateTo && current !== navigateTo) {
      current.classList.remove('current-wizard-step');
      navigateTo.classList.add('current-wizard-step');
      const event = new CustomEvent('wizard:navigate', {
        detail: {
          prevStep: { id: current.id, index: +current.dataset.index },
          currStep: { id: navigateTo.id, index: +navigateTo.dataset.index },
        },
        bubbles: false,
      });
      panel.dispatchEvent(event);
    }
  }

  addButton(wrapper, panel, buttonDef, forward = true) {
    const button = createButton(buttonDef);
    button.classList.add(buttonDef.id);
    button.addEventListener('click', () => this.navigate(panel, forward));
    wrapper.append(button);
  }

  applyLayout(panel) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-wizard-button-wrapper';
    if (this.includePrevBtn) {
      this.addButton(wrapper, panel, {
        label: { value: 'Back' }, fieldType: 'button', name: 'back', id: 'form-wizard-button-prev',
      }, false);
    }

    if (this.includeNextBtn) {
      this.addButton(wrapper, panel, {
        label: { value: 'NEXT' }, fieldType: 'button', name: 'next', id: 'form-wizard-button-next',
      });
    }

    const submitBtn = panel.querySelector('.form-submit-wrapper');
    if (submitBtn) {
      wrapper.append(submitBtn);
    }
    this.assignIndexToSteps(panel);
    panel.append(wrapper);
    panel.querySelector('fieldset')?.classList.add('current-wizard-step');
    panel.classList.add('wizard');
    panel.classList.add('left');
  }
}

const layout = new WizardLayout();

export default function wizardLayout(panel) {
  layout.applyLayout(panel);
}

export const navigate = layout.navigate.bind(layout);
export const validateContainer = layout.validateContainer.bind(layout);
