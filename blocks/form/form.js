import {
  createButton, createFieldWrapper, createLabel, getHTMLRenderType,
  createHelpText,
  getId,
  stripTags,
  checkValidation,
} from './util.js';
import loadRuleEngine from './rules/index.js';
import initializeRuleEngineWorker from './rules/worker.js';
import GoogleReCaptcha from './integrations/recaptcha.js';

import fileDecorate from './file.js';
import registerCustomFunctions from './rules/functionRegistration.js';

export const DELAY_MS = 0;
let captchaField;

const withFieldWrapper = (element) => (fd) => {
  const wrapper = createFieldWrapper(fd);
  wrapper.append(element(fd));
  return wrapper;
};

function setPlaceholder(element, fd) {
  if (fd.placeHolder) {
    element.setAttribute('placeholder', fd.placeHolder);
  }
}

const constraintsDef = Object.entries({
  'password|tel|email|text': [['maxLength', 'maxlength'], ['minLength', 'minlength'], 'pattern'],
  'number|range|date': [['maximum', 'Max'], ['minimum', 'Min'], 'step'],
  file: ['accept', 'Multiple'],
  fieldset: [['maxOccur', 'data-max'], ['minOccur', 'data-min']],
}).flatMap(([types, constraintDef]) => types.split('|')
  .map((type) => [type, constraintDef.map((cd) => (Array.isArray(cd) ? cd : [cd, cd]))]));

const constraintsObject = Object.fromEntries(constraintsDef);

function setConstraints(element, fd) {
  const renderType = getHTMLRenderType(fd);
  const constraints = constraintsObject[renderType];
  if (constraints) {
    constraints
      .filter(([nm]) => fd[nm])
      .forEach(([nm, htmlNm]) => {
        element.setAttribute(htmlNm, fd[nm]);
      });
  }
}

function createInput(fd) {
  const input = document.createElement('input');
  input.type = getHTMLRenderType(fd);
  setPlaceholder(input, fd);
  setConstraints(input, fd);
  return input;
}

const createTextArea = withFieldWrapper((fd) => {
  const input = document.createElement('textarea');
  setPlaceholder(input, fd);
  return input;
});

const createSelect = withFieldWrapper((fd) => {
  const select = document.createElement('select');
  select.required = fd.required;
  select.title = fd.tooltip ?? '';
  select.readOnly = fd.readOnly;
  select.multiple = fd.type === 'string[]' || fd.type === 'boolean[]' || fd.type === 'number[]';
  let ph;
  if (fd.placeholder) {
    ph = document.createElement('option');
    ph.textContent = fd.placeholder;
    ph.setAttribute('disabled', '');
    ph.setAttribute('value', '');
    select.append(ph);
  }
  let optionSelected = false;

  const addOption = (label, value) => {
    const option = document.createElement('option');
    option.textContent = label?.trim();
    option.value = value?.trim() || label?.trim();
    if (fd.value === option.value || (Array.isArray(fd.value) && fd.value.includes(option.value))) {
      option.setAttribute('selected', '');
      optionSelected = true;
    }
    select.append(option);
    return option;
  };

  const options = fd?.enum || [];
  const optionNames = fd?.enumNames ?? options;
  options.forEach((value, index) => addOption(optionNames?.[index], value));

  if (ph && optionSelected === false) {
    ph.setAttribute('selected', '');
  }
  return select;
});

function createRadioOrCheckbox(fd) {
  const wrapper = createFieldWrapper(fd);
  const input = createInput(fd);
  const [value, uncheckedValue] = fd.enum;
  input.value = value;
  if (typeof uncheckedValue !== 'undefined') {
    input.dataset.uncheckedValue = uncheckedValue;
  }
  wrapper.insertAdjacentElement('afterbegin', input);
  return wrapper;
}

function createLegend(fd) {
  return createLabel(fd, 'legend');
}

function createFieldSet(fd) {
  const wrapper = createFieldWrapper(fd, 'fieldset', createLegend);
  wrapper.id = fd.id;
  wrapper.name = fd.name;
  if (fd.fieldType === 'panel') {
    wrapper.classList.add('form-panel-wrapper');
  }
  return wrapper;
}

function setConstraintsMessage(field, messages = {}) {
  Object.keys(messages).forEach((key) => {
    field.dataset[`${key}ErrorMessage`] = messages[key];
  });
}

function createRadioOrCheckboxGroup(fd) {
  const wrapper = createFieldSet({ ...fd });
  const type = fd.fieldType.split('-')[0];
  fd.enum.forEach((value, index) => {
    const label = typeof fd.enumNames[index] === 'object' ? fd.enumNames[index].value : fd.enumNames[index];
    const id = getId(fd.name);
    const field = createRadioOrCheckbox({
      name: fd.name,
      id,
      label: { value: label },
      fieldType: type,
      enum: [value],
      required: fd.required,
    });
    field.classList.remove('field-wrapper', `form-${fd.name}`);
    const input = field.querySelector('input');
    input.id = id;
    input.dataset.fieldType = fd.fieldType;
    input.name = fd.id; // since id is unique across radio/checkbox group
    input.checked = Array.isArray(fd.value) ? fd.value.includes(value) : value === fd.value;
    if ((index === 0 && type === 'radio') || type === 'checkbox') {
      input.required = fd.required;
    }
    wrapper.appendChild(field);
  });
  wrapper.dataset.required = fd.required;
  setConstraintsMessage(wrapper, fd.constraintMessages);
  return wrapper;
}

function createPlainText(fd) {
  const paragraph = document.createElement('p');
  if (fd.richText) {
    paragraph.innerHTML = stripTags(fd.value);
  } else {
    paragraph.textContent = fd.value;
  }
  const wrapper = createFieldWrapper(fd);
  wrapper.id = fd.id;
  wrapper.replaceChildren(paragraph);
  return wrapper;
}

function createFileField(fd) {
  const field = createFieldWrapper(fd);
  field.append(createInput(fd));
  fileDecorate(field, fd);
  return field;
}

const fieldRenderers = {
  'drop-down': createSelect,
  'plain-text': createPlainText,
  checkbox: createRadioOrCheckbox,
  button: createButton,
  multiline: createTextArea,
  panel: createFieldSet,
  radio: createRadioOrCheckbox,
  'radio-group': createRadioOrCheckboxGroup,
  'checkbox-group': createRadioOrCheckboxGroup,
  file: createFileField,
};

async function fetchForm(pathname) {
  // get the main form
  const resp = await fetch(pathname);
  const json = await resp.json();
  return json;
}

function colSpanDecorator(field, element) {
  const colSpan = field['Column Span'];
  if (colSpan && element) {
    element.classList.add(`col-${colSpan}`);
  }
}

const handleFocus = (input, field) => {
  const editValue = input.getAttribute('edit-value');
  input.type = field.type;
  input.value = editValue;
};

const handleFocusOut = (input) => {
  const displayValue = input.getAttribute('display-value');
  input.type = 'text';
  input.value = displayValue;
};

function inputDecorator(field, element) {
  const input = element?.querySelector('input,textarea,select');
  if (input) {
    input.id = field.id;
    input.name = field.name;
    input.tooltip = field.tooltip;
    input.readOnly = field.readOnly;
    input.autocomplete = field.autoComplete ?? 'off';
    input.disabled = field.enabled === false;
    const fieldType = getHTMLRenderType(field);
    if (['number', 'date'].includes(fieldType) && field.displayFormat !== undefined) {
      field.type = fieldType;
      input.setAttribute('edit-value', field.value ?? '');
      input.setAttribute('display-value', field.displayValue ?? '');
      input.type = 'text';
      input.value = field.displayValue ?? '';
      input.addEventListener('focus', () => handleFocus(input, field));
      input.addEventListener('blur', () => handleFocusOut(input));
    } else if (input.type !== 'file') {
      input.value = field.value ?? '';
      if (input.type === 'radio' || input.type === 'checkbox') {
        input.value = field?.enum?.[0] ?? 'on';
        input.checked = field.value === input.value;
      }
    } else {
      input.multiple = field.type === 'file[]';
    }
    if (field.required) {
      input.setAttribute('required', 'required');
    }
    if (field.description) {
      input.setAttribute('aria-describedby', `${field.id}-description`);
    }
    if (field.minItems) {
      input.dataset.minItems = field.minItems;
    }
    if (field.maxItems) {
      input.dataset.maxItems = field.maxItems;
    }
    if (field.maxFileSize && !Number.isNaN(Number(field.maxFileSize))) {
      input.dataset.maxFileSize = field.maxFileSize;
    }
    setConstraintsMessage(element, field.constraintMessages);
    element.dataset.required = field.required;
  }
}

const layoutDecorators = [
  [(panel) => {
    const { ':type': type = '' } = panel;
    return type.endsWith('wizard');
  }, 'wizard'],
];

async function applyLayout(panel, element) {
  const result = layoutDecorators.find(([predicate]) => predicate(panel));
  if (result) {
    const module = await import(`./layout/${result[1]}.js`);
    if (module && module.default) {
      const layoutFn = module.default;
      await layoutFn(element);
    }
  }
}

function renderField(fd) {
  const fieldType = fd?.fieldType?.replace('-input', '') ?? 'text';
  const renderer = fieldRenderers[fieldType];
  let field;
  if (typeof renderer === 'function') {
    field = renderer(fd);
  } else {
    field = createFieldWrapper(fd);
    field.append(createInput(fd));
  }
  if (fd.description) {
    field.append(createHelpText(fd));
    field.dataset.description = fd.description; // In case overriden by error message
  }
  return field;
}

export async function generateFormRendition(panel, container) {
  const items = panel.items.length > 0 ? panel.items : Object.keys(panel.data).map(function(k) { return panel.data[k] });
  const promises = [];
  items.forEach((field) => {
    field.value = field.value ?? '';
    const { fieldType } = field;
    if (fieldType === 'captcha') {
      captchaField = field;
    } else {
      const element = renderField(field);
      if (field.fieldType !== 'radio-group' && field.fieldType !== 'checkbox-group') {
        inputDecorator(field, element);
      }
      colSpanDecorator(field, element);
      container.append(element);
      if (field?.fieldType === 'panel') {
        promises.push(generateFormRendition(field, element));
      }
    }
  });

  await Promise.all(promises);
  await applyLayout(panel, container);
}

export async function createForm(formDef, data) {
  const { action: formPath } = formDef;
  const form = document.createElement('form');
  form.dataset.action = formPath;
  form.noValidate = true;
  await generateFormRendition(formDef, form);

  let captcha;
  if (captchaField) {
    const siteKey = captchaField?.properties?.['fd:captcha']?.config?.siteKey;
    captcha = new GoogleReCaptcha(siteKey, captchaField.id);
    captcha.loadCaptcha(form);
  }

  form.addEventListener('change', (event) => {
    checkValidation(event.target);
  });

  window.setTimeout(async () => {
    loadRuleEngine(formDef, form, captcha, generateFormRendition, data);
  }, DELAY_MS);

  return form;
}

async function fetchData({ id }) {
  try {
    const { search = '' } = window.location;
    const response = await fetch(`/adobe/forms/af/data/${id}${search}`);
    const json = await response.json();
    if (json && json?.data) {
      const { data } = json;
      if (data && data.afData) {
        const { afData } = data;
        if (afData && afData.afBoundData) {
          return afData.afBoundData;
        }
      }
      return data;
    }
    return json;
  } catch (ex) {
    return null;
  }
}

export default async function decorate(block) {
  let container = block.querySelector('a[href$=".json"]');
  let formDef;
  if (container) {
    const { pathname } = new URL(container.href);
    if(window.location.host === new URL(container.href).host) {
      formDef = await fetchForm(pathname);
    } else {
      formDef = await fetchForm(container.href);
    }
  } else {
    container = block.querySelector('pre');
    const codeEl = container?.querySelector('code');
    const content = codeEl?.textContent;
    if (content) {
      formDef = JSON.parse(content?.replace(/\x83\n|\n|\s\s+/g, ''));
    }
  }
  if (formDef) {
    const data = await fetchData(formDef);
    await registerCustomFunctions();
    const form = await initializeRuleEngineWorker({
      ...formDef,
      data,
    }, createForm);
    container.replaceWith(form);
  }
}
