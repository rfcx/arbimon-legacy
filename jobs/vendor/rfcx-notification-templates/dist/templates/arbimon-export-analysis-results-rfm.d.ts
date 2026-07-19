import type { TemplateDefinition } from '../types.js';
/**
 * How the download is presented in the body:
 *  - 'button': green download button (historically the Gmail path).
 *  - 'link':   plain inline download link (historically the non-Gmail path).
 * In BOTH modes the raw URL is also shown as copyable plain text, so it works
 * even when a mail client strips the button/link.
 */
export type ArbimonDownloadMode = 'button' | 'link';
export interface ArbimonExportAnalysisResultsRfmData {
    /** Project name shown in the subject + body. */
    projectName: string;
    /** Download URL (arb.mn/dl short link). */
    url: string;
    /** How to present the download (see ArbimonDownloadMode). Default 'button'. */
    mode?: ArbimonDownloadMode;
    /** Numeric analysis job id. */
    jobId?: number;
    /** Human-readable analysis job name. */
    jobName?: string;
    /** Playlist name the job ran against (if available). */
    playlistName?: string;
    /** Export filename, e.g. "rfm_phlebodes_rfm_mon_08.csv". */
    filename?: string;
    /** Number of data rows in the export (thousands-separated in the output). */
    rows?: number;
    /** File size in bytes (rendered human-readable). */
    bytes?: number;
    /** Days until the link expires (default 7). */
    expiryDays?: number;
    /**
     * Pre-formatted concrete expiry timestamp for the parenthetical, e.g.
     * "July 22, 2026 at 12:16 UTC". The caller formats it (UTC); the template
     * stays IO/clock-free.
     */
    expiresAt?: string;
}
/**
 * "Your RFM analysis results are ready for download" — sent by the
 * arbimon-legacy recording-export job when a Random Forest Model (RFM)
 * classification-job results export completes.
 *
 * Body order: greeting -> download (button/link) -> copyable URL -> stats
 * (Filename / Rows / Size) -> expiry + support -> signature.
 */
export declare const arbimonExportAnalysisResultsRfm: TemplateDefinition<ArbimonExportAnalysisResultsRfmData>;
