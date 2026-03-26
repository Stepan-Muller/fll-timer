import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { formatTime } from "../utils/formating";
import { useNavigate, useParams } from "react-router";
import { supabaseRetry } from "../utils/supabase";

type MissionOption = {
  id: number;
  description: string;
  points: number;
};

type MissionPart = {
  id: number;
  mission: {
    id: number;
    name: string;
    display_number: number | null;
  };
  description: string | null;
  mission_options: MissionOption[];
};

type MissionPartPhase = {
  order: number;
  mission_part: MissionPart;
};

type Phase = {
  id: number;
  name: string;
  color: string | null;
  mission_parts_phases: MissionPartPhase[];
};

type MissionFlowItem = {
  phase: {
    id: number;
    name: string;
    color: string | null;
  };
  mission_part: MissionPart;
};

export default function Timer() {
  const { robotgameId } = useParams();
  const robotgame = Number(robotgameId);

  const [phases, setPhases] = useState<Phase[]>([]);
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

  const [currentPartIndex, setCurrentPartIndex] = useState<number>(0);
  const partRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const [loading, setLoading] = useState<number>(0);
  const [savingParts, setSavingParts] = useState<Record<number, boolean>>({})

  const navigate = useNavigate();

  // ✅ Single load (phases + mission data)
  useEffect(() => {
    const loadPhases = async () => {
      const { data } = await supabaseRetry(async () =>
        supabase
          .from("phases")
          .select(`
            id,
            name,
            color,
            mission_parts_phases (
              order,
              mission_part:mission_parts (
                id,
                description,
                mission:missions (
                  id,
                  name,
                  display_number
                ),
                mission_options (
                  id,
                  description,
                  points
                )
              )
            )
          `)
          .eq("robotgame", robotgame)
          .order("id", { ascending: true })
      );

      if (!data) {
        setPhases([]);
        return;
      }

      const sorted = data.map((phase: any) => ({
        ...phase,
        mission_parts_phases: (phase.mission_parts_phases || []).sort(
          (a: any, b: any) => a.order - b.order
        ),
      }));

      setPhases(sorted);
    };

    loadPhases();
  }, []);
  
  const missionFlow: MissionFlowItem[] = useMemo(() => {
    return phases.flatMap((phase) =>
      (phase.mission_parts_phases || []).map((item) => ({
        phase: {
          id: phase.id,
          name: phase.name,
          color: phase.color,
        },
        mission_part: item.mission_part,
      }))
    );
  }, [phases]);

  // Start run
  useEffect(() => {
    const startRun = async () => {
      if (runId || !phases.length) return;
      setRunId(1);

      const { data } = await supabaseRetry(async () =>
        supabase
          .from("runs")
          .insert({ robotgame: robotgame })
          .select()
          .single()
      );

      setRunId(data.id);
    };

    startRun();
  }, [phases]);

  // Timer effects (unchanged)
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
          initial[item.mission_part.id] = null;
        }
      });
      setSelectedOptions(initial);
    }
  }, [missionFlow]);

  // ⛔ everything else stays EXACTLY the same below

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        next();
      }

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault()
        if (currentPartIndex < missionFlow.length - 1) {
          setCurrentPartIndex(currentPartIndex + 1);
        }
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault()
        if (currentPartIndex > 0) {
          setCurrentPartIndex(currentPartIndex - 1);
        }
      } else if (event.key === "Enter") {
        event.preventDefault()
        handleOptionChange(missionFlow[currentPartIndex].mission_part.id, missionFlow[currentPartIndex].mission_part.mission_options[missionFlow[currentPartIndex].mission_part.mission_options.length - 1].id);

        // Auto advance to next mission part
        if (currentPartIndex < missionFlow.length - 1) {
          setCurrentPartIndex(currentPartIndex + 1)
        }
      } else if (event.code.startsWith("Digit")) {
        event.preventDefault()
        const num = Number(event.code.replace("Digit", ""))
        if (num === 0) {
          handleOptionChange(missionFlow[currentPartIndex].mission_part.id, null)
        } else if (num <= missionFlow[currentPartIndex].mission_part.mission_options.length) {
          handleOptionChange(missionFlow[currentPartIndex].mission_part.id, missionFlow[currentPartIndex].mission_part.mission_options[num - 1].id)
        }

        // Auto advance to next mission part
        if (currentPartIndex < missionFlow.length - 1) {
          setCurrentPartIndex(currentPartIndex + 1)
        }
      } else if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        const num = parseInt(event.key, 10)
        if (num === 0) {
          handleOptionChange(missionFlow[currentPartIndex].mission_part.id, null)
        } else if (num <= missionFlow[currentPartIndex].mission_part.mission_options.length) {
          handleOptionChange(missionFlow[currentPartIndex].mission_part.id, missionFlow[currentPartIndex].mission_part.mission_options[num - 1].id)
        }

        // Auto advance to next mission part
        if (currentPartIndex < missionFlow.length - 1) {
          setCurrentPartIndex(currentPartIndex + 1)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [currentPartIndex, missionFlow, currentIndex, phases, runStartTime, runFinished, runId, savingParts]);

  useEffect(() => {
    const item = missionFlow[currentPartIndex]
    if (!item) return

    const partId = item.mission_part?.id
    if (!partId) return

    const el = partRefs.current[partId]

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center"
      })
    }
  }, [currentPartIndex, missionFlow])

  const next = async () => {
    if (currentIndex >= phases.length - 1) return;
    console.log(currentIndex);
    let id = runId;

    const nextIndex = currentIndex + 1;
    const currentPhase = phases[currentIndex];

    // Move to next phase
    setCurrentIndex(nextIndex);

    setLoading((prev) => prev + 1);

    const currentPhaseStartTime = startTime;
    setStartTime(Date.now());
    setElapsed(0);

    if (runStartTime === null) {
      setRunStartTime(Date.now());
    }
    if ((!(nextIndex > 0 && nextIndex < phases.length - 1) || phases[nextIndex] === null) && runStartTime !== null && !runFinished) {
      setRunFinished(true);
    }

    if (!currentPhase) return;

    // If this phase is timed, save its duration
    if ((currentIndex > 0 && currentIndex < phases.length - 1) && startTime !== null) {
      const duration = Date.now() - currentPhaseStartTime;

      const { error: insertError } = await supabaseRetry(async () => supabase.from("run_times").insert({
        run_id: id,
        phase: currentPhase.id,
        time: duration,
      }));

      if (insertError) {
        console.error(insertError);
        return;
      }
    }

    setLoading((prev) => prev - 1);
  };

  const handleOptionChange = async (
    mission_part_id: number,
    option_id: number | null
  ) => {
    if (savingParts[mission_part_id]) return

    setSavingParts(prev => ({ ...prev, [mission_part_id]: true }))

    setSelectedOptions((prev) => ({
      ...prev,
      [mission_part_id]: option_id,
    }));

    setLoading((prev) => prev + 1);

    let id = runId;

    // Get all options belonging to this mission_part
    const { data } = await await supabaseRetry(async () =>
      supabase
        .from("mission_options")
        .select(`
        id,
        mission_part
      `)
        .eq("mission_part", mission_part_id)
    );

    const optionIds = data?.map((item) => item.id) || [];

    // Delete previous selections
    await supabaseRetry(async () =>
      supabase
        .from("run_missions")
        .delete()
        .in("mission_option", optionIds)
        .eq("run_id", id)
    );

    // Insert new selection if not "Nothing"
    if (option_id !== null) {
      await supabaseRetry(async () =>
        supabase
          .from("run_missions")
          .insert({
            run_id: id,
            mission_option: option_id,
          })
      );
    }

    setLoading((prev) => prev - 1);

    setSavingParts(prev => ({ ...prev, [mission_part_id]: false }))
  };

  const totalPoints = missionFlow.reduce((sum, item) => {
    const selectedOptionId = selectedOptions[item.mission_part.id];

    if (!selectedOptionId) return sum;

    const option = item.mission_part.mission_options.find(
      (o) => o.id === selectedOptionId
    );

    return sum + (option?.points ?? 0);
  }, 0);

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
      <header className="w-full flex justify-between px-6 py-4 bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="text-3xl font-bold w-28">{formatTime(totalTime)}</div>
        <div className="text-3xl font-bold justify-center flex items-center">
          <button onClick={() => navigate(`/runslist/${robotgame}`)} className="underline hover:text-gray-300">HobbyRobot FLL scorer</button>
          &nbsp;
          <div className={`w-6 h-6 border-4 border-t-transparent rounded-full animate-spin ${loading > 0 ? "border-gray-500" : "border-gray-800"}`}></div>
        </div>
        <div className="text-3xl font-bold w-28 text-right">{totalPoints} pts</div>
      </header>

      {/* Main content: left and right halves */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Timer */}
        <div className="w-[calc(50%-16px)] p-6 flex flex-col bg-gray-800">
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
                {(currentIndex > 0 && currentIndex < phases.length - 1) && (
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
        <div className="w-[calc(50%+16px)] p-6 pb-2 bg-gray-850 overflow-y-auto">
          {groupedFlow.map((phaseGroup) => {
            const baseColor = "#" + (phaseGroup.phase.color || "374151");

            // near-black background with subtle color accent
            function accentDark(hex: string) {
              const clean = hex.replace("#", "");
              const r = Math.floor(parseInt(clean.substring(0, 2), 16) * 0.17);
              const g = Math.floor(parseInt(clean.substring(2, 4), 16) * 0.17);
              const b = Math.floor(parseInt(clean.substring(4, 6), 16) * 0.17);

              return `rgb(${r}, ${g}, ${b})`;
            }

            return (
              <div
                key={phaseGroup.phase.id}
                className="mb-4 rounded-lg outline outline-1 overflow-hidden"
                style={{
                  backgroundColor: accentDark(baseColor),
                  outlineColor: baseColor,
                }}
              >
                {/* Phase header */}
                <div
                  className="px-4 py-2 font-bold"
                  style={{
                    backgroundColor: baseColor,
                    color: getContrastTextColor(baseColor),
                  }}
                >
                  {phaseGroup.phase.name}
                </div>

                {/* Missions */}
                <div className="px-4">
                  {phaseGroup.missions.map((missionGroup: any) => (
                    <div
                      key={missionGroup.mission.id}
                      className="my-4 pb-2 bg-gray-800 rounded-lg shadow overflow-hidden"
                    >
                      <div className="px-4 py-2 mb-2 bg-gray-700 font-bold">
                        {missionGroup.mission.display_number &&
                          `M${missionGroup.mission.display_number} `}
                        {missionGroup.mission.name}
                      </div>

                      {missionGroup.parts.map((part: any) => (
                        <div key={part.id} className="px-4 py-2">
                          {part.description && (
                            <div className="mb-2">{part.description}</div>
                          )}

                          {/* Segmented options */}
                          <div
                            ref={(el) => {
                              partRefs.current[part.id] = el;
                            }}
                            className={`flex w-full outline rounded overflow-hidden ${part === missionFlow[currentPartIndex].mission_part
                              ? "outline-4 outline-gray-500"
                              : "outline-1 outline-gray-600"
                              }`}
                          >
                            <button
                              className={`flex-none px-2 py-2 text-sm border-r border-gray-600 flex items-center justify-center ${savingParts[part.id] ? "cursor-not-allowed" : ""
                                } ${selectedOptions[part.id] === null
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
                                className={`flex-1 px-2 py-2 text-sm border-l border-gray-600 ${savingParts[part.id] ? "cursor-not-allowed" : ""
                                  } ${selectedOptions[part.id] === option.id
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
              </div>
            );
          })}
        </div>
      </div>
    </div >
  );
}