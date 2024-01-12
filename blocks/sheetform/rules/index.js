import { submitSuccess, submitFailure } from '../submit.js';
import { createHelpText, createLabel, updateorCreateInvalidMsg } from '../util.js';

async function fieldChanged(payload, form, generateFormRendition) {
  const { changes, field: fieldModel } = payload;
  changes.forEach((change) => {
    const { id } = fieldModel;
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
        if (field.setCustomValidity) {
          field.setCustomValidity(currentValue);
          updateorCreateInvalidMsg(field, currentValue);
        }
        break;
      case 'value':
        field.value = currentValue;
        break;
      case 'visible':
        if (currentValue === true) {
          field.closest('.field-wrapper').dataset.hidden = 'false';
        } else {
          field.closest('.field-wrapper').dataset.hidden = 'true';
        }
        break;
      case 'enabled':
        if (currentValue === true) {
          if (fieldModel.fieldType === 'radio-group' || fieldModel.fieldType === 'checkbox-group') {
            document.getElementsByName(id).forEach((el) => {
              if (fieldModel.readOnly === false) {
                el.removeAttribute('disabled');
                el.removeAttribute('aria-readonly');
              }
            });
          } else if (fieldModel.fieldType === 'drop-down') {
            if (fieldModel.readOnly === false) {
              field.removeAttribute('disabled');
              field.removeAttribute('aria-readonly');
            }
          } else {
            field.removeAttribute('disabled');
          }
        } else if (fieldModel.fieldType === 'radio-group' || fieldModel.fieldType === 'checkbox-group') {
          document.getElementsByName(id).forEach((el) => {
            if (fieldModel.readOnly === false) {
              el.setAttribute('disabled', 'disabled');
              el.setAttribute('aria-readonly', true);
            }
          });
        } else if (fieldModel.fieldType === 'drop-down') {
          if (fieldModel.readOnly === false) {
            field.setAttribute('disabled', 'disabled');
            field.setAttribute('aria-readonly', true);
          }
        } else {
          field.setAttribute('disabled', 'disabled');
        }
        break;
      case 'readOnly':
        if (currentValue === true) {
          if (fieldModel.fieldType === 'radio-group' || fieldModel.fieldType === 'checkbox-group') {
            document.getElementsByName(id).forEach((el) => {
              el.setAttribute('disabled', 'disabled');
              el.setAttribute('aria-readonly', true);
            });
          } else if (fieldModel.fieldType === 'drop-down') {
            field.setAttribute('disabled', 'disabled');
            field.setAttribute('aria-readonly', true);
          } else {
            field.setAttribute('readonly', 'readonly');
          }
        } else if (fieldModel.fieldType === 'radio-group' || fieldModel.fieldType === 'checkbox-group') {
          document.getElementsByName(id).forEach((el) => {
            el.removeAttribute('disabled');
            el.removeAttribute('aria-readonly');
          });
        } else if (fieldModel.fieldType === 'drop-down') {
          field.removeAttribute('disabled');
          field.removeAttribute('aria-readonly');
        } else {
          field.removeAttribute('readonly');
        }
        break;
      case 'label':
        // eslint-disable-next-line no-case-declarations
        const labelEl = field.closest('.field-wrapper').querySelector('.field-label');
        if (labelEl) {
          labelEl.textContent = currentValue.value;
          labelEl.setAttribute('data-visible', currentValue.visible);
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
      const val = [];
      document.getElementsByName(name).forEach((x) => {
        if (x.checked) {
          val.push(x.value);
        }
      });
      const el = form.getElement(name);
      el.value = val;
    } else if (field.type === 'checkbox') {
      form.getElement(id).value = checked ? value : field.dataset.uncheckedValue;
    } else {
      form.getElement(id).value = value;
    }
    console.log(JSON.stringify(form.exportData(), null, 2));
  });

  htmlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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

export default async function loadRuleEngine(formDef, htmlForm, captcha, generateFormRendition) {
  const ruleEngine = await import('./model/afb-runtime.js');
  const form = ruleEngine.restoreFormInstance(formDef);
  window.myForm = form;
  htmlForm.addEventListener('submit', (e) => {
    e.preventDefault();
  });
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm, generateFormRendition);
  }, 'fieldChanged');

  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
  }, 'submitSuccess');

  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
  }, 'submitFailure');
  applyRuleEngine(htmlForm, form, captcha);
}
