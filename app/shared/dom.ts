export const DOM = {
  escapeHtml(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  },
  downloadFile(content: string, filename: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
} as const;
