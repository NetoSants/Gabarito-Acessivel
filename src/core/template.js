(function (root) {
  'use strict';

  var OPTIONS = ['A', 'B', 'C', 'D', 'E'];

  function round(v) {
    return Math.round(v * 1000) / 1000;
  }

  function deepMerge(target, src) {
    if (!src) return target;
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        target[k] = deepMerge(target[k] || {}, v);
      } else {
        target[k] = v;
      }
    }
    return target;
  }

  function defaultConfig() {
    return {
      version: 'omr-1',
      page: { width: 210, height: 297, unit: 'mm' },
      anchor: { size: 10, inset: 11 },
      header: {
        title: { text: 'SIMULADO - GABARITO OFICIAL', y: 23, size: 5.5 },
        fields: [
          { id: 'escola', label: 'Escola:', x: 22, y: 32, width: 104, height: 11 },
          { id: 'nome', label: 'Nome:', x: 22, y: 45, width: 104, height: 11 }
        ],
        instructions: {
          text: 'INSTRUÇÕES: use caneta PRETA ou AZUL e preencha a bolinha TOTALMENTE. Não rasure.',
          x: 22, y: 59, width: 176, height: 8
        }
      },
      grid: {
        topY: 80,
        rowsPerColumn: 26,
        bubbleDiameter: 5,
        bubbleGapX: 3,
        rowPitch: 7.3,
        numberWidth: 10,
        numberGap: 4,
        columnGutter: 16,
        headerBarHeight: 8,
        headerGap: 3
      },
      prova: {
        enabled: true,
        bubbleDiameter: 4.5,
        bubbleGapX: 2.2,
        rowGap: 2.6,
        box: { x: 130, y: 32, width: 68, height: 26 },
        groups: [
          { key: 'tens', label: 'DEZENA', values: [0, 1, 2, 3, 4, 5] },
          { key: 'units', label: 'UNIDADE', values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
        ],
        label: 'Nº DA PROVA'
      },
      columns: [
        { label: 'PORTUGUÊS', startQuestion: 1 },
        { label: 'MATEMÁTICA', startQuestion: 27 }
      ],
      options: OPTIONS
    };
  }

  function buildAnchors(cfg) {
    var s = cfg.anchor.size;
    var inset = cfg.anchor.inset;
    var p = cfg.page;
    var self = {
      TL: { x: inset + s / 2, y: inset + s / 2 },
      TR: { x: p.width - inset - s / 2, y: inset + s / 2 },
      BL: { x: inset + s / 2, y: p.height - inset - s / 2 },
      BR: { x: p.width - inset - s / 2, y: p.height - inset - s / 2 }
    };
    return ['TL', 'TR', 'BL', 'BR'].map(function (id) {
      return { id: id, x: round(self[id].x), y: round(self[id].y), size: s };
    });
  }

  function buildProva(cfg) {
    if (!cfg.prova.enabled) return null;
    var p = cfg.prova;
    var box = p.box;
    var d = p.bubbleDiameter;
    var gap = p.bubbleGapX;
    var rowHeight = d + p.rowGap;
    var totalH = p.groups.length * rowHeight;
    var firstRowY = box.y + totalH / 2 + 2.5;

    var bubbles = [];
    var groups = p.groups.map(function (def, gi) {
      var rowWidth = def.values.length * d + (def.values.length - 1) * gap;
      var firstX = box.x + (box.width - rowWidth) / 2 + d / 2;
      var cy = round(firstRowY + gi * rowHeight);
      var row = def.values.map(function (val, i) {
        var b = { group: def.key, value: val, x: round(firstX + i * (d + gap)), y: cy };
        bubbles.push(b);
        return b;
      });
      return { key: def.key, label: def.label, digits: def.values, bubbles: row, y: cy };
    });

    return {
      enabled: true,
      label: p.label,
      box: box,
      bubbleDiameter: d,
      groups: groups,
      bubbles: bubbles
    };
  }

  function buildGrid(cfg) {
    var g = cfg.grid;
    var page = cfg.page;
    var options = cfg.options;
    var perRow = options.length;

    var bubbleRun = perRow * g.bubbleDiameter + (perRow - 1) * g.bubbleGapX;
    var blockWidth = g.numberWidth + g.numberGap + bubbleRun;
    var totalWidth = cfg.columns.length * blockWidth + (cfg.columns.length - 1) * g.columnGutter;
    var left = (page.width - totalWidth) / 2;

    var columns = [];
    var questions = [];
    var bubbles = [];

    cfg.columns.forEach(function (col, c) {
      var numberX = left + c * (blockWidth + g.columnGutter);
      var bubbleStartX = numberX + g.numberWidth + g.numberGap;
      var firstCenterX = bubbleStartX + g.bubbleDiameter / 2;

      columns.push({
        index: c,
        label: col.label,
        startQuestion: col.startQuestion,
        endQuestion: col.startQuestion + g.rowsPerColumn - 1,
        numberX: round(numberX),
        bubbleStartX: round(bubbleStartX),
        blockWidth: round(blockWidth),
        headerBar: {
          x: round(numberX),
          y: round(g.topY - g.headerGap - g.headerBarHeight),
          width: round(blockWidth),
          height: g.headerBarHeight
        }
      });

      for (var r = 0; r < g.rowsPerColumn; r++) {
        var qNumber = col.startQuestion + r;
        var centerY = round(g.topY + g.bubbleDiameter / 2 + r * g.rowPitch);
        var optBubbles = options.map(function (opt, o) {
          var b = {
            q: qNumber,
            option: opt,
            x: round(firstCenterX + o * (g.bubbleDiameter + g.bubbleGapX)),
            y: centerY
          };
          bubbles.push(b);
          return b;
        });
        questions.push({
          number: qNumber,
          column: c,
          numberX: round(numberX),
          numberWidth: g.numberWidth,
          numberY: centerY,
          bubbles: optBubbles
        });
      }
    });

    return { columns: columns, questions: questions, bubbles: bubbles, blockWidth: round(blockWidth) };
  }

  function buildTemplate(userConfig) {
    var cfg = deepMerge(defaultConfig(), userConfig);
    var anchors = buildAnchors(cfg);
    var grid = buildGrid(cfg);
    var prova = buildProva(cfg);

    return {
      version: cfg.version,
      unit: cfg.page.unit,
      page: cfg.page,
      alignment: 'anchors',
      anchor: cfg.anchor,
      anchors: anchors,
      header: cfg.header,
      columns: grid.columns,
      questions: grid.questions,
      bubbles: grid.bubbles,
      options: cfg.options,
      bubbleDiameter: cfg.grid.bubbleDiameter,
      prova: prova,
      config: cfg
    };
  }

  function exportMatrix(template) {
    return {
      version: template.version,
      unit: template.unit,
      page: template.page,
      alignment: template.alignment || 'anchors',
      frame: template.frame || null,
      anchors: template.anchors,
      bubbleDiameter: template.bubbleDiameter,
      options: template.options,
      columns: template.columns.map(function (c) {
        return { index: c.index, label: c.label, startQuestion: c.startQuestion, endQuestion: c.endQuestion };
      }),
      bubbles: template.bubbles,
      prova: template.prova
        ? { enabled: true, label: template.prova.label, bubbleDiameter: template.prova.bubbleDiameter, groups: template.prova.groups, bubbles: template.prova.bubbles }
        : null
    };
  }

  root.OMR = root.OMR || {};
  root.OMR.defaultConfig = defaultConfig;
  root.OMR.buildTemplate = buildTemplate;
  root.OMR.exportMatrix = exportMatrix;
})(typeof window !== 'undefined' ? window : this);
