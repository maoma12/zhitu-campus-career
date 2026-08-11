# Tesseract.js language data

These files are vendored for same-origin, offline-friendly OCR. They contain
no application or user data.

- Upstream: `naptha/tessdata`
- Commit: `806cd9adc8c6e8abc11c782db1818c990576bebc` (`gh-pages`)
- Dataset: `4.0.0_best_int` (Tesseract.js default LSTM language data)
- Tesseract.js runtime used by this project: `7.0.0`
- License: Apache-2.0; see `LICENSE`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `chi_sim.traineddata.gz` | 1,718,768 | `b8a23f10c7de500891eb458a8adc9cc58ab7f242f08b7d149f5e9aea4ad5db7c` |
| `eng.traineddata.gz` | 2,952,873 | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |
| `LICENSE` | 11,357 | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |

Tesseract.js resolves language URLs as
`langPath + "/" + language + ".traineddata.gz"`. Keep both language files in
this directory and keep the default `gzip: true` behavior.
