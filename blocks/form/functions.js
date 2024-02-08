/**
 * Get Full Name
 * @name getFullName Concats first name and last name
 * @param {string} firstname in Stringformat
 * @param {string} lastname in Stringformat
 * @return {string}
 */
function getFullName(firstname, lastname) {
  // eslint-disable-next-line no-param-reassign
  firstname = (firstname == null) ? '' : firstname;
  // eslint-disable-next-line no-param-reassign
  lastname = (lastname == null) ? '' : lastname;
  return firstname.concat(' ').concat(lastname);
}

/**
 * Get Placeholder Value
 * @name getPlaceholderValue Puts placeholder value
 * @return {string}
 */
function getPlaceholderValue() {
  return 'this will have fullname';
}

// eslint-disable-next-line import/prefer-default-export
export { getFullName, getPlaceholderValue };
