# Write Assist AI

WriteAssistAI is a VSCode extension that leverages OpenAI APIs to provide users with AI-assisted writing capabilities for their markdown / plain text files. This extension enables users to rephrase, summarize, or expand existing texts. It can also suggest short headlines for the selected text.

## Features

This AI text assistant offers a variety of writing styles to choose from. To access these styles, or other features, select the desired text in your markdown/text files, click on the Code Actions bulb tooltip, and then click on the desired action.

![Extension Demo](/assets/images/WriteAssistAiDemo.gif)

Below is the available feature list:

* Rewrite text in various tones. Available tones: professional, casual, formal, friendly, informative, authoritative
* Rephrase selected text
* Suggest headlines for selected text
* Summarize selected text
* Expand selected text (make it verbose)
* Shorten selected text (make it concise)

## Requirements

To use the extension you need to provide your own OpenAI API Key in the VSCode settings.

## Extension Settings

It exposes the following settings:

* `writeAssistAi.openAiApiKey`: Your Open AI API Key.
* `writeAssistAi.maxTokens`: Maximum number of tokens to use for each Open AI API call. Default is 1200.

## Known Issues

--

## Release Notes

### 0.0.10

#### Fixed

* The issue of failing API calls
  
#### Changed

* The base OpenAI model from `text-davinci-003` to `gpt-3.5-turbo-instruct`

#### Added

* Better error messaging in case of API errors

### 0.0.9

Update the demo gif

### 0.0.8

#### Added

* Support for plain text files
* One new rewrite tone, authoritative
* More actions
  * Rephrase text
  * Suggest headlines
  * Summarize selection
  * Expand selection (Make text verbose)
  * Shorten selection (Make text concise)

### 0.0.7

Changing the API Key type to String

### 0.0.6

* Correct the extension configuration Id
* Update README and add extension demo gif
  
### 0.0.5

Update README

### 0.0.4

* Add the extension icon.
* Update changelog

### 0.0.3

Remove the browser field from webpack

### 0.0.2

Changing the environment to node

### 0.0.1

Initial release of WriteAssistAI

**Enjoy!**
