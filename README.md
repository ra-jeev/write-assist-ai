# Write Assist AI

The WriteAssistAI extension for VSCode utilizes OpenAI APIs to offer AI-powered writing assistance for markdown, LaTeX and plain text files. This extension allows users to rephrase, summarize, or expand their current text, as well as provide suggestions for short headlines for selected text.

## 🎯 Features

This AI text assistant provides a range of writing styles for you to select from. To access these styles, as well as other features, simply select the text you want to rewrite in a supported file. Then, click on the Code Actions 💡 tooltip and choose the desired action.

![Extension Demo](/assets/images/WriteAssistAiDemo.gif)

Current feature list:

* Rewrite the text using different tones. You can choose from professional, casual, formal, friendly, informative, and authoritative tones.
* Rephrase selected text
* Suggest headlines for selected text
* Summarize selected text
* Expand selected text (make it verbose)
* Shorten selected text (make it concise)

## ✅ Requirements

To use the extension you need to provide your own OpenAI API Key.

## 🛠️ Installation

You can install the *Write Assist AI* extension from the VS Code Marketplace.

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ra-jeev.write-assist-ai)

## ⚙️ Extension Settings

It exposes the following settings:

* `writeAssistAi.maxTokens`: Maximum number of tokens to use for each Open AI API call. The default is `1200`.
* `writeAssistAi.temperature`: Temperature value to use for the API calls. The default is `0.3`.
* `writeAssistAi.openAi.model`: The OpenAI model to use. The default is `gpt-3.5-turbo-instruct`.
* `writeAssistAi.openAi.customModel`: To use a custom model, select `custom` from the `writeAssistAi.openAi.model` dropdown menu, and enter your model name here.

In addition to the settings mentioned above, you will need to provide your `OpenAI API Key` when you first use the extension (or later, if you have not already provided a key). This key will be stored securely in VSCode's `secretStorage` to ensure its safety.

## 🐛 Known Issues

* #9

## 🚀 Release Notes

### v0.2.0

#### Added

* Configurable temperature and model (with custom option) setting
* Runtime prompt for getting the OpenAI API Key from the user

#### Security

* Store the OpenAI API Keys in `secretStorage` for enhanced security

#### Removed

* Existing setting for OpenAI API Key, and move any saved keys to `secretStorage`

### v0.1.0

#### Added

* Support for TeX/LaTeX files.

### v0.0.10

#### Fixed

* The issue of failing API calls
  
#### Changed

* The base OpenAI model from `text-davinci-003` to `gpt-3.5-turbo-instruct`

#### Added

* Better error messaging in case of API errors

### v0.0.9

Update the demo gif

## 📜 Changelog

To check the complete changelog [click here](/CHANGELOG.md)

## 📋 LICENSE

This extension is licensed under the [MIT License](/LICENSE)
