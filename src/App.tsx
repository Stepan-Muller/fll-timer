import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Phase = {
  id: number;
  name: string;
  color: string | null;
  timed: boolean;
};

type MissionPart = {
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

type MissionFlowItem = {
  order: number;
  phase: {
    id: number;
    name: string;
    color: string | null;
  };
  mission_part: MissionPart;
};

export default function App() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [missionFlow, setMissionFlow] = useState<MissionFlowItem[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState(0);
  const [runFinished, setRunFinished] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<{
    [missionPartId: number]: number | null;
  }>({});

  const [currentPart, setCurrentPart] = useState<MissionPart | null>(null);
  const [currentPartIndex, setCurrentPartIndex] = useState<number>(0);

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
      
      setCurrentPart(data[0].mission_part)
    };

    loadMissionFlow();
  }, []);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!runStartTime || runFinished) return;

    const interval = setInterval(() => {
      setTotalTime(Date.now() - runStartTime);
    }, 100);

    return () => clearInterval(interval);
  }, [runStartTime, runFinished]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault()
        next()
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        if (currentPartIndex < missionFlow.length - 1) {
          setCurrentPart(missionFlow[currentPartIndex + 1].mission_part);
          setCurrentPartIndex(currentPartIndex + 1);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        if (currentPartIndex > 0) {
          setCurrentPart(missionFlow[currentPartIndex - 1].mission_part);
          setCurrentPartIndex(currentPartIndex - 1);
        }
      }

      console.log(missionFlow);
    }
    
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [currentIndex, phases.length]);

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
      setRunStartTime(Date.now());
    }

    return data.id;
  };

  const next = async () => {
    if (currentIndex >= phases.length - 1) return;

    let id = runId;

    if (!id) {
      id = await startRun();
    }

    const currentPhase = phases[currentIndex];
    if (!currentPhase) return;

    const currentPhaseStartTime = startTime;
    setStartTime(Date.now());

    // If this phase is timed, save its duration
    if (currentPhase.timed && startTime !== null) {
      const duration = Date.now() - currentPhaseStartTime;

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

    if (phases[nextIndex]?.timed && runStartTime === null) {
      setRunStartTime(Date.now());
    }
    if ((!phases[nextIndex]?.timed || phases[nextIndex] === null) && runStartTime !== null && !runFinished) {
      setRunFinished(true);
    }
  };

  const handleOptionChange = async (
    mission_part_id: number,
    option_id: number | null
  ) => {
    let id = runId;

    if (!id) {
      id = await startRun();
    }

    try {
      // Get all options belonging to this mission_part
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

      const optionIds = data?.map((item) => item.id) || [];

      // Delete previous selections
      const { error: deleteError } = await supabase
        .from("run_missions")
        .delete()
        .in("mission_option", optionIds)
        .eq("run_id", id);

      if (deleteError) {
        console.error(deleteError);
        return;
      }

      // Insert new selection if not "Nothing"
      if (option_id !== null) {
        const { error: insertError } = await supabase
          .from("run_missions")
          .insert({
            run_id: id,
            mission_option: option_id,
          });

        if (insertError) {
          console.error(insertError);
          return;
        }
      }

      // Only update state if DB operations succeeded
      setSelectedOptions((prev) => ({
        ...prev,
        [mission_part_id]: option_id,
      }));

    } catch (err) {
      console.error(err);
    }
  };

  const totalPoints = missionFlow.reduce((sum, item) => {
    const selectedOptionId = selectedOptions[item.mission_part.id];

    if (!selectedOptionId) return sum;

    const option = item.mission_part.mission_options.find(
      (o) => o.id === selectedOptionId
    );

    return sum + (option?.points ?? 0);
  }, 0);

  function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function getContrastTextColor(hex: string) {
    const clean = hex.replace("#", "")

    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)

    // Perceived luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b)

    return luminance > 130 ? "#000000" : "#FFFFFF"
  }

  const currentPhase = phases[currentIndex];
  
  const groupedFlow = missionFlow.reduce((acc: any[], item) => {
    let phaseGroup = acc.find(p => p.phase.id === item.phase.id)

    if (!phaseGroup) {
      phaseGroup = {
        phase: item.phase,
        missions: []
      }
      acc.push(phaseGroup)
    }

    let missionGroup = phaseGroup.missions.find(
      (m: any) => m.mission.id === item.mission_part.mission.id
    )

    if (!missionGroup) {
      missionGroup = {
        mission: item.mission_part.mission,
        parts: []
      }
      phaseGroup.missions.push(missionGroup)
    }

    missionGroup.parts.push(item.mission_part)

    return acc
  }, [])

  return (
    <div className="h-screen w-screen bg-gray-900 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full flex px-6 py-4 bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="text-3xl font-bold w-full">{formatTime(totalTime)}</div>
        <div className="text-3xl font-bold w-full text-center"><a href="https://hobbyrobot.team" target="_blank" className="underline hover:text-gray-300">HobbyRobot</a> FLL scorer</div>
        <div className="text-3xl font-bold w-full text-right">{totalPoints} pts</div>
      </header>

      {/* Main content: left and right halves */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Timer */}
        <div className="w-1/2 p-6 flex flex-col bg-gray-800">
          {currentPhase && (
            <>
              {/* TOP — Phase */}
              <div className="flex-1 flex items-center justify-center">
                <div
                  className="w-full h-full flex items-center justify-center rounded-lg text-2xl font-bold"
                  style={{
                    backgroundColor: "#" + (currentPhase.color || "374151"),
                    color: getContrastTextColor("#" + (currentPhase.color || "374151")),
                  }}
                >
                  {currentPhase.name}
                </div>
              </div>

              {/* MIDDLE — Timer */}
              <div className="flex-1 flex items-center justify-center">
                {currentPhase.timed && (
                  <div className="text-6xl font-mono">
                    {(elapsed / 1000).toFixed(1)}
                  </div>
                )}
              </div>

              {/* BOTTOM — Next button */}
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={next}
                  disabled={currentIndex === phases.length - 1}
                  className={`w-full h-full flex items-center justify-center text-2xl rounded-lg ${currentIndex === phases.length - 1
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                    }`}
                >
                  Next ⎵
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Missions */}
        <div className="w-1/2 px-6 pb-2 bg-gray-850 overflow-y-auto">
          {groupedFlow.map((phaseGroup) => (
            <div key={phaseGroup.phase.id}>

              {/* Phase label */}
              <div
                className="mt-6 mb-4 font-bold px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: "#" + (phaseGroup.phase.color || "374151"),
                  color: getContrastTextColor("#" + (phaseGroup.phase.color || "374151"))
                }}
              >
                {phaseGroup.phase.name}
              </div>

              {/* Missions */}
              {phaseGroup.missions.map((missionGroup: any) => (
                <div
                  key={missionGroup.mission.id}
                  className="mb-4 pb-2 bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                  <div className="px-4 py-2 mb-2 bg-gray-700 font-bold">
                    {missionGroup.mission.display_number &&
                      `M${missionGroup.mission.display_number} `}
                    {missionGroup.mission.name}
                  </div>

                  {missionGroup.parts.map((part: any) => (
                    <div
                      key={part.id}
                      className="px-4 py-2"
                    >
                      {part.description && (
                        <div className="mb-2">
                          {part.description}
                        </div>
                      )}

                      {/* Segmented options */}
                      <div className={`flex w-full outline outline-gray-600 rounded overflow-hidden ${
                        part === currentPart ? "outline-4" : "outline-1"
                        }`}>

                        <button
                          className={`flex-none px-2 py-2 text-sm border-r border-gray-600 flex items-center justify-center ${selectedOptions[part.id] === null
                            ? "bg-gray-600"
                            : "bg-gray-800 hover:bg-gray-700"
                            }`}
                          onClick={() => handleOptionChange(part.id, null)}
                        >
                          ∅
                        </button>

                        {part.mission_options.map((option: any) => (
                          <button
                            key={option.id}
                            className={`flex-1 px-2 py-2 text-sm border-l border-gray-600 ${selectedOptions[part.id] === option.id
                              ? "bg-gray-600"
                              : "bg-gray-800 hover:bg-gray-700"
                              }`}
                            onClick={() =>
                              handleOptionChange(part.id, option.id)
                            }
                          >
                            {option.description}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}