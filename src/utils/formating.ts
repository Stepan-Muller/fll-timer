export function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const formatDate = (date: Date) => {
  const now = new Date();

  const baseOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };

  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? baseOptions
      : { ...baseOptions, year: 'numeric' };

  return date.toLocaleString('cs-CZ', options);
};