# Change Log

All notable changes to the "write-assist-ai" extension will be documented in this file.

## [Unreleased]

--

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
