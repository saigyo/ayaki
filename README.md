# 文木 Ayaki

A single-page browser app for exploring the structure of Japanese sentences.

Paste a Japanese sentence (or a whole paragraph) and Ayaki renders its bunsetsu-level
dependency tree as an interactive arc diagram (with a node-tree view as an alternative).
Click any part of the sentence to inspect its morphemes — part of speech (Japanese term
with English translation), reading, base form — have words or whole sentences spoken via
the Web Speech API, and jump straight to [Jisho.org](https://jisho.org) for a word or
Google Translate for a sentence.

Everything runs client-side; there is no backend. Parsing is powered by
[sasara](https://github.com/iatosh/sasara) on top of
[kuromojin](https://github.com/azu/kuromojin) /
[kuromoji.js](https://github.com/takuyaa/kuromoji.js) with the IPAdic dictionary.

*Design documents live in [`docs/superpowers/specs/`](docs/superpowers/specs/).*

## License

Ayaki itself is released under the [MIT License](LICENSE).

Ayaki builds on third-party components under their own licenses:

| Component | Use | License |
|---|---|---|
| [sasara](https://github.com/iatosh/sasara) © Satoshi Imamura | Bunsetsu dependency parser | [MIT](https://github.com/iatosh/sasara/blob/main/LICENSE) |
| sasara `model.json` | Parsing model, served as a static asset; derived from [UD Japanese-GSD](https://github.com/UniversalDependencies/UD_Japanese-GSD) (Megagon Labs) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [kuromojin](https://github.com/azu/kuromojin) © azu | Tokenizer wrapper (via sasara) | [MIT](https://github.com/azu/kuromojin/blob/master/LICENSE) |
| [kuromoji.js](https://github.com/takuyaa/kuromoji.js) © Atilika Inc. | Japanese morphological analyzer | [Apache-2.0](https://github.com/takuyaa/kuromoji.js/blob/master/LICENSE-2.0.txt) |
| IPAdic dictionary (bundled with kuromoji.js) | Morphological dictionary, served as static assets | [IPADIC license](https://github.com/takuyaa/kuromoji.js/blob/master/NOTICE.md) |

The deployed app serves the sasara model and the IPAdic dictionary files as static
assets, so the CC BY-SA 4.0 attribution/share-alike terms and the IPADIC notice apply to
redistributions of those files. The app's footer carries the same attributions.
