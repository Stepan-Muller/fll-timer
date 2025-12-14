import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Attachment = {
  id: number;
  name: string;
  color: string;
};

type RunType = "run" | "change";

export default function App() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<RunType>("run");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Load attachments
  useEffect(() => {
    const loadAttachments = async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      setAttachments(data || []);
    };

    loadAttachments();
  }, []);

  // Timer effect
  useEffect(() => {
    if (startTime === null) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 50);
    return () => clearInterval(interval);
  }, [startTime]);

  // Start a new run
  const startRun = async () => {
    const { data, error } = await supabase
      .from("runs")
      .insert({ created_at: new Date() })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      return;
    }

    setRunId(data.id);
    setStartTime(Date.now());
    setElapsed(0);
    setCurrentIndex(0);
    setPhase("run");
  };

  // Go to next phase
  const next = async () => {
    if (!runId || startTime === null) return;
    const currentAttachment = attachments[currentIndex];
    if (!currentAttachment) return;

    const duration = Date.now() - startTime;

    // Save the current phase
    await supabase.from("run_times").insert({
      run_id: runId,
      attachment_id: currentAttachment.id,
      time: duration,
      type: phase,
    });

    setStartTime(Date.now());
    setElapsed(0);

    if (phase === "run") {
      // After a run, next phase is change (unless last attachment)
      setPhase("change");
    } else {
      // After a change, move to next attachment
      setPhase("run");
      setCurrentIndex((i) => i + 1);
    }
  };

  const currentAttachment = attachments[currentIndex];

  return (
    <div className="min-h-screen p-8 bg-gray-100 flex flex-col items-center justify-center font-sans">
      <h1 className="text-3xl mb-6">FLL Timer</h1>

      {!runId && (
        <button
          onClick={startRun}
          className="px-6 py-4 bg-blue-600 text-white text-2xl rounded-lg shadow"
        >
          START RUN
        </button>
      )}

      {runId &&
        currentAttachment &&
        (currentIndex < attachments.length - 1 ||
          (currentIndex === attachments.length - 1 && phase === "run")) && (
          <div className="flex flex-col items-center gap-6">
            <div
              className="w-72 h-32 flex items-center justify-center rounded-lg text-white text-2xl font-bold"
              style={{ backgroundColor: currentAttachment.color }}
            >
              {currentAttachment.name} — {phase.toUpperCase()}
            </div>

            <div className="text-4xl font-mono">
              {(elapsed / 1000).toFixed(1)} s
            </div>

            <div className="flex gap-4">
              {currentIndex < attachments.length - 1 && (
                <button
                  onClick={next}
                  className="px-6 py-3 bg-green-600 text-white text-xl rounded-lg"
                >
                  NEXT
                </button>
              )}

              {currentIndex === attachments.length - 1 && phase === "run" && (
                <button
                  onClick={next}
                  className="px-6 py-3 bg-red-600 text-white text-xl rounded-lg"
                >
                  STOP
                </button>
              )}
            </div>
          </div>
        )}

      {runId &&
        currentIndex === attachments.length - 1 &&
        phase === "change" && (
          <div className="text-2xl mt-6">Run complete!</div>
        )}
    </div>
  );
}
