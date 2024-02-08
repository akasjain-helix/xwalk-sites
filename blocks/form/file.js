import { updateOrCreateInvalidMsg } from './util.js';
import { fileAttachmentText, errorMessages } from './constant.js';

const fileSizeRegex = /^(\d*\.?\d+)(\\?(?=[KMGT])([KMGT])(?:i?B)?|B?)$/i;
function sizeToBytes(size, symbol) {
  const sizes = {
    KB: 1, MB: 2, GB: 3, TB: 4,
  };
  const i = 1024 ** sizes[symbol];
  return Math.round(size * i);
}
function getFileSizeInBytes(str) {
  let retVal = 0;
  if (typeof str === 'string') {
    const matches = fileSizeRegex.exec(str.trim());
    if (matches != null) {
      retVal = sizeToBytes(parseFloat(matches[1]), (matches[2] || 'kb').toUpperCase());
    }
  }
  return retVal;
}
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
function maxFileSize(constraint, files) {
  const sizeLimit = typeof constraint === 'string' ? getFileSizeInBytes(constraint) : constraint;
  let isError = false;
  Array.from(files).forEach((file) => {
    if (file.size > sizeLimit) {
      isError = true;
    }
  });
  return isError;
}
function acceptCheck(constraint, value) {
  if (!constraint || constraint.length === 0 || value === null || value === undefined) {
    return true;
  }
  const tempFiles = Array.from(value);
  const invalidFile = tempFiles.some((file) => !matchMediaType(file.type, constraint));
  return !invalidFile;
}
function fileValidation({ wrapper, input, files }) {
  const multiple = input.hasAttribute('multiple');
  const acceptedFile = (input.getAttribute('accept') || '').split(',');
  const minItems = (parseInt(input.dataset.minItems, 10) || 1);
  const maxItems = (parseInt(input.dataset.maxItems, 10) || -1);
  const fileSize = `${input.dataset.maxFileSize || '2'}MB`;
  if (!acceptCheck(acceptedFile, files)) {
    updateOrCreateInvalidMsg(input, (wrapper.dataset.accept || errorMessages.accept));
  } else if (maxFileSize(fileSize, files)) {
    updateOrCreateInvalidMsg(input, (wrapper.dataset.maxFileSize || errorMessages.maxFileSize));
  } else if (multiple && maxItems !== -1 && files.length > maxItems) {
    updateOrCreateInvalidMsg(input, (wrapper.dataset.maxItems || errorMessages.maxItems.replace(/\$0/, maxItems)));
  } else if (multiple && minItems !== 1 && files.length < minItems) {
    updateOrCreateInvalidMsg(input, (wrapper.dataset.minItems || errorMessages.minItems.replace(/\$0/, minItems)));
  } else {
    updateOrCreateInvalidMsg(input, '');
  }
}

function getFiles(files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  return dataTransfer.files;
}

function updateButtonIndex(elements = []) {
  elements.forEach((element, index) => {
    const button = element.querySelector('button');
    button.dataset.index = index;
  });
}

function addFileInFileList(fileList, file, index) {
  const description = `<div class="file-description">
  <span>${file.name} ${(file.size / (1024 * 1024)).toFixed(2)}mb</span>
  <button type="button" data-index="${index}"></button>
  </div>`;
  fileList.innerHTML += description;
}
function clearFileList(fileList) {
  fileList.innerHTML = '';
}

function createAttachButton(input) {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = fileAttachmentText;
  button.onclick = () => {
    input.click();
  };
  return button;
}

function attachFiles(event, {
  input, fileList, allFiles, wrapper,
}) {
  const multiple = input.hasAttribute('multiple');
  if (!multiple) {
    allFiles.splice(0, allFiles.length);
  }
  const files = event.files || event.target.files;
  Array.from(files).forEach((file) => allFiles.push(file));
  fileValidation({ wrapper, input, files: allFiles });
  clearFileList(fileList);
  allFiles.forEach((file, index) => addFileInFileList(fileList, file, index));
  input.files = getFiles(allFiles);
}

function attachChangeEvent({
  input, fileList, allFiles, wrapper,
}) {
  input.addEventListener('change', (event) => {
    if (!event?.detail?.stopRendering) {
      attachFiles(event, {
        input, fileList, allFiles, wrapper,
      });
    }
  });
}

function attachRemoveFileEvent({
  input, fileList, allFiles, wrapper,
}) {
  fileList.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
      const index = parseInt(event.target.dataset.index, 10);
      allFiles.splice(index, 1);
      fileValidation({ wrapper, input, files: allFiles });
      const deletedFile = Array.from(fileList.children)[index];
      fileList.removeChild(deletedFile);
      updateButtonIndex(Array.from(fileList.children));
      const dupEvent = new CustomEvent('change', { bubbles: true, detail: { stopRendering: true } });
      input.dispatchEvent(dupEvent);
      input.files = getFiles(allFiles);
    }
  });
}

export default async function decorate(wrapper, field) {
  const allFiles = [];
  const input = wrapper.querySelector('input');
  const fileList = document.createElement('div');
  fileList.setAttribute('id', `${field.id}-fileList`);
  const AttachButton = createAttachButton(input);
  attachChangeEvent({
    input, fileList, allFiles, wrapper,
  });
  attachRemoveFileEvent({
    input, fileList, allFiles, wrapper,
  });
  wrapper.insertBefore(AttachButton, input);
  wrapper.append(fileList);
}
