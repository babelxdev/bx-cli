/**
 * Ink UI components for BabelX CLI
 * React-based terminal UI components
 */

import { Box, Newline, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import type { Delta } from "../utils/lockfile.js";

// Color constants matching Lingo.dev style
const colors = {
	green: "#22c55e",
	blue: "#3b82f6",
	yellow: "#eab308",
	orange: "#f97316",
	red: "#ef4444",
	purple: "#a855f7",
	cyan: "#06b6d4",
	gray: "#6b7280",
};

interface BannerProps {
	title?: string;
	subtitle?: string;
}

export const Banner: React.FC<BannerProps> = ({
	title = "BABELX",
	subtitle = "AI-powered i18n CLI",
}) => (
	<Box flexDirection="column" alignItems="center" paddingBottom={1}>
		<Text bold color={colors.cyan}>
			{title}
		</Text>
		<Text color={colors.gray}>{subtitle}</Text>
		<Newline />
	</Box>
);

interface StatusMessageProps {
	type: "success" | "error" | "warning" | "info";
	message: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
	type,
	message,
}) => {
	const colorMap = {
		success: colors.green,
		error: colors.red,
		warning: colors.yellow,
		info: colors.blue,
	};

	const iconMap = {
		success: "✓",
		error: "✗",
		warning: "⚠",
		info: "ℹ",
	};

	return (
		<Text color={colorMap[type]}>
			{iconMap[type]} {message}
		</Text>
	);
};

interface TranslationProgressProps {
	fileName: string;
	current: number;
	total: number;
	language?: string;
	status: "translating" | "cached" | "complete" | "error";
}

export const TranslationProgress: React.FC<TranslationProgressProps> = ({
	fileName,
	current,
	total,
	language,
	status,
}) => {
	const getStatusIcon = () => {
		switch (status) {
			case "translating":
				return (
					<Text color={colors.cyan}>
						<Spinner type="dots" />
					</Text>
				);
			case "cached":
				return <Text color={colors.yellow}>⚡</Text>;
			case "complete":
				return <Text color={colors.green}>✓</Text>;
			case "error":
				return <Text color={colors.red}>✗</Text>;
		}
	};

	const getStatusText = () => {
		switch (status) {
			case "translating":
				return `Translating ${current}/${total}...`;
			case "cached":
				return "Cached";
			case "complete":
				return `Done (${current} items)`;
			case "error":
				return "Failed";
		}
	};

	return (
		<Box justifyContent="space-between" width="100%">
			<Box>
				{getStatusIcon()}
				<Text> </Text>
				<Text dimColor>{fileName}</Text>
				{language && <Text color={colors.gray}> → {language}</Text>}
			</Box>
			<Text color={status === "error" ? colors.red : colors.gray}>
				{getStatusText()}
			</Text>
		</Box>
	);
};

interface DeltaSummaryProps {
	fileName: string;
	delta: Delta;
}

export const DeltaSummary: React.FC<DeltaSummaryProps> = ({
	fileName,
	delta,
}) => (
	<Box flexDirection="column" paddingLeft={2}>
		<Text dimColor>{fileName}:</Text>
		<Box flexDirection="column" paddingLeft={2}>
			{delta.added.length > 0 && (
				<Text color={colors.green}>+ {delta.added.length} added</Text>
			)}
			{delta.updated.length > 0 && (
				<Text color={colors.yellow}>~ {delta.updated.length} updated</Text>
			)}
			{delta.renamed.length > 0 && (
				<Text color={colors.blue}>→ {delta.renamed.length} renamed</Text>
			)}
			{delta.removed.length > 0 && (
				<Text color={colors.red}>- {delta.removed.length} removed</Text>
			)}
		</Box>
	</Box>
);

interface StatsProps {
	translated: number;
	cached: number;
	skipped: number;
	failed?: number;
}

export const Stats: React.FC<StatsProps> = ({
	translated,
	cached,
	skipped,
	failed = 0,
}) => (
	<Box flexDirection="column" paddingTop={1} borderStyle="single" padding={1}>
		<Text bold>Translation Summary</Text>
		<Newline />
		<Box justifyContent="space-between" width="60%">
			<Text color={colors.green}>✓ Translated: {translated}</Text>
			<Text color={colors.yellow}>⚡ Cached: {cached}</Text>
		</Box>
		<Box justifyContent="space-between" width="60%">
			<Text color={colors.gray}>○ Skipped: {skipped}</Text>
			{failed > 0 && <Text color={colors.red}>✗ Failed: {failed}</Text>}
		</Box>
	</Box>
);

interface LanguageBadgeProps {
	code: string;
	isSource?: boolean;
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
	code,
	isSource = false,
}) => (
	<Box>
		<Text
			backgroundColor={isSource ? colors.blue : colors.green}
			color="white"
			bold
		>
			{` ${code} `}
		</Text>
	</Box>
);

interface FileTreeItemProps {
	name: string;
	status?: "pending" | "processing" | "done" | "error";
	isDirectory?: boolean;
	depth?: number;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
	name,
	status = "pending",
	isDirectory = false,
	depth = 0,
}) => {
	const getIcon = () => {
		if (isDirectory) return "📁";
		switch (status) {
			case "pending":
				return "○";
			case "processing":
				return <Spinner type="dots" />;
			case "done":
				return "✓";
			case "error":
				return "✗";
		}
	};

	const getColor = () => {
		switch (status) {
			case "pending":
				return colors.gray;
			case "processing":
				return colors.cyan;
			case "done":
				return colors.green;
			case "error":
				return colors.red;
		}
	};

	return (
		<Box paddingLeft={depth * 2}>
			<Text color={getColor()}>
				{getIcon()} {name}
			</Text>
		</Box>
	);
};

interface ConfirmPromptProps {
	message: string;
	onConfirm: () => void;
	onCancel?: () => void;
}

export const ConfirmPrompt: React.FC<ConfirmPromptProps> = ({
	message,
	onConfirm: _onConfirm,
	onCancel: _onCancel,
}) => (
	<Box>
		<Text>{message} </Text>
		<Text color={colors.yellow}>[y/N]</Text>
	</Box>
);

export { colors };
