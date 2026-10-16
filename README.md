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

1. Abra o site. Na aba **Gerar folha**, clique em **Imprimir folha (A4, 100%)**.
   - Imprima em **escala real (100%)**, sem “ajustar à página”, em papel A4.
   - O botão **Exportar matriz (JSON)** gera o mapa de coordenadas das 260 bolinhas
     (usado pela leitura e por integrações futuras).
2. O aluno preenche as bolinhas com caneta preta/azul.
3. Na aba **Ler gabarito**, use **Usar câmera** (foto ao vivo) ou **Enviar foto**.
   - Enquadre a **folha inteira**, com os **4 quadrados preto** (âncoras) visíveis.
4. O app corrige a perspectiva pelas âncoras, lê as 52 respostas e o **Nº da prova**,
   e mostra o resultado (com botões **Baixar JSON** e **Baixar CSV**).

## Como funciona (pipeline)

1. **Folha (template único)** — A4 210×297 mm, escala real, com **4 âncoras preto 10×10 mm**
   nos cantos. Grade de **52 questões × 5 alternativas = 260 bolinhas** (Ø 5 mm, 3 mm de
   espaçamento), em 2 colunas (Português Q01–26 / Matemática Q27–52).
   - **Nº da prova** é um campo OMR (dezena 0–5 + unidade 0–9) — legível por máquina,
     evita número manuscrito.
2. **Matriz de coordenadas** — o gerador calcula a posição (X, Y) em mm de *cada* bolinha
   e exporta em JSON. É essa matriz que o leitor sobrepõe na imagem — nada é estimado.
3. **Leitura**
   - Localiza os centroides das 4 âncoras e calcula a **homografia** (corrige rotação/inclinação);
   - Projeta as ROIs das bolinhas sobre a imagem normalizada;
   - Calcula a **densidade de pixels** `D` em cada ROI. `D ≥ 0.45` ⇒ alternativa marcada;
   - Lógica: 0 marcas → vazio; 1 marca → letra; >1 marca → anulada (`X`).

## Estrutura

```
index.html                 # App (abas: Gerar folha / Ler gabarito)
css/styles.css             # Layout da folha (mm reais) + UI do leitor
js/utils.js                # utilidades (formatação mm, download, DOM)
js/app.js                  # orquestra as duas abas (gerador + leitor)
js/detector.js             # motor OMR: âncoras, homografia, densidade
src/core/template.js       # template + geração da matriz de coordenadas
tests/detect.html          # harness do detector (roda no Chrome headless)
tests/fixtures/            # scan de exemplo (sintético) para validar
```

## Testes

O motor é validado contra um scan sintético (folha gerada → marcada com gabarito conhecido →
com perspectiva, brilho e ruído simulados). Resultado atual: **52/52 respostas + Nº da prova**.

- Abra `tests/detect.html` (via um servidor local, para o canvas não ser “tainted”).
- Ou, para inspeção rápida: `index.html?scan=tests/fixtures/scan_photo.jpg`.

Para regerar o scan de teste é preciso de Python com Pillow (ver histórico do projeto).
Servir localmente: `python -m http.server` na raiz do repositório.

## Status

- [x] Template otimizado + matriz de coordenadas (JSON)
- [x] Gerador da folha A4 imprimível em escala 100%
- [x] Motor OMR (âncoras → homografia → densidade) validado 52/52
- [x] App com câmera/upload, overlay e export (JSON/CSV)
- [x] Publicável no GitHub Pages (site estático)
- [ ] Leitura de PDF multipágina (ADF) — requer pdf.js
- [ ] Mapa de coordenadas para as folhas **antigas** (templates legados)
- [ ] Integração Google Sheets (gravação automática / análise longitudinal)

## Especificação

Geometria, regras de impressão e algoritmo estão descritos na seção **Como funciona** acima.
O briefing completo (v2) é um documento interno e **não** faz parte deste repositório.
