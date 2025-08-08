# Write Assist AI

The WriteAssistAI extension for VSCode utilizes the OpenAI APIs (or OpenAI compatible proxies) to offer AI-powered writing assistance for markdown, LaTeX, quarto and plain text files. It comes with some default actions to rephrase the selected text, or perform tasks like tone change, summarize, expand etc. These actions are completely configurable through the extension's settings.

## 🎯 Features

This AI text assistant provides a range of writing styles for you to select from. To access these styles, and other features, simply select the text you want to rewrite in a supported file. Then, click on the Code Actions 💡 tooltip and choose the desired action. 

After a successful response from your chosen model, you'll be presented with inline actions to accept or reject the rewritten text. In case you've already changed the active editor, the response will be directly inserted into the original editor, just below the selected text.

![Extension Demo](/assets/images/WriteAssistAiDemo.gif)

Current feature list:

* Rewrite the text using different tones. You can choose from professional, casual, formal, friendly, informative, and authoritative tones.
* Rephrase selected text
* Suggest headlines for selected text
* Summarize selected text
* Expand selected text (make it verbose)
* Shorten selected text (make it concise)
* Accept or reject the rewritten text
* Support for markdown, LaTeX, quarto and plain text files

You can modify the existing actions (including their prompt), or add new ones through the extension's settings.

## ✅ Requirements

To use the extension you need to provide your own OpenAI (or OpenAI-Compatible provider) API Key.

## 🛠️ Installation

You can install the *Write Assist AI* extension from the VS Code Marketplace.

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ra-jeev.write-assist-ai)

## ⚙️ Extension Settings & File-based Configuration

You can configure Write Assist AI using either VS Code settings or project-level config files for the supported options.  
**File-based config takes precedence** if present.

### File-based Configuration

For project-specific settings, create a `.write-assist-ai/` folder at your workspace root.  
Supported files:

- `systemPrompt.md` — System prompt for the AI (Markdown, multiline, easy to edit)
- `quickFixes.json` — Quick Fix actions (JSON array, same schema as settings)
- `rewriteOptions.json` — Rewrite actions (JSON array, same schema as settings)

If these files exist, their contents will override the corresponding VS Code settings for your project.

> [!NOTE]
> - File-based configuration is only available for the above settings.
> - Not all extension settings are supported via file-based config.
> - Also, file-based config does not support language-specific overrides—unlike VS Code settings, which allow you to set different values per language.

#### Generating Config Files

You can generate these files with default values using the following commands from the Command Palette:

- **Write Assist AI: Generate System Prompt File**
- **Write Assist AI: Generate Quick Fixes File**
- **Write Assist AI: Generate Rewrite Options File**

If a file already exists, you’ll be prompted before overwriting.

#### Example: `systemPrompt.md`

```markdown
You are a helpful assistant. Your job is to perform the tasks related to rewriting text inputs given by the user.
...
...
```

#### Example: `quickFixes.json`

```json
[
  {
    "title": "Rephrase the selected text",
    "description": "Rephrases the selected text",
    "prompt": "Rephrase the given text and make the sentences more clear and readable."
  }
]
```

#### Example: `rewriteOptions.json`

```json
[
  {
    "title": "Change to professional tone",
    "description": "Changes the selected text's tone to professional",
    "prompt": "Make the given text better and rewrite it in a professional tone."
  }
]
```

### VS Code Settings

If no file-based config is present, or for settings that aren't supported with file-based config, the extension uses VS Code settings as described below:

* `writeAssistAi.maxTokens`: Maximum number of tokens to use for each OpenAI API call. The default is `4096`.
* `writeAssistAi.temperature`: Temperature value to use for the API calls. The default is `0.3`.
* `writeAssistAi.openAi.model`: The OpenAI model to use. The default is `gpt-5`.
* `writeAssistAi.openAi.customModel`: To use a custom model, select `custom` from the `writeAssistAi.openAi.model` dropdown menu, and enter your model name here.
* `writeAssistAi.openAi.proxyUrl`: To use a proxy for AI calls or to connect with an OpenAI-compatible AI provider (such as `Ollama`, `Groq` etc.), set this to your preferred value. If you choose a different provider, you will also need to update the API Key and specify the custom model you wish to use.
* `writeAssistAi.systemPrompt`: Sets a common system prompt to be used with LLM API calls. You can also configure language-specific system prompts using VS Code settings (e.g., @lang:markdown Write Assist AI). **Note:** File-based config (systemPrompt.md) does not support language-specific overrides.
* `writeAssistAI.useAcceptRejectFlow`: When enabled, the original and rewritten text are shown one below the other, with options to accept or reject the rewritten version. If disabled, the rewritten text is automatically inserted into the editor enclosed within the configured `writeAssistAi.separatorText`. By default, this is set to `true`.
* `writeAssistAI.separatorText`: This option allows you to define the separator text that surrounds the output generated by the AI. By default, it is set to '*' repeated 32 times. If you prefer to remove the separators, you can do so by setting this option to an empty string.
* `writeAssistAi.quickFixes`: Sets the actions that show up in the editor's tooltip menu under `Quick Fix` section. This is also configurable per language in VS Code settings, but file-based config (quickFixes.json) does not support language-specific overrides.
* `writeAssistAi.rewriteOptions`: Sets the commands that show up in the editor's tooltip menu under `Rewrite` section. This is also configurable per language in VS Code settings, but file-based config (rewriteOptions.json) does not support language-specific overrides.

In addition, you need to set your `OpenAI API Key` (or the OpenAI-Compatible provider's API Key) in the `Command Palette` under `Write Assist AI` category. If not configured already, you can also set it when you use the extension for the first time. Your key will be securely stored in VSCode's `secretStorage` for safety.

## Using Alternative OpenAI-Compatible Providers

To utilize other OpenAI-compatible providers (such as [`Ollama`](https://ollama.com/blog/openai-compatibility), [`Groq`](https://console.groq.com/docs/openai) etc.), follow these steps:

1. Configure the correct **OpenAI compatible base URL** by adjusting the `writeAssistAi.openAi.proxyUrl` setting.
2. Enter the API Key for your chosen provider using the command palette.
3. Change the `writeAssistAi.openAi.model` setting to "custom" and specify the desired model name in the `writeAssistAi.openAi.customModel` setting.

Example configuration for using `Ollama`:

```json
{
  "writeAssistAi.openAi.proxyUrl": "http://localhost:11434/v1",
  "writeAssistAi.openAi.model": "custom",
  "writeAssistAi.openAi.customModel": "llama3.2"
}
```
The API Key for `Ollama` can be any text, say `ollama` itself.

Once you've completed these steps, you'll be ready to use the alternative provider.

## Creating New Actions

You can now define actions either in your workspace config files (explained above) or in VS Code settings. Both `writeAssistAi.quickFixes` and `writeAssistAi.rewriteOptions` use the same **JSON Schema** to define actions. You can edit or remove existing actions, or create a new one by adding an action object.

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

To specify actions for a specific language, place the actions within the corresponding language configuration block. For example, to ensure that the action *"Translate into French"* only applies to *markdown* files, you can do the following in your `settings.json`:

```json
{
  "[markdown]": {
    // other settings
    "writeAssistAi.quickFixes": [
      // ...
      {
        "title": "Translate into French",
        "description": "Translates the selected text into French",
        "prompt": "Translate the given text into French."
      },
      // ...
    ]
  }
}
```

> [!NOTE]
> Default actions are activated only when no action has been specified for a supported language. If you have defined specific actions for a particular language, only those actions will be visible for that language.

## 🐛 Known Issues

--

## 🚀 Release Notes

### v0.7.0

#### Added

* Support for file-based configuration (#29):  
  - `.write-assist-ai/systemPrompt.md` – system prompt text
  - `.write-assist-ai/quickFixes.json` – quick fix actions
  - `.write-assist-ai/rewriteOptions.json` – rewrite actions
  - Commands to generate these files with default values
* File-based configuration **now takes precedence** over VS Code settings

#### Fixed

* Compatibility issue where newer models do not support `max_tokens` / `temperature` settings (#30)

#### Updated

* Improved error handling for the custom model setting (#27)
* Updated OpenAI model list and set default to `gpt-5`
* Default `max_tokens` increased to 4096
* **README** updated with usage instructions for file-based configuration

### v0.6.2

#### Added

* Option to enable/disable the inline accept/reject flow for AI suggestions (#28)

### v0.6.1

#### Fixed

* Added explicit support for `mdx` files (#25)

#### Updated

* Updated README with Ollama setup instructions (#26)

### v0.6.0

#### Added

* Support for inline accept/reject of the AI suggestions with git diff like interface (#23)
* If active editor is changed while waiting for the AI response, the rephrased text is directly inserted into the correct editor

#### Fixed

* Fixed the issue of inserting the rephrased text into the wrong editor if active editor is changed while waiting for the AI response (#24)

#### Updated

* New demo gif for the extension showing the inline accept/reject feature
* Updated the README with the new feature

### v0.5.1

#### Fixed

* Added explicit support for Quarto files (The official Quarto extension registers a new languageId, so this extension stopped working with it).

#### Changed

* Moved from Webpack to esbuild for building the extension

### v0.5.0

#### Added

* Option to set a `proxyURL` (`baseURL`) to the OpenAI calls
* `gpt-4o-mini` model to the selection dropdown
* Option to set/remove the separator text around AI response

#### Fixed

* `CodeActions` stopped showing if user didn't enter the API Key

### v0.4.1

#### Added

* `gpt-4o` model, and made it the default model

### v0.4.0

#### Added

* Language specific configuration capability for System Prompts, QuickFix Actions & RewriteOptions.

#### Fixed

* OpenAI config changes take effect immediately without a reload.

## 📜 Changelog

To check the complete changelog [click here](/CHANGELOG.md)

## 📋 LICENSE

This extension is licensed under the [MIT License](/LICENSE)
