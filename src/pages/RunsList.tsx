import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatTime } from "../utils/time";

type RunSummary = {
    id: number
    timestamp: string
    totalPoints: number
    totalTime: number
}

export default function RunsList() {
    const [runs, setRuns] = useState<RunSummary[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRuns()
    }, [])

    async function loadRuns() {
        setLoading(true)

        // get runs
        const { data: runsData, error: runsError } = await supabase
            .from("runs")
            .select("id, created_at")
            .order("created_at", { ascending: false })

        if (runsError) {
            console.error(runsError)
            setLoading(false)
            return
        }

        // get selections + points
        const { data: selectionsData, error: selError } = await supabase
            .from("run_missions")
            .select("run_id, mission_options (points)");

        if (selError) {
            console.error(selError)
            setLoading(false)
            return
        }

        // get run times
        const { data: timesData, error: timesError } = await supabase
            .from("run_times")
            .select("run_id, time")

        if (timesError) {
            console.error(timesError)
            setLoading(false)
            return
        }

        const summaries: RunSummary[] = runsData.map(run => {
            const selections = selectionsData.filter(s => s.run_id === run.id)
            const times = timesData.filter(t => t.run_id === run.id)

            const totalPoints = selections.reduce((sum, s: any) => {
                return sum + (s.mission_options?.points ?? 0)
            }, 0)

            const totalTime = times.reduce((sum, t: any) => {
                return sum + (t.time ?? 0)
            }, 0)

            return {
                id: run.id,
                timestamp: run.created_at,
                totalPoints,
                totalTime
            }
        })

        setRuns(summaries)
        setLoading(false)
    }

    async function deleteRun(runId: number) {
        const { error } = await supabase
            .from("runs")
            .delete()
            .eq("id", runId);

        if (error) {
            console.error(error);
            return;
        }

        // update UI without reloading
        setRuns(prev => prev.filter(r => r.id !== runId));
    }

    const avgPoints =
        runs.length > 0
            ? Math.round(runs.reduce((a, r) => a + r.totalPoints, 0) / runs.length)
            : 0

    const avgTime =
        runs.length > 0
            ? Math.round(runs.reduce((a, r) => a + r.totalTime, 0) / runs.length)
            : 0

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white">
            {/* Main Header */}
            <header className="w-full flex px-6 py-4 bg-gray-800 shadow-md sticky top-0 z-20">
                <div className="text-3xl font-bold w-full flex justify-center">
                    Saved Runs
                </div>
            </header>

            <div>
                {/* Runs Header */}
                <div
                    className="font-bold text-2xl px-10 py-2 mb-6 shadow-md sticky top-[68px] z-10 flex"
                    style={{
                        backgroundColor: "#374151",
                        color: "#ffffff"
                    }}
                >
                    <div className="w-full"></div>
                    <div className="w-full text-center">Points</div>
                    <div className="w-full text-center">Time</div>
                    <div className="w-full text-right"><a href="/timer" className="hover:text-gray-300">Add</a></div>
                </div>

                {/* Run Items */}
                {runs.map(run => (
                    <div
                        key={run.id}
                        className="my-4 mx-6 px-4 py-2 rounded-lg bg-gray-800 flex"
                    >
                        <div className="w-full">{new Date(run.timestamp).toLocaleString()}</div>
                        <div className="w-full text-center">{run.totalPoints}</div>
                        <div className="w-full text-center">{formatTime(run.totalTime)}</div>
                        <div className="w-full text-right">
                            <button onClick={() => deleteRun(run.id)} className="text-red-500 hover:text-red-300">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}

                {/* Footer Box */}
                <div
                    className="font-bold text-2xl px-10 py-2 mt-6 shadow-[0_0_6px_rgba(0,0,0,0.2)] sticky bottom-0 z-20 flex"
                    style={{
                        backgroundColor: "#374151",
                        color: "#ffffff"
                    }}
                >
                    <div className="w-full">{runs.length}</div>
                    <div className="w-full text-center">∅ {avgPoints}</div>
                    <div className="w-full text-center">∅ {formatTime(avgTime)}</div>
                    <div className="w-full text-right"></div>
                </div>

            </div>
        </div>
    )
}