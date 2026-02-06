/**
 * Ink-based Translation UI App
 * Provides rich terminal interface for translation operations
 */

import { Box, render, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { Delta } from "../utils/lockfile.js";
import { Banner, colors, Stats, StatusMessage } from "./components.js";

// Types for translation items
interface TranslationItem {
	key: string;
	text: string;
	file: string;
}

interface TranslationTask {
	filePath: string;
	sourceLang: string;
	targetLang: string;
	items: TranslationItem[];
	delta: Delta;
	status: "pending" | "processing" | "completed" | "error";
	progress: number;
	error?: string;
	cached?: number;
}

interface TranslateAppProps {
	tasks: TranslationTask[];
	dryRun?: boolean;
	frozen?: boolean;
	onComplete?: (results: TranslationResult[]) => void;
}

export interface TranslationResult {
	filePath: string;
	targetLang: string;
	status: "success" | "error" | "skipped";
	translated: number;
	cached: number;
	error?: string;
}

// Main Translation App Component
const TranslateApp: React.FC<TranslateAppProps> = ({
	tasks,
	dryRun = false,
	frozen = false,
	onComplete,
}) => {
	const { exit } = useApp();
	const [currentTaskIndex, _setCurrentTaskIndex] = useState(0);
	const [completed, _setCompleted] = useState(false);
	const [results, _setResults] = useState<TranslationResult[]>([]);

	useEffect(() => {
		if (completed && onComplete) {
			onComplete(results);
			// Give time to show final state before exit
			setTimeout(() => {
				exit();
			}, 1000);
		}
	}, [completed, results, onComplete, exit]);

	useInput((_input, key) => {
		if (key.escape) {
			exit();
		}
	});

	if (tasks.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Banner />
				<StatusMessage type="info" message="No translation tasks to process." />
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Banner />

			{frozen && (
				<Box marginBottom={1}>
					<Text backgroundColor={colors.yellow} color="black" bold>
						FROZEN MODE - Validation Only
					</Text>
				</Box>
			)}

			{dryRun && (
				<Box marginBottom={1}>
					<Text backgroundColor={colors.blue} color="white" bold>
						DRY RUN - No changes will be made
					</Text>
				</Box>
			)}

			<Box flexDirection="column" marginBottom={1}>
				<Text bold>Translation Tasks:</Text>
				{tasks.map((task, index) => (
					<TaskRow
						key={`${task.filePath}-${task.targetLang}`}
						task={task}
						isActive={index === currentTaskIndex && !completed}
						isCompleted={index < currentTaskIndex || completed}
					/>
				))}
			</Box>

			{completed && (
				<Stats
					translated={results.reduce((sum, r) => sum + r.translated, 0)}
					cached={results.reduce((sum, r) => sum + r.cached, 0)}
					skipped={results.filter((r) => r.status === "skipped").length}
					failed={results.filter((r) => r.status === "error").length}
				/>
			)}

			<Box marginTop={1}>
				<Text dimColor>Press ESC to exit</Text>
			</Box>
		</Box>
	);
};

// Individual task row component
interface TaskRowProps {
	task: TranslationTask;
	isActive: boolean;
	isCompleted: boolean;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, isActive, isCompleted }) => {
	const getIcon = () => {
		if (task.status === "error") return "✗";
		if (task.status === "completed") return "✓";
		if (isActive) return <Spinner type="dots" />;
		if (isCompleted) return "✓";
		return "○";
	};

	const getColor = () => {
		if (task.status === "error") return colors.red;
		if (task.status === "completed" || isCompleted) return colors.green;
		if (isActive) return colors.cyan;
		return colors.gray;
	};

	const hasChanges =
		task.delta.added.length > 0 ||
		task.delta.updated.length > 0 ||
		task.delta.renamed.length > 0;

	return (
		<Box flexDirection="column" marginTop={1}>
			<Box>
				<Text color={getColor()}>
					{getIcon()} {task.filePath}
				</Text>
				<Text color={colors.gray}> → </Text>
				<Text color={colors.blue}>{task.targetLang}</Text>
			</Box>

			{isActive && task.status === "processing" && (
				<Box paddingLeft={2}>
					<Text dimColor>
						Processing {task.progress}/{task.items.length} items...
					</Text>
				</Box>
			)}

			{hasChanges && (
				<Box flexDirection="column" paddingLeft={2}>
					{task.delta.added.length > 0 && (
						<Text color={colors.green}>
							+ {task.delta.added.length} new keys
						</Text>
					)}
					{task.delta.updated.length > 0 && (
						<Text color={colors.yellow}>
							~ {task.delta.updated.length} updated
						</Text>
					)}
					{task.delta.renamed.length > 0 && (
						<Text color={colors.blue}>
							→ {task.delta.renamed.length} renamed
						</Text>
					)}
				</Box>
			)}

			{task.status === "error" && task.error && (
				<Box paddingLeft={2}>
					<Text color={colors.red}>{task.error}</Text>
				</Box>
			)}
		</Box>
	);
};

// Function to run the Ink UI for translation
export async function runTranslateUI(
	tasks: TranslationTask[],
	options: { dryRun?: boolean; frozen?: boolean } = {},
): Promise<TranslationResult[]> {
	return new Promise((resolve) => {
		const results: TranslationResult[] = [];

		const { waitUntilExit } = render(
			<TranslateApp
				tasks={tasks}
				dryRun={options.dryRun}
				frozen={options.frozen}
				onComplete={(finalResults) => {
					results.push(...finalResults);
					resolve(results);
				}}
			/>,
		);

		waitUntilExit().then(() => {
			resolve(results);
		});
	});
}

// Hook for managing translation state
export function useTranslationState(initialTasks: TranslationTask[]) {
	const [tasks, setTasks] = useState<TranslationTask[]>(initialTasks);
	const [currentIndex, setCurrentIndex] = useState(0);

	const updateTask = useCallback(
		(index: number, updates: Partial<TranslationTask>) => {
			setTasks((prev) => {
				const newTasks = [...prev];
				newTasks[index] = { ...newTasks[index], ...updates } as TranslationTask;
				return newTasks;
			});
		},
		[],
	);

	const nextTask = useCallback(() => {
		setCurrentIndex((prev) => Math.min(prev + 1, tasks.length - 1));
	}, [tasks.length]);

	return {
		tasks,
		currentIndex,
		currentTask: tasks[currentIndex],
		updateTask,
		nextTask,
		isComplete: currentIndex >= tasks.length - 1,
	};
}

export { TranslateApp };
export type { TranslationTask, TranslationItem };
