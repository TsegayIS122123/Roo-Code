// src/hooks/security/uiBlocking.ts
import * as vscode from "vscode"

export type UserApprovalResult = {
	approved: boolean
	feedback?: string
	remember?: boolean
}

export class UIBlockingHandler {
	/**
	 * Show warning modal for destructive command
	 */
	static async confirmDestructiveCommand(
		command: string,
		classification: any,
		intentId?: string,
	): Promise<UserApprovalResult> {
		const message = this.formatDestructiveMessage(command, classification, intentId)

		const options: vscode.MessageOptions = {
			modal: true,
			detail: `This command was classified as: ${classification.reason}`,
		}

		const choice = await vscode.window.showWarningMessage(
			message,
			options,
			"✅ Approve Once",
			"🔄 Approve with Feedback",
			"❌ Reject",
			"⚡ Approve Always for this Intent",
		)

		switch (choice) {
			case "✅ Approve Once":
				return { approved: true }

			case "🔄 Approve with Feedback": {
				const feedback = await vscode.window.showInputBox({
					prompt: "Add context for why this command is needed (optional)",
					placeHolder: 'e.g., "Need to clean old files before build"',
				})
				return { approved: true, feedback }
			}

			case "⚡ Approve Always for this Intent": {
				// Fixed: Use showQuickPick instead of showQuickSelect
				const remember = await vscode.window.showQuickPick(
					["Yes, remember for this session", "Yes, save permanently"],
					{ placeHolder: "How long to remember this approval?" },
				)
				return {
					approved: true,
					remember: remember === "Yes, save permanently",
				}
			}

			case "❌ Reject":
			default:
				return { approved: false }
		}
	}

	/**
	 * Show scope violation modal
	 */
	static async confirmScopeViolation(
		intentId: string,
		filePath: string,
		allowedScopes: string[],
	): Promise<UserApprovalResult> {
		const message = [
			`🚫 **SCOPE VIOLATION**`,
			`Intent \`${intentId}\` attempted to modify: \`${filePath}\``,
			`Allowed scopes:`,
			...allowedScopes.map((s) => `  • ${s}`),
			"",
			"How would you like to proceed?",
		].join("\n")

		const choice = await vscode.window.showWarningMessage(
			message,
			{ modal: true },
			"🔒 Reject & Keep Scope",
			"➕ Request Scope Expansion",
			"⚡ Approve Once (Temporary)",
		)

		switch (choice) {
			case "➕ Request Scope Expansion":
				return { approved: true, feedback: "Please add this file to intent scope" }
			case "⚡ Approve Once (Temporary)":
				return { approved: true }
			case "🔒 Reject & Keep Scope":
			default:
				return { approved: false }
		}
	}

	/**
	 * Show intent evolution modal
	 */
	static async confirmIntentEvolution(
		intentId: string,
		changeType: "refactor" | "feature",
		description: string,
	): Promise<UserApprovalResult> {
		const message = [
			`🔄 **INTENT EVOLUTION DETECTED**`,
			`Intent: \`${intentId}\``,
			`Change Type: \`${changeType}\``,
			`Description: ${description}`,
			"",
			"This will update the intent documentation. Continue?",
		].join("\n")

		const choice = await vscode.window.showInformationMessage(
			message,
			{ modal: true },
			"✅ Approve",
			"📝 Add Notes",
			"❌ Reject",
		)

		switch (choice) {
			case "📝 Add Notes": {
				const notes = await vscode.window.showInputBox({
					prompt: "Add notes about this evolution",
					placeHolder: "Why is this change needed?",
				})
				return { approved: true, feedback: notes }
			}
			case "✅ Approve":
				return { approved: true }
			default:
				return { approved: false }
		}
	}

	private static formatDestructiveMessage(command: string, classification: any, intentId?: string): string {
		let message = `⚠️ **DESTRUCTIVE COMMAND DETECTED**\n\n`
		message += `Command: \`${command}\`\n`
		message += `Risk: ${classification.reason}\n`

		if (intentId) {
			message += `Intent: \`${intentId}\`\n`
		}

		if (classification.suggestedAlternative) {
			message += `\n💡 **Suggested Alternative**:\n${classification.suggestedAlternative}\n`
		}

		message += `\nThis command could potentially harm your system or codebase.`

		return message
	}
}
