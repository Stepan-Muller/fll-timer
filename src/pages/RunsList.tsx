import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatTime, formatDate } from "../utils/formating";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseRetry } from "../utils/supabase";

type RunSummary = {
    id: number;
    timestamp: string;
    totalPoints: number;
    totalTime: number;
};

export default function RunsList() {
    const { robotgameId } = useParams();
    const robotgame = Number(robotgameId);

    const [runs, setRuns] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [robotGameName, setRobotGameName] = useState<string>("");

    const navigate = useNavigate();

    useEffect(() => {
        loadRobotGameAndRuns();
    }, [robotgame]);

    async function loadRobotGameAndRuns() {
        setLoading(true);

        // 1️⃣ Get robotgame name
        const { data: gameData, error: gameError } = await await supabaseRetry(async () =>
            supabase
                .from("robotgames")
                .select("name")
                .eq("id", robotgame)
                .single()
        );

        if (gameError || !gameData) {
            console.error(gameError);
            setLoading(false);
            return;
        }

        setRobotGameName(gameData.name);

        // 2️⃣ Get runs for this robotgame
        const { data: runsData, error: runsError } = await supabaseRetry(async () =>
            supabase
                .from("runs")
                .select("id, created_at")
                .eq("robotgame", robotgame)
                .order("created_at", { ascending: false })
        );

        if (runsError || !runsData) {
            console.error(runsError);
            setLoading(false);
            return;
        }

        const runIds = runsData.map((r) => r.id);

        if (runIds.length === 0) {
            setRuns([]);
            setLoading(false);
            return;
        }

        // 3️⃣ Get points from run_missions
        const { data: selectionsData } = await supabaseRetry(async () =>
            supabase
                .from("run_missions")
                .select("run_id, mission_options (points)")
                .in("run_id", runIds)
        );

        // 4️⃣ Get run times
        const { data: timesData } = await supabaseRetry(async () =>
            supabase
                .from("run_times")
                .select("run_id, time")
                .in("run_id", runIds)
        );

        // 5️⃣ Calculate totals
        const summaries: RunSummary[] = runsData.map((run) => {
            const selections = selectionsData?.filter((s) => s.run_id === run.id) || [];
            const times = timesData?.filter((t) => t.run_id === run.id) || [];

            const totalPoints = selections.reduce((sum, s: any) => sum + (s.mission_options?.points ?? 0), 0);
            const totalTime = times.reduce((sum, t: any) => sum + (t.time ?? 0), 0);

            return {
                id: run.id,
                timestamp: run.created_at,
                totalPoints,
                totalTime,
            };
        });

        setRuns(summaries);
        setLoading(false);
    }

    async function deleteRun(runId: number) {
        const { error } = await supabaseRetry(async () =>
            supabase
                .from("runs")
                .delete()
                .eq("id", runId)
        );

        if (error) {
            console.error(error);
            return;
        }

        setRuns((prev) => prev.filter((r) => r.id !== runId));
    }

    const avgPoints = runs.length ? Math.round(runs.reduce((a, r) => a + r.totalPoints, 0) / runs.length) : 0;
    const avgTime = runs.length ? Math.round(runs.reduce((a, r) => a + r.totalTime, 0) / runs.length) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white pb-14">
            {/* Main Header */}
            <header className="w-full flex px-6 py-4 bg-gray-800 shadow-md sticky top-0 z-20">
                <div className="text-3xl font-bold w-full flex justify-center">
                    <button onClick={() => navigate("/robotgameslist")} className="underline hover:text-gray-300 whitespace-nowrap overflow-hidden">
                        {robotGameName}
                    </button>
                </div>
            </header>

            <div>
                {/* Runs Header */}
                <div
                    className="font-bold text-2xl px-10 py-2 mb-6 shadow-md flex"
                    style={{
                        backgroundColor: "#374151",
                        color: "#ffffff",
                    }}
                >
                    <div className="w-full"></div>
                    <div className="w-full text-center">Points</div>
                    <div className="w-full text-center">Time</div>
                    <div className="w-full text-right">
                        <button onClick={() => navigate(`/timer/${robotgame}`)} className="hover:text-gray-300" title="new run">
                            <i className="uil uil-plus-circle"></i>
                        </button>
                    </div>
                </div>

                {/* Run Items */}
                {runs.map((run) => (
                    <div key={run.id} className="my-4 mx-6 px-4 py-2 rounded-lg bg-gray-800 flex">
                        <div className="w-full">{formatDate(new Date(run.timestamp))}</div>
                        <div className="w-full text-center">{run.totalPoints}</div>
                        <div className="w-full text-center">{formatTime(run.totalTime)}</div>
                        <div className="w-full text-right">
                            <button onClick={() => deleteRun(run.id)} className="text-red-500 hover:text-red-400" title="delete run">
                                <i className="uil uil-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                ))}

                {/* Footer Box */}
                <div
                    className="font-bold text-2xl w-full px-10 py-2 shadow-[0_0_6px_rgba(0,0,0,0.2)] fixed bottom-0 z-20 flex"
                    style={{
                        backgroundColor: "#374151",
                        color: "#ffffff",
                    }}
                >
                    <div className="w-full">{runs.length}</div>
                    <div className="w-full text-center">∅ {avgPoints}</div>
                    <div className="w-full text-center">∅ {formatTime(avgTime)}</div>
                    <div className="w-full text-right"></div>
                </div>
            </div>
        </div>
    );
}