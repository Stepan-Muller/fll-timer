export async function supabaseRetry<T>(
    fn: () => Promise<T>,
    retries = Infinity,
    delay = 1000
): Promise<T> {
    let attempt = 0;

    while (true) {
        const result = await fn();

        if (!(result as any)?.error) {
            return result;
        }

        attempt++;

        if (attempt >= retries) {
            throw (result as any).error;
        }

        console.warn(`Supabase retry #${attempt}`);

        await new Promise((res) => setTimeout(res, delay));
    }
}