import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface UniqueNoteFromSelectionSettings {
	folderPath: string;
}

const DEFAULT_SETTINGS: UniqueNoteFromSelectionSettings = {
	folderPath: "/inbox",
};

export default class UniqueNoteFromSelectionPlugin extends Plugin {
	settings: UniqueNoteFromSelectionSettings;

	async onload() {
		await this.loadSettings();

		// Register the command
		this.addCommand({
			id: "create-new-unique-note-from-selection",
			name: "Create new unique note from selection",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.createUniqueNoteFromSelection(editor, view);
			},
		});

		// Add settings tab
		this.addSettingTab(
			new UniqueNoteFromSelectionSettingTab(this.app, this),
		);
	}

	onunload() {
		// Nothing specific to clean up
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createUniqueNoteFromSelection(editor: Editor, view: MarkdownView) {
		// Get selected text
		const selectedText = editor.getSelection();

		if (!selectedText) {
			new Notice("No text selected");
			return;
		}

		// For title and filename, use only the first line of selected text
		const firstLine = selectedText.split("\n")[0].trim();

		// Generate filename
		const timestamp = this.getTimestamp();
		const sanitizedTitle = this.sanitizeTitle(firstLine);
		const filename = `${timestamp}-${sanitizedTitle}.md`;

		// Normalize folder path
		let folderPath = this.settings.folderPath;
		if (folderPath.startsWith("/")) {
			folderPath = folderPath.substring(1);
		}
		if (folderPath.endsWith("/")) {
			folderPath = folderPath.substring(0, folderPath.length - 1);
		}

		try {
			// Make sure folder exists
			if (folderPath) {
				await this.ensureFolderExists(folderPath);
			}

			// Create file path
			const filePath = folderPath
				? `${folderPath}/${filename}`
				: filename;

			// Create file content
			const content = this.createFileContent(firstLine);

			// Create file
			await this.app.vault.create(filePath, content);

			// Replace selection with link
			const linkText = `[${selectedText}](${filePath})`;
			editor.replaceSelection(linkText);

			// Open the new file
			const newFile = this.app.vault.getAbstractFileByPath(filePath);
			if (newFile) {
				await this.app.workspace.getLeaf().openFile(newFile);
			}

			new Notice(`Created new note: ${filename}`);
		} catch (error) {
			console.error("Error creating new file from selection:", error);
			new Notice(`Error creating new file: ${error.message}`);
		}
	}

	getTimestamp(): string {
		const now = new Date();
		return [
			now.getFullYear(),
			(now.getMonth() + 1).toString().padStart(2, "0"),
			now.getDate().toString().padStart(2, "0"),
			now.getHours().toString().padStart(2, "0"),
			now.getMinutes().toString().padStart(2, "0"),
			now.getSeconds().toString().padStart(2, "0"),
		].join("");
	}

	sanitizeTitle(title: string): string {
		// Convert to lowercase, remove special characters, replace spaces with underscores
		return title
			.toLowerCase()
			.replace(/[^\w\s]/g, "")
			.replace(/\s+/g, "_");
	}

	async ensureFolderExists(folderPath: string) {
		// Check if folder exists, create if it doesn't
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	createFileContent(title: string): string {
		// Format date as "YYYY-MM-DD HH:mm:ss" for frontmatter
		const now = new Date();
		const formattedDate = [
			now.getFullYear(),
			"-",
			(now.getMonth() + 1).toString().padStart(2, "0"),
			"-",
			now.getDate().toString().padStart(2, "0"),
			" ",
			now.getHours().toString().padStart(2, "0"),
			":",
			now.getMinutes().toString().padStart(2, "0"),
			":",
			now.getSeconds().toString().padStart(2, "0"),
		].join("");

		return `---
title: ${title}
date created: ${formattedDate}
date modified: ${formattedDate}
tags: []
note_type:
  - other
---

# ${title}`;
	}
}

class UniqueNoteFromSelectionSettingTab extends PluginSettingTab {
	plugin: UniqueNoteFromSelectionPlugin;

	constructor(app: App, plugin: UniqueNoteFromSelectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "New File from Selection Settings",
		});

		new Setting(containerEl)
			.setName("Default folder path")
			.setDesc(
				"Enter the path where new files should be created (default: /inbox)",
			)
			.addText((text) =>
				text
					.setPlaceholder("/inbox")
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						this.plugin.settings.folderPath = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
