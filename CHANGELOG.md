# Change Log

All notable changes to the "write-assist-ai" extension will be documented in this file.

## [Unreleased]

--

## [0.7.1] - 2025-09-02

### Added

-   New setting `writeAssistAi.openAi.reasoningEffort` to control the reasoning effort for newer OpenAI models, allowing users to balance response quality with latency and cost.

### Changed

-   Improved handling of API responses that are truncated due to token limits. The extension now detects this and offers an option to retry the request without a token limit.

### Fixed

-   Fixed an issue where Code Actions would not reappear in the editor's code actions menu after a request was cancelled by the user.

## [v0.7.0] - 2025-08-08

### Added

* Support for file-based configuration (#29):  
  - `.write-assist-ai/systemPrompt.md` – system prompt text
  - `.write-assist-ai/quickFixes.json` – quick fix actions
  - `.write-assist-ai/rewriteOptions.json` – rewrite actions
  - Commands to generate these files with default values
* File-based configuration **now takes precedence** over VS Code settings

### Fixed

* Compatibility issue where newer models do not support `max_tokens` / `temperature` settings (#30)

### Updated

* Improved error handling for the custom model setting (#27)
* Updated OpenAI model list and set default to `gpt-5`
* Default `max_tokens` increased to 4096
* **README** updated with usage instructions for file-based configuration

## [v0.6.2] - 2025-07-31

### Added

* Option to enable/disable the inline accept/reject flow for AI suggestions (#28)

## [v0.6.1] - 2025-05-09

### Fixed

* Added explicit support for `mdx` files (#25)

### Updated

* Updated README with Ollama setup instructions (#26)

## [v0.6.0] - 2025-04-26

### Added

* Support for inline accept/reject of the AI suggestions with git diff like interface (#23)
* If active editor is changed while waiting for the AI response, the rephrased text is directly inserted into the correct editor

### Fixed

* Fixed the issue of inserting the rephrased text into the wrong editor if active editor is changed while waiting for the AI response (#24)

### Updated

* New demo gif for the extension showing the inline accept/reject feature
* Updated the README with the new feature

## [v0.5.1] - 2025-04-18

### Fixed

* Added explicit support for Quarto files (The official Quarto extension registers a new languageId, so this extension stopped working with it).

### Changed

* Moved from Webpack to esbuild for building the extension

## [v0.5.0] - 2024-09-16

### Added

* Option to set a `proxyURL` (`baseURL`) to the OpenAI calls
* `gpt-4o-mini` model to the selection dropdown
* Option to set/remove the separator text around AI response

### Fixed

* `CodeActions` stopped showing if user didn't enter the API Key

## [v0.4.1] - 2024-05-14

### Added

* `gpt-4o` model, and made it the default model

## [v0.4.0] - 2024-05-07

### Added

* Language specific configuration capability for System Prompts, QuickFix Actions & RewriteOptions.

### Fixed

* OpenAI config changes take effect immediately without a reload.

## [v0.3.1] - 2024-03-24

### Fixed

* Move the action prompt to user message prefix of the OpenAI API call.

## [v0.3.0] - 2024-03-16

### Added

* A new command in the `Command Palette` to set/reset the OpenAI API Key
* A common `system prompt` config for use with the LLM calls
* Dynamically configurable `Quick Fix` and `Rewrite` actions
* Use of `v1/chat/completions` endpoint of `OpenAI`

### Fixed

* [API response display issue](https://github.com/ra-jeev/write-assist-ai/issues/9) while setting the API Key

### Removed

* Use of legacy `v1/completions` endpoint of `OpenAI`

## [v0.2.0] - 2024-03-12

### Added

* Configurable temperature and model (with custom option) setting
* Runtime prompt for getting the OpenAI API Key from the user

### Security

* Store the OpenAI API Keys in `secretStorage` for enhanced security

### Removed

* Existing setting for OpenAI API Key, and move any saved keys to `secretStorage`

## [v0.1.0] - 2024-03-06

### Added

* Support for TeX/LaTeX files.

## [v0.0.10] - 2024-03-06

### Fixed

* The issue of failing API calls
  
### Changed

* The base OpenAI model from `text-davinci-003` to `gpt-3.5-turbo-instruct`

### Added

* Better error messaging in case of API errors

## [v0.0.9] - 2023-05-29

Update the demo gif

## [v0.0.8] - 2023-05-29

### Added

* Support for plain text files
* One more rewrite tone, authoritative
* More actions
  * Rephrase text
  * Suggest headlines
  * Summarize selection
  * Expand selection (Make text verbose)
  * Shorten selection (Make text concise)

## [v0.0.7] - 2023-05-24

Changing the API Key type to String

## [v0.0.6] - 2023-05-24

* Fixed the extension configuration key
* Update README and add extension demo gif

## [v0.0.5] - 2023-05-19

Update README

## [v0.0.4] - 2023-05-19

* Add the extension icon
* Update the changelog

## [v0.0.3] - 2023-05-19

* Remove the browser field from webpack

## [v0.0.2] - 2023-05-19

* Change webpack environment to node

## [v0.0.1] - 2023-05-19

* Initial release
