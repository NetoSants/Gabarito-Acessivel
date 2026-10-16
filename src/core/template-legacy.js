(function (root) {
  'use strict';

  var OPTIONS = ['A', 'B', 'C', 'D', 'E'];
  var PT = 25.4 / 72;

  var PAGE = { width: 210, height: 297, unit: 'mm' };

  var FRAME = { x: 9.99, y: 9.99, width: 189.99, height: 252.98 };

  var COLUMN_X = {
    left: [35.539, 51.075, 66.611, 82.148, 97.684],
    right: [125.667, 141.203, 156.739, 172.275, 187.812]
  };

  var ROWS_Y = [
    85.45, 91.758, 98.108, 104.415, 110.765, 117.073, 123.423, 129.73,
    136.08, 142.388, 148.738, 155.046, 161.396, 167.704, 174.054, 180.361,
    186.711, 193.019, 199.369, 205.676, 212.026, 218.334, 224.684, 230.992,
    237.342, 243.65
  ];

  var BUBBLE_DIAMETER = 4.868;
  var NUMBER_X = { left: 23.92, right: 114.05 };

  var TITLE = { text: 'SIMULADO - GABARITO OFICIAL', y: 54.56, size: 14.8 };

  var HEADER_LINES = [
    { x: 19.73, y: 24.6, width: 0.46, height: 26.12 },
    { x: 121.75, y: 37.89, width: 0.47, height: 12.32 },
    { x: 155.74, y: 24.6, width: 0.47, height: 25.61 },
    { x: 189.74, y: 24.6, width: 0.51, height: 26.12 },
    { x: 19.73, y: 24.6, width: 170.52, height: 0.46 },
    { x: 19.73, y: 37.42, width: 136.02, height: 0.47 },
    { x: 19.73, y: 50.21, width: 136.27, height: 0.51 },
    { x: 156.0, y: 50.21, width: 34.25, height: 0.51 }
  ];

  var INSTRUCTIONS_BOX = { x: 19.81, y: 61.89, width: 170.35, height: 7.71 };
  var INSTRUCTIONS = {
    text: 'INSTRUÇÕES: Use caneta PRETA ou AZUL. Preencha a bolinha TOTALMENTE. Não faça "X".',
    x: 33.4, y: 63.94, size: 9.2
  };

  var LABELS = [
    { text: 'Escola:', x: 22.18, y: 27.13, size: 12 },
    { text: 'Nº', x: 170.56, y: 29.94, size: 12 },
    { text: 'Nome:', x: 22.18, y: 39.96, size: 12 },
    { text: 'Turma:', x: 124.21, y: 39.96, size: 12 },
    { text: '________', x: 162.9, y: 40.31, size: 12 }
  ];

  var COLUMN_LABELS = [
    {
      index: 0, label: 'PORTUGUÊS', startQuestion: 1, endQuestion: 26,
      numberX: NUMBER_X.left, titleX: 46.57, titleY: 73.51, titleSize: 12.8,
      underline: { x: 19.73, y: 79.59, width: 80.39, height: 0.5 }
    },
    {
      index: 1, label: 'MATEMÁTICA', startQuestion: 27, endQuestion: 52,
      numberX: NUMBER_X.right, titleX: 136.06, titleY: 73.51, titleSize: 12.8,
      underline: { x: 109.86, y: 79.59, width: 80.39, height: 0.5 }
    }
  ];

  function round(v) { return Math.round(v * 1000) / 1000; }

  function buildLegacyGrid() {
    var bubbles = [];
    var questions = [];
    var blocks = [COLUMN_X.left, COLUMN_X.right];

    COLUMN_LABELS.forEach(function (col, c) {
      var xs = blocks[c];
      for (var r = 0; r < ROWS_Y.length; r++) {
        var q = col.startQuestion + r;
        var y = round(ROWS_Y[r]);
        var row = OPTIONS.map(function (opt, o) {
          var b = { q: q, option: opt, x: round(xs[o]), y: y };
          bubbles.push(b);
          return b;
        });
        questions.push({ number: q, column: c, numberX: col.numberX, numberY: y, bubbles: row });
      }
    });
    return { bubbles: bubbles, questions: questions };
  }

  function buildAnchors() {
    return [
      { id: 'TL', x: FRAME.x, y: FRAME.y, size: FRAME.width / 100 },
      { id: 'TR', x: round(FRAME.x + FRAME.width), y: FRAME.y, size: FRAME.width / 100 },
      { id: 'BL', x: FRAME.x, y: round(FRAME.y + FRAME.height), size: FRAME.width / 100 },
      { id: 'BR', x: round(FRAME.x + FRAME.width), y: round(FRAME.y + FRAME.height), size: FRAME.width / 100 }
    ];
  }

  function buildLegacyTemplate() {
    var grid = buildLegacyGrid();
    return {
      id: 'novo-gabarito-legado',
      version: 'omr-legacy-1',
      unit: 'mm',
      page: PAGE,
      alignment: 'frame',
      frame: FRAME,
      anchors: buildAnchors(),
      columns: COLUMN_LABELS,
      questions: grid.questions,
      bubbles: grid.bubbles,
      options: OPTIONS,
      bubbleDiameter: BUBBLE_DIAMETER,
      prova: null,
      header: {
        title: TITLE,
        lines: HEADER_LINES,
        labels: LABELS,
        instructions: INSTRUCTIONS,
        instructionsBox: INSTRUCTIONS_BOX
      },
      pt: PT
    };
  }

  root.OMR = root.OMR || {};
  root.OMR.buildLegacyTemplate = buildLegacyTemplate;
  root.OMR.LEGACY = {
    PAGE: PAGE,
    FRAME: FRAME,
    TITLE: TITLE,
    HEADER_LINES: HEADER_LINES,
    LABELS: LABELS,
    INSTRUCTIONS: INSTRUCTIONS,
    INSTRUCTIONS_BOX: INSTRUCTIONS_BOX,
    COLUMN_LABELS: COLUMN_LABELS,
    ROWS_Y: ROWS_Y,
    COLUMN_X: COLUMN_X,
    BUBBLE_DIAMETER: BUBBLE_DIAMETER,
    pt: PT
  };
})(typeof window !== 'undefined' ? window : this);
