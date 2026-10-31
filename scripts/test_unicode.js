const s = `\u{1F30D}\u{FE0E} 02:05:44 31.10.26 MSK`;
console.log(s);
console.log('длина:', s.length);
console.log('кодпоинты:', [...s].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' '));
