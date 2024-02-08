import { submitSuccess, submitFailure, handleSubmit } from '../submit.js';
import {
  createHelpText, createLabel, updateOrCreateInvalidMsg, getCheckboxGroupValue,
} from '../util.js';

function disableElement(el, value) {
  el.toggleAttribute('disabled', value === true);
  el.toggleAttribute('aria-readonly', value === true);
}

function compare(fieldVal, htmlVal, type) {
  if (type === 'number') {
    return fieldVal === Number(htmlVal);
  }
  if (type === 'boolean') {
    return fieldVal.toString() === htmlVal;
  }
  return fieldVal === htmlVal;
}

async function fieldChanged(payload, form, generateFormRendition) {
  const { changes, field: fieldModel } = payload;
  changes.forEach((change) => {
    const {
      id, fieldType, readOnly, type, displayValue, displayFormat,
    } = fieldModel;
    const { propertyName, currentValue } = change;
    const field = form.querySelector(`#${id}`);
    if (!field) {
      return;
    }
    switch (propertyName) {
      case 'required':
        if (currentValue === true) {
          field.closest('.field-wrapper').dataset.required = '';
        } else {
          field.closest('.field-wrapper').removeAttribute('data-required');
        }
        break;
      case 'validationMessage':
        if (field.setCustomValidity && payload.field.expressionMismatch) {
          field.setCustomValidity(currentValue);
          updateOrCreateInvalidMsg(field, currentValue);
        }
        break;
      case 'value':
        if (['number', 'date'].includes(field.type) && displayFormat) {
          field.type = 'text';
          field.value = displayValue;
          field.setAttribute('edit-value', currentValue);
          field.setAttribute('display-value', displayValue);
        } else if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          field.querySelectorAll(`input[name=${id}]`).forEach((el) => {
            const exists = (Array.isArray(currentValue)
              && currentValue.some((x) => compare(x, el.value, type.replace('[]', ''))))
              || compare(currentValue, el.value, type);
            el.checked = exists;
          });
        } else if (fieldType === 'checkbox') {
          field.checked = compare(currentValue, field.value, type);
        } else if (field.type !== 'file') {
          field.value = currentValue;
        }
        break;
      case 'visible':
        field.closest('.field-wrapper').dataset.visible = currentValue;
        break;
      case 'enabled':
        // If checkboxgroup/radiogroup/drop-down is readOnly then it should remain disabled.
        if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          if (readOnly === false) {
            field.querySelectorAll(`input[name=${id}]`).forEach((el) => {
              disableElement(el, !currentValue);
            });
          }
        } else if (fieldType === 'drop-down') {
          if (readOnly === false) {
            disableElement(field, !currentValue);
          }
        } else {
          field.toggleAttribute('disabled', currentValue === false);
        }
        break;
      case 'readOnly':
        if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          field.querySelectorAll(`input[name=${id}]`).forEach((el) => {
            disableElement(el, currentValue);
          });
        } else if (fieldType === 'drop-down') {
          disableElement(field, currentValue);
        } else {
          field.toggleAttribute('disabled', currentValue === true);
        }
        break;
      case 'label':
        // eslint-disable-next-line no-case-declarations
        const fieldWrapper = field.closest('.field-wrapper');
        if (fieldWrapper) {
          let labelEl = fieldWrapper.querySelector('.field-label');
          if (labelEl) {
            labelEl.textContent = currentValue.value;
            labelEl.setAttribute('data-visible', currentValue.visible);
          } else if (fieldType === 'button') {
            field.textContent = currentValue.value;
          } else if (currentValue.value !== '') {
            labelEl = createLabel({
              id,
              label: currentValue,
            });
            fieldWrapper.prepend(labelEl);
          }
        }
        break;
      case 'description':
        // eslint-disable-next-line no-case-declarations
        const fieldContainer = field.closest('.field-wrapper');
        if (fieldContainer) {
          let descriptionEl = fieldContainer.querySelector('.field-description');
          if (descriptionEl) {
            descriptionEl.innerHTML = currentValue;
          } else if (currentValue !== '') {
            descriptionEl = createHelpText({
              id,
              description: currentValue,
            });
            fieldContainer.append(descriptionEl);
          }
        }
        break;
      case 'items':
        generateFormRendition({ items: [currentValue] }, field);
        break;
      default:
        break;
    }
  });
}

function handleRuleEngineEvent(e, form, generateFormRendition) {
  const { type, payload } = e;
  if (type === 'fieldChanged') {
    fieldChanged(payload, form, generateFormRendition);
  } else if (type === 'submitSuccess') {
    submitSuccess(e, form);
  } else if (type === 'submitFailure') {
    submitFailure(e, form);
  }
}

function applyRuleEngine(htmlForm, form, captcha) {
  htmlForm.addEventListener('change', (e) => {
    const field = e.target;
    const {
      id, value, name, checked,
    } = field;
    if ((field.type === 'checkbox' && field.dataset.fieldType === 'checkbox-group')
      || (field.type === 'radio' && field.dataset.fieldType === 'radio-group')) {
      const val = getCheckboxGroupValue(name, htmlForm);
      const el = form.getElement(name);
      el.value = val;
    } else if (field.type === 'checkbox') {
      form.getElement(id).value = checked ? value : field.dataset.uncheckedValue;
    } else if (field.type === 'file') {
      form.getElement(id).value = Array.from(field.files);
    } else {
      form.getElement(id).value = value;
    }
    console.log(JSON.stringify(form.exportData(), null, 2));
  });

  htmlForm.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
      const element = form.getElement(e.target.id);
      if (e.target.type === 'submit' && captcha) {
        const token = await captcha.getToken();
        form.getElement(captcha.id).value = token;
      }
      if (element) {
        element.dispatch({ type: 'click' });
      }
    }
  });
}

export default async function loadRuleEngine(formDef, htmlForm, captcha, genFormRendition, data) {
  const ruleEngine = await import('./model/afb-runtime.js');
  const form = ruleEngine.restoreFormInstance(formDef);
  if (data && Object.keys(data).length > 0) {
    form.importData(data);
  }

  window.myForm = form;
  let submitElement;
  htmlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitElement = e.submitter;
    handleSubmit(e, htmlForm);
  });

  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm, genFormRendition);
  }, 'fieldChanged');

  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
    submitElement.removeAttribute('disabled');
  }, 'submitSuccess');

  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
    submitElement.removeAttribute('disabled');
  }, 'submitFailure');
  applyRuleEngine(htmlForm, form, captcha);
}
