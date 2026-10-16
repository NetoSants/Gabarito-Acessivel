(function (root) {
  'use strict';

  var U = root.OMR.utils;
  var mm = U.mm;
  var MAX_READ_DIM = 2200;

  /* ---------------- Folha de gabarito (gerador) ---------------- */

  function bubble(cx, cy, d, label, extraClass) {
    var node = U.el('div', {
      class: 'bubble' + (extraClass ? ' ' + extraClass : ''),
      style: U.abs({ left: mm(cx - d / 2), top: mm(cy - d / 2), width: mm(d), height: mm(d) })
    });
    if (label !== undefined && label !== null) node.appendChild(U.el('span', { text: String(label) }));
    return node;
  }

  function textBox(item) {
    var node = U.el('div', {
      class: 'field',
      style: U.abs({ left: mm(item.x), top: mm(item.y), width: mm(item.width), height: mm(item.height) })
    });
    node.appendChild(U.el('span', { class: 'field-label', text: item.label }));
    return node;
  }

  function renderHeader(template) {
    var frag = document.createDocumentFragment();
    var header = template.header;
    var title = U.el('div', {
      class: 'sheet-title',
      text: header.title.text,
      style: U.abs({ top: mm(header.title.y), left: '0', width: mm(template.page.width) })
    });
    title.style.fontSize = mm(header.title.size);
    frag.appendChild(title);
    header.fields.forEach(function (f) { frag.appendChild(textBox(f)); });
    var ins = header.instructions;
    frag.appendChild(U.el('div', {
      class: 'instructions',
      text: ins.text,
      style: U.abs({ left: mm(ins.x), top: mm(ins.y), width: mm(ins.width), height: mm(ins.height) })
    }));
    return frag;
  }

  function renderProva(template) {
    var frag = document.createDocumentFragment();
    var prova = template.prova;
    if (!prova || !prova.enabled) return frag;
    var box = prova.box;
    frag.appendChild(U.el('div', { class: 'prova-box', style: U.abs({ left: mm(box.x), top: mm(box.y), width: mm(box.width), height: mm(box.height) }) }));
    frag.appendChild(U.el('div', { class: 'prova-title', text: prova.label, style: U.abs({ left: mm(box.x), top: mm(box.y + 1), width: mm(box.width) }) }));
    prova.groups.forEach(function (group) {
      group.bubbles.forEach(function (b) { frag.appendChild(bubble(b.x, b.y, prova.bubbleDiameter, b.value, 'bubble-small')); });
    });
    return frag;
  }

  function renderGrid(template) {
    var frag = document.createDocumentFragment();
    template.columns.forEach(function (col) {
      var bar = col.headerBar;
      frag.appendChild(U.el('div', { class: 'column-bar', text: col.label, style: U.abs({ left: mm(bar.x), top: mm(bar.y), width: mm(bar.width), height: mm(bar.height) }) }));
    });
    template.questions.forEach(function (q) {
      frag.appendChild(U.el('div', { class: 'q-number', text: ('0' + q.number).slice(-2), style: U.abs({ left: mm(q.numberX), top: mm(q.numberY - 2), width: mm(q.numberWidth), textAlign: 'right' }) }));
      q.bubbles.forEach(function (b) { frag.appendChild(bubble(b.x, b.y, template.bubbleDiameter, b.option)); });
    });
    return frag;
  }

  function renderAnchors(template) {
    var frag = document.createDocumentFragment();
    var size = template.anchor.size;
    template.anchors.forEach(function (a) {
      frag.appendChild(U.el('div', { class: 'anchor', title: a.id, style: U.abs({ left: mm(a.x - size / 2), top: mm(a.y - size / 2), width: mm(size), height: mm(size) }) }));
    });
    return frag;
  }

  function renderSheet(container, template) {
    container.innerHTML = '';
    var sheet = U.el('div', { class: 'sheet', id: 'sheet', style: 'width:' + mm(template.page.width) + ';height:' + mm(template.page.height) + ';' });
    sheet.appendChild(renderAnchors(template));
    sheet.appendChild(renderHeader(template));
    sheet.appendChild(renderProva(template));
    sheet.appendChild(renderGrid(template));
    container.appendChild(sheet);
    return sheet;
  }

  /* ---------------- Leitor OMR ---------------- */

  function initReader(template) {
    var matrix = root.OMR.exportMatrix(template);
    var video = document.getElementById('video');
    var canvas = document.getElementById('reader-canvas');
    var snap = document.getElementById('btn-snap');
    var status = document.getElementById('read-status');
    var result = document.getElementById('read-result');
    var stream = null;

    function setStatus(msg, kind) {
      status.textContent = msg;
      status.className = 'status' + (kind ? ' ' + kind : '');
    }

    function stopCamera() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      video.hidden = true;
      snap.hidden = true;
    }

    function drawToCanvas(source, sw, sh) {
      var scale = Math.min(1, MAX_READ_DIM / Math.max(sw, sh));
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      canvas.hidden = false;
    }

    function overlay(res) {
      var ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      res.bubbles.forEach(function (b) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(4, b.r), 0, Math.PI * 2);
        ctx.strokeStyle = b.marked ? '#e11' : 'rgba(0,150,0,.5)';
        ctx.stroke();
      });
      ctx.strokeStyle = '#06f';
      res.anchors.forEach(function (a) {
        ctx.beginPath();
        ctx.moveTo(a.x - 14, a.y); ctx.lineTo(a.x + 14, a.y);
        ctx.moveTo(a.x, a.y - 14); ctx.lineTo(a.x, a.y + 14);
        ctx.stroke();
      });
    }

    function readCanvas() {
      setStatus('Lendo a folha…');
      result.innerHTML = '';
      var res;
      try {
        res = root.OMR.detect(canvas, matrix);
      } catch (e) {
        setStatus('Falha ao processar a imagem: ' + e, 'error');
        return;
      }
      if (!res.ok) {
        var msgs = {
          ancoras_insuficientes: 'Não encontrei as 4 marcas de canto. Aproxime a folha e garanta que os 4 quadrados preto apareçam.',
          ancoras_quadrante: 'Enquadre a folha inteira com os 4 quadrados preto visíveis nos cantos.',
          homografia: 'Não consegui alinhar a folha. Tente uma foto mais reta e com boa luz.'
        };
        setStatus(msgs[res.reason] || ('Não foi possível ler (' + res.reason + ').'), 'error');
        root.__OMR_LAST__ = res;
        return;
      }
      overlay(res);
      renderReadResult(res);
      root.__OMR_LAST__ = res;
    }

    function renderReadResult(res) {
      var answers = res.answers || [];
      var blank = answers.filter(function (a) { return a.value === ''; }).length;
      var anul = answers.filter(function (a) { return a.value === 'X'; }).length;
      var prova = res.prova && res.prova.number !== null ? res.prova.number : null;

      setStatus('Leitura concluída.', 'ok');

      var head = U.el('div', { class: 'result-head' });
      head.appendChild(U.el('h2', { text: prova !== null ? ('Prova nº ' + prova) : 'Prova nº não identificada' }));
      head.appendChild(U.el('p', { text: answers.length + ' questões · ' + blank + ' em branco · ' + anul + ' anulada(s)' }));
      result.appendChild(head);

      var grid = U.el('div', { class: 'answer-grid' });
      answers.forEach(function (a) {
        var cls = a.value === 'X' ? 'anulada' : (a.value === '' ? 'vazia' : 'ok');
        var cell = U.el('div', { class: 'answer ' + cls, role: 'text', 'aria-label': 'Questão ' + a.q + ': ' + (a.value || 'em branco') });
        cell.appendChild(U.el('span', { class: 'answer-q', text: ('0' + a.q).slice(-2) }));
        cell.appendChild(U.el('span', { class: 'answer-v', text: a.value === '' ? '—' : a.value }));
        grid.appendChild(cell);
      });
      result.appendChild(grid);

      var actions = U.el('div', { class: 'result-actions' });
      var jsonBtn = U.el('button', { type: 'button', text: 'Baixar JSON' });
      jsonBtn.addEventListener('click', function () {
        U.download('leitura.json', JSON.stringify({ prova: prova, answers: answers }, null, 2));
      });
      var csvBtn = U.el('button', { type: 'button', text: 'Baixar CSV' });
      csvBtn.addEventListener('click', function () {
        var lines = ['questao,resposta'];
        answers.forEach(function (a) { lines.push(a.q + ',' + (a.value || '')); });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'leitura.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      actions.appendChild(jsonBtn);
      actions.appendChild(csvBtn);
      result.appendChild(actions);
    }

    document.getElementById('btn-camera').addEventListener('click', function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Câmera não suportada neste navegador.', 'error');
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
        .then(function (s) {
          stream = s;
          video.srcObject = s;
          video.hidden = false;
          snap.hidden = false;
          setStatus('Aponte para a folha e toque em “Capturar”.');
        })
        .catch(function () { setStatus('Não foi possível acessar a câmera.', 'error'); });
    });

    snap.addEventListener('click', function () {
      if (!stream) return;
      drawToCanvas(video, video.videoWidth, video.videoHeight);
      stopCamera();
      readCanvas();
    });

    document.getElementById('file-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      stopCamera();
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        drawToCanvas(img, img.naturalWidth, img.naturalHeight);
        URL.revokeObjectURL(url);
        readCanvas();
      };
      img.onerror = function () { setStatus('Não consegui abrir esse arquivo.', 'error'); };
      img.src = url;
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      stopCamera();
      canvas.hidden = true;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      result.innerHTML = '';
      setStatus('Aguardando uma folha…');
    });

    var autoScan = new URLSearchParams(location.search).get('scan');
    if (autoScan) {
      var autoImg = new Image();
      autoImg.onload = function () {
        drawToCanvas(autoImg, autoImg.naturalWidth, autoImg.naturalHeight);
        readCanvas();
      };
      autoImg.src = autoScan;
    }
  }

  /* ---------------- inicialização ---------------- */

  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
      });
    });
  }

  function init() {
    var stage = document.getElementById('stage');
    if (!stage || !root.OMR || !root.OMR.buildTemplate) return;

    var template = root.OMR.buildTemplate();
    renderSheet(stage, template);

    var btnPrint = document.getElementById('btn-print');
    if (btnPrint) btnPrint.addEventListener('click', function () { window.print(); });

    var btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        U.download('gabarito-matriz.json', JSON.stringify(root.OMR.exportMatrix(template), null, 2));
      });
    }

    initTabs();
    if (root.OMR.detect) initReader(template);

    if (new URLSearchParams(location.search).get('scan')) {
      var tabRead = document.getElementById('tab-read');
      if (tabRead) tabRead.click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.OMR = root.OMR || {};
  root.OMR.renderSheet = renderSheet;
})(typeof window !== 'undefined' ? window : this);
