export function submitSuccess(e, form) {
  const { payload } = e;
  if (payload.body.redirectUrl) {
    window.location.href = encodeURI(payload.body.redirectUrl);
  } else if (payload.body.thankYouMessage) {
    let thankYouMessage = form.querySelector('.form-message.success-message');
    if (!thankYouMessage) {
      thankYouMessage = document.createElement('div');
      thankYouMessage.className = 'form-message success-message';
    }
    thankYouMessage.innerHTML = payload.body.thankYouMessage;
    form.prepend(thankYouMessage);
    thankYouMessage.scrollIntoView({ behavior: 'smooth' });
    e.target.dispatch({ type: 'reset' });
  }
}

export function submitFailure(e, form) {
  let errorMessage = form.querySelector('.form-message.error-message');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'form-message error-message';
  }
  errorMessage.innerHTML = 'Some error occured while submitting the form'; // TODO: translation
  form.prepend(errorMessage);
  errorMessage.scrollIntoView({ behavior: 'smooth' });
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}
