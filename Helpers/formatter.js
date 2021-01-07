const phoneNumberFormatter = number => {
  // menghilangkan karakter selain angka
  let formatted = number.replace(/\D/g, '');

  // menghilangkan angka 0 di prefix
  // diganti menjadi 62 (kode ind)
  if (formatted.startsWith(0)) {
    formatted = '62' + formatted.substr(1);
  }

  if (!formatted.endsWith('@c.us')) {
    formatted += '@c.us';
  }

  return formatted;
}

module.exports = {
  phoneNumberFormatter
}
