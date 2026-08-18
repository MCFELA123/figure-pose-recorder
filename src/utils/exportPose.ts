import { PoseRecording, PoseFrame } from '../hooks/useRecording';

/** Downloads a JSON file to the user's device */
export function downloadJSON(data: unknown, filename: string) {
 const json = JSON.stringify(data, null, 2);
 const blob = new Blob([json], { type: 'application/json' });
 const url = URL.createObjectURL(blob);

 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}

/** Save recording as a Lottie-compatible pose JSON */
export function saveRecording(recording: PoseRecording) {
 const name = `pose-recording-${Date.now()}.json`;
 downloadJSON(recording, name);
}

/**
 * Convert a recording to an inline data URI for preview.
 * Returns a base64 data URI that can be loaded directly.
 */
export function recordingToDataURI(recording: PoseRecording): string {
 const json = JSON.stringify(recording);
 return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
}
