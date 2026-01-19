import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Phase = {
  id: number;
  name: string;
  color: string | null;
  timed: boolean;
};

type MissionFlowItem = {
  order: number;
  phase: {
    id: number;
    name: string;
    color: string | null;
  };
  mission_part: {
    id: number;
    mission: {
      id: number;
      name: string;
      display_number: number | null;
    };
    description: string | null;
    mission_options: {
      id: number;
      description: string;
      points: number;
    }[];
  };
};

export default function App() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [missionFlow, setMissionFlow] = useState<MissionFlowItem[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [selectedOptions, setSelectedOptions] = useState<{
    [missionPartId: number]: number | null;
  }>({});

  // Load phases
  useEffect(() => {
    const loadPhases = async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("id, name, color, timed")
        .eq("robotgame", 1)
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setPhases(data || []);
    };

    loadPhases();
  }, []);

  // Load mission flow
  useEffect(() => {
    const loadMissionFlow = async () => {
      const { data, error } = await supabase
        .from("mission_parts_phases")
        .select(`
          order,
          phase:phases (
            id,
            name,
            color
          ),
          mission_part:mission_parts (
            id,
            mission:missions (
              id,
              name,
              display_number
            ),
            description,
            mission_options (
              id,
              description,
              points
            )
          )
        `)
        .order("order", { ascending: true })
        .returns<MissionFlowItem[]>();

      if (error) {
        console.error(error);
        return;
      }

      setMissionFlow(data || []);
    };

    loadMissionFlow();
  }, []);

  // Timer effect
  useEffect(() => {
    if (startTime === null) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 50);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (missionFlow.length > 0) {
      const initial: { [id: number]: null } = {};
      missionFlow.forEach((item) => {
        if (item.mission_part.mission_options.length > 0) {
          initial[item.mission_part.id] = null; // Nothing selected by default
        }
      });
      setSelectedOptions(initial);
    }
  }, [missionFlow]);


  // Start run
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

    setCurrentIndex(0);

    if (phases[0]?.timed) {
      setStartTime(Date.now());
    }

    return data.id;
  };

  const next = async () => {
    let id = runId;

    if (!id) {
      id = await startRun();
    }

    const currentPhase = phases[currentIndex];
    if (!currentPhase) return;

    // If this phase is timed, save its duration
    if (currentPhase.timed && startTime !== null) {
      const duration = Date.now() - startTime;

      await supabase.from("run_times").insert({
        run_id: id,
        phase: currentPhase.id,
        time: duration,
      });
    }

    // Move to next phase
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setElapsed(0);

    if (phases[nextIndex]?.timed) {
      setStartTime(Date.now());
    } else {
      setStartTime(null);
    }
  };

  const handleOptionChange = async (mission_part_id: number, option_id: number | null) => {
    let id = runId;

    if (!id) {
      id = await startRun();
    }

    // Delete previous selection for this mission part & run
    const { data, error } = await supabase
      .from("mission_options")
      .select(`
            id,
            mission_part
            `)
      .eq("mission_part", mission_part_id);

    if (error) {
      console.error(error);
      return;
    }

    console.log(await supabase
      .from("run_missions")
      .delete()
      .in("mission_option", data?.map((item) => item.id) || [])
      .eq("run_id", id));

    // If the new selection is not "Nothing", insert it
    if (option_id !== null) {
      await supabase
        .from("run_missions")
        .insert({
          run_id: id,
          mission_option: option_id,
        });
    }

    // Update local state
    setSelectedOptions((prev) => ({
      ...prev,
      [mission_part_id]: option_id,
    }));
  };

  const currentPhase = phases[currentIndex];

  return (
    <div>
      <div className="min-h-screen p-8 bg-gray-100 flex flex-col items-center justify-center font-sans">
        <h1 className="text-3xl mb-6">FLL Timer</h1>

        {currentPhase && (
          <div className="flex flex-col items-center gap-6">
            <div
              className="w-80 h-32 flex items-center justify-center rounded-lg text-white text-2xl font-bold"
              style={{
                backgroundColor: "#" + (currentPhase.color || "374151"),
              }}
            >
              {currentPhase.name}
            </div>

            {currentPhase.timed && (
              <div className="text-4xl font-mono">
                {(elapsed / 1000).toFixed(1)} s
              </div>
            )}

            <button
              onClick={next}
              className="px-6 py-3 bg-green-600 text-white text-xl rounded-lg"
            >
              NEXT
            </button>
          </div>
        )}

        {currentIndex >= phases.length && (
          <div className="text-2xl mt-6">Run complete!</div>
        )}
      </div>

      <div className="w-full max-w-md bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-3">Missions</h2>

        {missionFlow.map((item, index) => {
          const previousPhase = index > 0 ? missionFlow[index - 1].phase.id : null;

          return (
            <div key={item.order}>
              {item.phase.id !== previousPhase && (
                <div className="mt-4 mb-2 text-sm font-semibold text-gray-600 uppercase"
                  style={{
                    backgroundColor: "#" + (item.phase.color || "374151"),
                  }}>
                  {item.phase.name}
                </div>
              )}

              <div className="pl-2 text-sm">
                {item.mission_part.mission.display_number && (
                  <span className="font-mono font-bold">
                    M{item.mission_part.mission.display_number}
                  </span>
                )}

                <span className="font-mono font-bold">
                  {item.mission_part.mission.name}
                </span>

                {item.mission_part.description && (
                  <span className="ml-2 text-gray-700">
                    {item.mission_part.description}
                  </span>
                )}

                {item.mission_part.mission_options.length > 0 && (
                  <ul className="mt-1 ml-4 list-none flex flex-col gap-1">
                    {/* Nothing option */}
                    <li>
                      <label className="inline-flex items-center gap-2 text-gray-600">
                        <input
                          type="radio"
                          name={`mission_${item.mission_part.id}`}
                          value={0}
                          checked={selectedOptions[item.mission_part.id] === null}
                          onChange={() =>
                            handleOptionChange(item.mission_part.id, null)
                          }
                        />
                        Nothing
                      </label>
                    </li>

                    {/* Actual mission options */}
                    {item.mission_part.mission_options.map((option) => (
                      <li key={option.id}>
                        <label className="inline-flex items-center gap-2 text-gray-600">
                          <input
                            type="radio"
                            name={`mission_${item.mission_part.id}`}
                            value={option.id}
                            checked={selectedOptions[item.mission_part.id] === option.id}
                            onChange={() =>
                              handleOptionChange(item.mission_part.id, option.id)
                            }
                          />
                          {option.description} ({option.points} pts)
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
