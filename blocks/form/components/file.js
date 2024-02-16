import { updateOrCreateInvalidMsg } from '../util.js';
import { fileAttachmentText, defaultErrorMessages } from '../constant.js';

const fileSizeRegex = /^(\d*\.?\d+)(\\?(?=[KMGT])([KMGT])(?:i?B)?|B?)$/i;

/**
 * converts a string of the form "10MB" to bytes. If the string is malformed 0 is returned
 * @param {*} str
 * @returns
 */
function getSizeInBytes(str) {
  const sizes = {
    KB: 1, MB: 2, GB: 3, TB: 4,
  };

  if (typeof str === 'string') {
    const matches = fileSizeRegex.exec(str.trim());
    if (matches != null) {
      const symbol = matches[2] || 'kb';
      const size = parseFloat(matches[1]);
      const i = 1024 ** sizes[symbol.toUpperCase()];
      return Math.round(size * i);
    }
  }
  return 0;
}

/**
 * matches the given mediaType with the accepted mediaTypes
 * @param {*} mediaType mediaType of the file to match
 * @param {[]} accepts accepted mediaTypes
 * @returns false if the mediaType is not accepted
 */
function matchMediaType(mediaType, accepts) {
  return !mediaType || accepts.some((accept) => {
    const trimmedAccept = accept.trim();
    const prefixAccept = trimmedAccept.split('/')[0];
    const suffixAccept = trimmedAccept.split('.')[1];
    return ((trimmedAccept.includes('*') && mediaType.startsWith(prefixAccept))
      || (trimmedAccept.includes('.') && mediaType.endsWith(suffixAccept))
      || (trimmedAccept === mediaType));
  });
}

/**
 * checks whether the size of the files in the array is withing the maxFileSize or not
 * @param {string|number} maxFileSize maxFileSize in bytes or string with the unit
 * @param {File[]} files array of File objects
 * @returns false if any file is larger than the maxFileSize
 */
function checkMaxFileSize(maxFileSize, files) {
  const sizeLimit = typeof maxFileSize === 'string' ? getSizeInBytes(maxFileSize) : maxFileSize;
  return Array.from(files).find((file) => file.size > sizeLimit) === undefined;
}

/**
 * checks whether the mediaType of the files in the array are accepted or not
 * @param {[]} acceptedMediaTypes
 * @param {File[]} files
 * @returns false if the mediaType of any file is not accepted
 */
function checkAccept(acceptedMediaTypes, files) {
  if (!acceptedMediaTypes || acceptedMediaTypes.length === 0
    || files === null || files === undefined) {
    return true;
  }
  const invalidFile = Array.from(files)
    .some((file) => !matchMediaType(file.type, acceptedMediaTypes));
  return !invalidFile;
}

/**
 * triggers file Validation for the given input element and updates the error message
 * @param {HTMLInputElement} input
 */
function fileValidation(input) {
  const multiple = input.hasAttribute('multiple');
  const acceptedFile = (input.getAttribute('accept') || '').split(',');
  const minItems = (parseInt(input.dataset.minItems, 10) || 1);
  const maxItems = (parseInt(input.dataset.maxItems, 10) || -1);
  const fileSize = `${input.dataset.maxFileSize || '2MB'}`;
  let constraint = '';
  let errorMessage = '';
  const { files } = input;
  const wrapper = input.closest('.field-wrapper');
  if (!checkAccept(acceptedFile, files)) {
    constraint = 'accept';
  } else if (!checkMaxFileSize(fileSize, files)) {
    constraint = 'maxFileSize';
  } else if (multiple && maxItems !== -1 && files.length > maxItems) {
    constraint = 'maxItems';
    errorMessage = defaultErrorMessages.maxItems.replace(/\$0/, maxItems);
  } else if (multiple && minItems !== 1 && files.length < minItems) {
    constraint = 'minItems';
    errorMessage = defaultErrorMessages.minItems.replace(/\$0/, minItems);
  }
  if (constraint.length) {
    const finalMessage = wrapper.dataset[constraint]
    || errorMessage
    || defaultErrorMessages[constraint];
    input.setCustomValidity(finalMessage);
    updateOrCreateInvalidMsg(
      input,
      finalMessage,
    );
  } else {
    input.setCustomValidity('');
    updateOrCreateInvalidMsg(input, '');
  }
}

function getFiles(files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  return dataTransfer.files;
}

/**
 * creates an HTML element for the attached file
 * @param {File} file
 * @param {number} index
 */
function fileElement(file, index) {
  const el = document.createElement('div');
  el.classList.add('file-description');
  el.innerHTML = `<span>${file.name} ${(file.size / (1024 * 1024)).toFixed(2)}mb</span>
  <button type="button" data-index="${index}"></button>`;
  return el;
}

function createAttachButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = fileAttachmentText;
  return button;
}

function createFileHandler(allFiles, input) {
  return {
    removeFile: (index) => {
      allFiles.splice(index, 1);
      const fileListElement = input.parentElement.querySelector('.files-list');
      fileListElement.querySelector(`[data-index="${index}"]`).parentElement.remove();
      input.files = getFiles(allFiles);
      fileValidation(input);
      const dupEvent = new CustomEvent('change', { bubbles: true, detail: { deletion: true } });
      input.dispatchEvent(dupEvent);
    },

    attachFiles: (event) => {
      const inputEl = event.target;
      const multiple = inputEl.hasAttribute('multiple');
      if (!multiple) {
        allFiles.splice(0, allFiles.length);
      }
      const newFiles = Array.from(event.target.files);
      const currentLength = allFiles.length;
      allFiles.push(...newFiles);
      const newFileElements = newFiles
        .map((file, index) => fileElement(file, index + currentLength));
      const fileListElement = inputEl.parentElement.querySelector('.files-list');
      if (multiple) {
        fileListElement.append(...newFileElements);
      } else {
        fileListElement.replaceChildren(...newFileElements);
      }
      inputEl.files = getFiles(allFiles);
      fileValidation(inputEl);
    },
  };
}

// eslint-disable-next-line no-unused-vars
export default async function decorate(fieldDiv, field) {
  const allFiles = [];
  const input = fieldDiv.querySelector('input');
  fieldDiv.classList.add('decorated');
  const fileListElement = document.createElement('div');
  fileListElement.classList.add('files-list');
  const attachButton = createAttachButton();
  attachButton.addEventListener('click', () => input.click());
  const fileHandler = createFileHandler(allFiles, input);
  input.addEventListener('change', (event) => {
    if (!event?.detail?.deletion) {
      fileHandler.attachFiles(event);
    }
  });
  fileListElement.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      fileHandler.removeFile(e.target.dataset.index);
    }
  });
  fieldDiv.insertBefore(attachButton, input);
  fieldDiv.insertBefore(fileListElement, input.nextElementSibling);
  return fieldDiv;
}
