export const km = (m: number) => (m / 1000).toFixed(1).replace(".", ",") + " km";
export const dur = (s: number) => {
  const m = Math.max(1, Math.round(s / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
};
