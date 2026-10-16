(function (root) {
  'use strict';

  function mm(value) {
    return (Math.round(value * 1000) / 1000) + 'mm';
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'style') node.setAttribute('style', attrs[key]);
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function abs(styles) {
    return 'position:absolute;' + Object.keys(styles).map(function (k) {
      return k + ':' + styles[k] + ';';
    }).join('');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  root.OMR = root.OMR || {};
  root.OMR.utils = { mm: mm, el: el, abs: abs, download: download };
})(typeof window !== 'undefined' ? window : this);
