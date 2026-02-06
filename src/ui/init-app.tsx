/**
 * Ink-based Init UI App
 * Interactive project initialization wizard
 */

import { Box, render, Text, useApp, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { Banner, colors } from "./components.js";

interface InitStep {
	id: string;
	title: string;
	description: string;
	options?: string[];
	input?: boolean;
	validate?: (value: string) => boolean;
}

interface InitAppProps {
	onComplete: (config: Record<string, string>) => void;
	onCancel?: () => void;
}

const steps: InitStep[] = [
	{
		id: "structure",
		title: "Project Structure",
		description: "How are your translation files organized?",
		options: [
			"directory (locales/en/common.json)",
			"file (i18n/en.json)",
			"suffix (messages.en.json)",
		],
	},
	{
		id: "sourceLang",
		title: "Source Language",
		description: "What is your source language code? (e.g., en, en-US)",
		input: true,
		validate: (value) => value.length >= 2,
	},
	{
		id: "targetLangs",
		title: "Target Languages",
		description:
			"Enter target language codes, comma-separated (e.g., pt-BR, es, fr)",
		input: true,
		validate: (value) => value.length >= 2,
	},
	{
		id: "i18nPath",
		title: "Translations Path",
		description:
			"Where are your translation files located? (e.g., ./locales, ./i18n)",
		input: true,
		validate: (value) => value.startsWith("./") || value.startsWith("/"),
	},
];

const InitApp: React.FC<InitAppProps> = ({ onComplete, onCancel }) => {
	const { exit } = useApp();
	const [currentStep, setCurrentStep] = useState(0);
	const [config, setConfig] = useState<Record<string, string>>({});
	const [inputValue, setInputValue] = useState("");
	const [selectedOption, setSelectedOption] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const stepOrDefault = steps[currentStep] ?? steps[0];
	const step = stepOrDefault as InitStep;

	useEffect(() => {
		if (completed) {
			onComplete(config);
			setTimeout(() => exit(), 500);
		}
	}, [completed, config, onComplete, exit]);

	useInput((input, key) => {
		if (key.escape) {
			onCancel?.();
			exit();
			return;
		}

		if (step.input) {
			if (key.return) {
				if (step.validate && !step.validate(inputValue)) {
					setError("Invalid input. Please try again.");
					return;
				}

				setConfig((prev) => ({ ...prev, [step.id]: inputValue }));
				setInputValue("");
				setError(null);

				if (currentStep < steps.length - 1) {
					setCurrentStep((prev) => prev + 1);
				} else {
					setCompleted(true);
				}
			} else if (key.backspace || key.delete) {
				setInputValue((prev) => prev.slice(0, -1));
				setError(null);
			} else if (!key.ctrl && !key.meta && input) {
				setInputValue((prev) => prev + input);
				setError(null);
			}
		} else if (step.options) {
			if (key.upArrow) {
				setSelectedOption((prev) =>
					prev > 0 ? prev - 1 : (step.options?.length ?? 1) - 1,
				);
				setError(null);
			} else if (key.downArrow) {
				setSelectedOption((prev) =>
					prev < (step.options?.length ?? 1) - 1 ? prev + 1 : 0,
				);
				setError(null);
			} else if (key.return) {
				const selected = step.options[selectedOption] ?? "";
				setConfig((prev) => ({
					...prev,
					[step.id]: selected.split(" ")[0] ?? "",
				}));

				if (currentStep < steps.length - 1) {
					setCurrentStep((prev) => prev + 1);
					setSelectedOption(0);
				} else {
					setCompleted(true);
				}
			}
		}
	});

	const progress = `${currentStep + 1}/${steps.length}`;

	return (
		<Box flexDirection="column" padding={1}>
			<Banner />

			<Box marginBottom={1}>
				<Text backgroundColor={colors.blue} color="white" bold>
					{` Project Setup ${progress} `}
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				<Text bold color={colors.cyan}>
					{step.title}
				</Text>
				<Text dimColor>{step.description}</Text>
			</Box>

			{step.input && (
				<Box>
					<Text>{">"} </Text>
					<Text color={colors.yellow}>{inputValue}</Text>
					<Text color={colors.cyan}>█</Text>
				</Box>
			)}

			{step.options && (
				<Box flexDirection="column">
					{step.options.map((option, index) => (
						<Box key={option}>
							<Text>{index === selectedOption ? "> " : "  "}</Text>
							<Text
								color={index === selectedOption ? colors.cyan : colors.gray}
								bold={index === selectedOption}
							>
								{option}
							</Text>
						</Box>
					))}
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<Text color={colors.red}>✗ {error}</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text dimColor>Press ESC to cancel • Enter to confirm</Text>
				{step.options && <Text dimColor> • ↑↓ to navigate</Text>}
			</Box>
		</Box>
	);
};

// Function to run the init wizard
export async function runInitWizard(): Promise<Record<string, string> | null> {
	return new Promise((resolve) => {
		const { waitUntilExit } = render(
			<InitApp
				onComplete={(config) => {
					resolve(config);
				}}
				onCancel={() => {
					resolve(null);
				}}
			/>,
		);

		waitUntilExit().then(() => {
			resolve(null);
		});
	});
}

export { InitApp };
