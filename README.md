# Gabarito Acessível — Leitor OMR no navegador

Leitura óptica de marcas (OMR) e correção de gabaritos **100% no navegador** (sem servidor),
com suporte a **câmera do celular** ou **envio de foto**. Feito para as avaliações diagnósticas do
Ensino Médio (SAEPE / SAEB) da **GRE Metropolitana Norte**.

O objetivo é corrigir folhas rapidamente usando a infraestrutura que a escola já tem
(celular, multifuncional), com **custo zero** e **custo cognitivo baixo**. A leitura é
determinística — visão computacional sobre **coordenadas fixas + densidade de pixels** —
sem modelos generativos e sem “adivinhar” círculos.

Demo: publique este repositório no **GitHub Pages** (o site é estático).

## Como usar

No topo há um **seletor de modelo**:

- **Novo (com âncoras)** — folha A4 redesenhada, com 4 marcas preto nos cantos. Imprime e lê.
- **Oficial (Novo_gabarito.pdf)** — reproduz *exatamente* a folha que a escola já usa
  (sem âncoras; o alinhamento é feito pela moldura). Imprime e lê.

1. Escolha o modelo e, na aba **Gerar folha**, clique em **Imprimir folha (A4, 100%)**.
   - Imprima em **escala real (100%)**, sem “ajustar à página”, em papel A4.
   - O botão **Exportar matriz (JSON)** gera o mapa de coordenadas das 260 bolinhas
     (usado pela leitura e por integrações futuras).
2. O aluno preenche as bolinhas com caneta preta/azul.
3. Na aba **Ler gabarito**, use **Usar câmera** (foto ao vivo) ou **Enviar foto**.
   - No modelo **novo**, as 4 marcas de canto precisam aparecer no enquadramento.
   - No modelo **oficial**, basta a folha inteira com a moldura preta visível e fundo claro.
4. O app corrige a perspectiva, lê as 52 respostas (e o **Nº da prova**, quando a folha tem esse campo)
   e mostra o resultado, com botões **Baixar JSON** e **Baixar CSV**.

## Como funciona (pipeline)

1. **Folhas**
   - *Novo*: A4 210×297 mm, **4 âncoras preto 10×10 mm** nos cantos, 260 bolinhas Ø 5 mm
     em 2 colunas (Português Q01–26 / Matemática Q27–52) e **Nº da prova** como campo OMR
     (dezena 0–5 + unidade 0–9), legível por máquina em vez de manuscrito.
   - *Oficial*: geometria extraída do `Novo_gabarito.pdf` — moldura (9,99, 9,99)–(199,98, 262,97) mm,
     260 bolinhas Ø 4,868 mm, 10 colunas × 26 linhas, letra dentro do círculo, cabeçalho e caixa de
     instruções. Não tem âncoras nem campo de Nº de prova.
2. **Matriz de coordenadas** — o gerador calcula a posição (X, Y) em mm de *cada* bolinha
   e exporta em JSON. É essa matriz que o leitor sobrepõe na imagem — nada é estimado.
3. **Leitura**
   - **Alinhamento**: `anchors` (modelo novo) localiza os 4 quadrados preto e resolve a homografia;
     `frame` (modelo oficial) usa a caixa dos pixels escuros, que coincide com a moldura da página.
   - Projeta as ROIs das bolinhas sobre a imagem normalizada;
   - Calcula a **densidade de pixels** `D` em cada ROI. `D ≥ 0.45` ⇒ alternativa marcada;
   - Lógica: 0 marcas → vazio; 1 marca → letra; >1 marcas → anulada (`X`).

## Estrutura

```
index.html                 # App (abas: Gerar folha / Ler gabarito)
css/styles.css             # Layout das folhas (mm reais) + UI do leitor
js/utils.js                # utilidades (formatação mm, download, DOM)
js/app.js                  # orquestra as abas, os dois modelos e o leitor
js/detector.js             # motor OMR: âncoras/moldura, homografia, densidade
src/core/template.js       # modelo novo + geração da matriz de coordenadas
src/core/template-legacy.js# modelo oficial (geometria do Novo_gabarito.pdf)
tests/detect.html          # harness do detector (modelo novo)
tests/detect-legacy.html   # harness do detector (modelo oficial)
tests/sheet-preview.html   # render só da folha, para comparação geométrica
tests/fixtures/            # scan sintético de exemplo
```

## Testes

**Modelo novo** — scan sintético (folha gerada → marcada com gabarito conhecido → com perspectiva,
brilho e ruído). Resultado: **52/52 respostas + Nº da prova 42**.

**Modelo oficial** — validado em duas frentes contra o `Novo_gabarito.pdf`:

- *Gerador*: a folha que o app desenha foi comparada pixel a pixel com o PDF impresso.
  Moldura idêntica e, nas **260 bolinhas**, desvio médio 0,00 mm / máximo 0,15 mm.
- *Leitor*: sobre o scan de um gabarito preenchido, **52/52** respostas, `mode: frame`, 0 anuladas.

Como rodar (precisa de um servidor local — `file://` deixa o canvas “tainted”):

```powershell
python -m http.server 8137
# modelo novo:
#   http://127.0.0.1:8137/index.html?scan=tests/fixtures/scan_photo.jpg
# modelo oficial:
#   http://127.0.0.1:8137/tests/detect-legacy.html?src=<caminho-da-imagem>
```

## Status

- [x] Template novo + matriz de coordenadas (JSON)
- [x] Gerador da folha A4 imprimível em escala 100%
- [x] Motor OMR (âncoras → homografia → densidade) validado 52/52
- [x] App com câmera/upload, overlay e export (JSON/CSV)
- [x] Folha **oficial** (Novo_gabarito.pdf): gerador fiel + leitura sem âncoras (moldura)
- [x] Publicável no GitHub Pages (site estático)
- [ ] Leitura de PDF multipágina (ADF) — requer pdf.js
- [ ] Mapa de coordenadas para os outros scans legados (layout de tabela)
- [ ] Integração Google Sheets (gravação automática / análise longitudinal)

## Especificação

Geometria, regras de impressão e algoritmo estão descritos na seção **Como funciona** acima.
O briefing completo (v2) é um documento interno e **não** faz parte deste repositório.
