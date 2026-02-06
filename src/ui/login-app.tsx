/**
 * Ink-based Login UI App
 * Interactive API key input with validation
 */

import { Box, render, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useEffect, useState } from "react";
import { Banner, colors, StatusMessage } from "./components.js";

interface LoginAppProps {
	onLogin: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
	onCancel?: () => void;
}

const LoginApp: React.FC<LoginAppProps> = ({ onLogin, onCancel }) => {
	const { exit } = useApp();
	const [apiKey, setApiKey] = useState("");
	const [status, setStatus] = useState<
		"input" | "validating" | "success" | "error"
	>("input");
	const [error, setError] = useState<string | null>(null);
	const [masked, setMasked] = useState(true);

	useEffect(() => {
		if (status === "success") {
			setTimeout(() => exit(), 1500);
		}
	}, [status, exit]);

	useInput(async (input, key) => {
		if (key.escape) {
			onCancel?.();
			exit();
			return;
		}

		if (status === "input") {
			if (key.return) {
				if (apiKey.length < 10) {
					setError("API key seems too short. Please check your key.");
					return;
				}

				setStatus("validating");
				setError(null);

				try {
					const result = await onLogin(apiKey);
					if (result.success) {
						setStatus("success");
					} else {
						setStatus("error");
						setError(result.error || "Invalid API key");
					}
				} catch (_e) {
					setStatus("error");
					setError("Network error. Please try again.");
				}
			} else if (key.backspace || key.delete) {
				setApiKey((prev) => prev.slice(0, -1));
				setError(null);
			} else if (key.tab) {
				setMasked((prev) => !prev);
			} else if (!key.ctrl && !key.meta && input) {
				setApiKey((prev) => prev + input);
				setError(null);
			}
		} else if (status === "error" && (key.return || key.escape)) {
			setStatus("input");
			setApiKey("");
			setError(null);
		}
	});

	const getDisplayKey = () => {
		if (masked) {
			return "*".repeat(apiKey.length);
		}
		return apiKey;
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Banner />

			<Box marginBottom={1}>
				<Text backgroundColor={colors.blue} color="white" bold>
					{" Authentication "}
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				<Text bold color={colors.cyan}>
					Enter your BabelX API Key
				</Text>
				<Text dimColor>
					You can find your API key at https://babelx.dev/dashboard
				</Text>
			</Box>

			{status === "input" && (
				<>
					<Box>
						<Text>{">"} </Text>
						<Text color={colors.yellow}>{getDisplayKey()}</Text>
						<Text color={colors.cyan}>█</Text>
					</Box>

					<Box marginTop={1}>
						<Text dimColor>Press Tab to {masked ? "show" : "hide"} key</Text>
					</Box>
				</>
			)}

			{status === "validating" && (
				<Box>
					<Text color={colors.cyan}>
						<Spinner type="dots" /> Validating API key...
					</Text>
				</Box>
			)}

			{status === "success" && (
				<Box>
					<StatusMessage type="success" message="Successfully authenticated!" />
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<StatusMessage type="error" message={error} />
					<Text dimColor>Press Enter to try again or ESC to cancel</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text dimColor>Press ESC to cancel</Text>
			</Box>
		</Box>
	);
};

// Function to run the login UI
export async function runLoginUI(
	onLogin: (apiKey: string) => Promise<{ success: boolean; error?: string }>,
): Promise<string | null> {
	return new Promise((resolve) => {
		let enteredKey = "";

		const { waitUntilExit } = render(
			<LoginApp
				onLogin={async (apiKey) => {
					enteredKey = apiKey;
					return onLogin(apiKey);
				}}
				onCancel={() => {
					resolve(null);
				}}
			/>,
		);

		waitUntilExit().then(() => {
			resolve(enteredKey);
		});
	});
}

export { LoginApp };
