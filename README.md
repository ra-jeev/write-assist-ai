# Write Assist AI

The WriteAssistAI extension for VSCode utilizes OpenAI APIs to offer AI-powered writing assistance for markdown, LaTeX and plain text files. It comes with some default actions to rephrase selected text, or perform tasks like tone change, summarize, expand etc. These actions are completely configurable through the extension's settings.

## 🎯 Features

This AI text assistant provides a range of writing styles for you to select from. To access these styles, and other features, simply select the text you want to rewrite in a supported file. Then, click on the Code Actions 💡 tooltip and choose the desired action.

![Extension Demo](/assets/images/WriteAssistAiDemo.gif)

Current feature list:

* Rewrite the text using different tones. You can choose from professional, casual, formal, friendly, informative, and authoritative tones.
* Rephrase selected text
* Suggest headlines for selected text
* Summarize selected text
* Expand selected text (make it verbose)
* Shorten selected text (make it concise)

You can modify the existing actions (including their prompt), or add new ones through the extension's settings.

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
* `writeAssistAi.systemPrompt`: Sets a common system prompt to be used with LLM API calls.
* `writeAssistAi.quickFixes`: Sets the actions that show up in the editor's tooltip menu under `Quick Fix` section.
* `writeAssistAi.rewriteOptions`: Sets the commands that show up in the editor's tooltip menu under `Rewrite` section. 

In addition, you need to set your `OpenAI API Key` in the `Command Palette` under `Write Assist AI` category. If not configured already, you can also set it when you use the extension for the first time. Your key will be securely stored in VSCode's `secretStorage` for safety.

## Creating New Actions

Both `writeAssistAi.quickFixes` and `writeAssistAi.rewriteOptions` use the same **JSON Schema** to define actions. You can edit or remove existing actions, or create a new one by adding an action object.

For instance, you can include a new `Quick Fix` action in your `settings.json` file to translate the selected text to French.

```json
"writeAssistAi.quickFixes": [
  // ...
  {
    "title": "Translate into French",
    "description": "Translates the selected text into French",
    "prompt": "Translate the given text into French."
  },
  // ...
]
```

## 🐛 Known Issues

--

## 🚀 Release Notes

### v0.3.0

#### Added

* A new command in the `Command Palette` to set/reset the OpenAI API Key
* A common `system prompt` config for use with the LLM calls
* Dynamically configurable `Quick Fix` and `Rewrite` actions
* Use of `v1/chat/completions` endpoint of `OpenAI`

#### Fixed

* [API response display issue](https://github.com/ra-jeev/write-assist-ai/issues/9) while setting the API Key

#### Removed

* Use of legacy `v1/completions` endpoint of `OpenAI`

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
